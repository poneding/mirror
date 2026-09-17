import { describe, expect, it } from "vitest";
import {
  CHROME_HIDE_DELAY_MS,
  type KeyValueStore,
  type MediaItem,
  OSD_DURATION_MS,
  SEEK_STEP_MAX,
  SEEK_STEP_MIN,
  SPEED_STEPS,
  STORAGE_KEYS,
  WINDOW_FIT,
  clamp,
  detectPlatform,
  extensionOf,
  fileNameFromPath,
  fitWindowToVideo,
  formatTime,
  getInitialBoolean,
  getInitialLanguage,
  getInitialNumber,
  getInitialPlaybackMode,
  getInitialTheme,
  isSupportedVideo,
  isTypingTarget,
  nextIndex,
  parseStoredHistory,
  parseStoredPlaylist,
  resolveActiveId,
  resolveEndedAction,
  resolveEscape,
  resolveShortcut,
  resumePosition,
  stepSpeed,
} from "./player";

/** In-memory stand-in for localStorage. */
function fakeStore(entries: Record<string, string> = {}): KeyValueStore {
  return { getItem: (key) => (key in entries ? entries[key] : null) };
}

function item(id: string, overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id,
    name: `${id}.mp4`,
    path: `/videos/${id}.mp4`,
    source: `asset://localhost/${id}.mp4`,
    duration: 10,
    ...overrides,
  };
}

describe("formatTime", () => {
  it("pads minutes and seconds", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(5)).toBe("00:05");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(599)).toBe("09:59");
  });

  it("switches to hours when needed", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3725)).toBe("1:02:05");
  });

  it("never emits negative or non-finite output", () => {
    expect(formatTime(-1)).toBe("00:00");
    expect(formatTime(Number.NaN)).toBe("00:00");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("00:00");
  });

  it("truncates fractional seconds instead of rounding up", () => {
    expect(formatTime(59.99)).toBe("00:59");
  });
});

describe("fileNameFromPath", () => {
  it("handles Windows and POSIX separators", () => {
    expect(fileNameFromPath("C:\\Users\\dp\\clip.mp4")).toBe("clip.mp4");
    expect(fileNameFromPath("/home/dp/clip.mp4")).toBe("clip.mp4");
    expect(fileNameFromPath("C:/mixed\\path/clip.mkv")).toBe("clip.mkv");
  });

  it("falls back for empty input", () => {
    expect(fileNameFromPath("")).toBe("Untitled video");
  });
});

describe("extensionOf / isSupportedVideo", () => {
  it("extracts lowercase extensions", () => {
    expect(extensionOf("Movie.MP4")).toBe("mp4");
    expect(extensionOf("archive.tar.gz")).toBe("gz");
    expect(extensionOf("noext")).toBe("");
    expect(extensionOf(".hidden")).toBe("");
    expect(extensionOf("trailing.")).toBe("");
  });

  it("accepts known video containers", () => {
    for (const extension of ["mp4", "mkv", "webm", "mov", "avi", "m4v"]) {
      expect(isSupportedVideo(`clip.${extension}`)).toBe(true);
      expect(isSupportedVideo(`clip.${extension.toUpperCase()}`)).toBe(true);
    }
  });

  it("rejects unrelated files", () => {
    expect(isSupportedVideo("notes.txt")).toBe(false);
    expect(isSupportedVideo("song.mp3")).toBe(false);
    expect(isSupportedVideo("photo.png")).toBe(false);
  });

  it("lets extension-less selections through for the media element to judge", () => {
    expect(isSupportedVideo("mystery")).toBe(true);
  });
});

describe("persisted setting defaults", () => {
  it("uses fallbacks when storage is empty", () => {
    const store = fakeStore();
    expect(getInitialTheme(store)).toBe("dark");
    expect(getInitialLanguage(store)).toBe("zh");
    expect(getInitialPlaybackMode(store)).toBe("pause");
    expect(getInitialBoolean(store, STORAGE_KEYS.autoUpdate, true)).toBe(true);
  });

  it("reads stored values back", () => {
    const store = fakeStore({
      [STORAGE_KEYS.theme]: "light",
      [STORAGE_KEYS.language]: "en",
      [STORAGE_KEYS.playbackMode]: "list",
      [STORAGE_KEYS.autoUpdate]: "false",
    });
    expect(getInitialTheme(store)).toBe("light");
    expect(getInitialLanguage(store)).toBe("en");
    expect(getInitialPlaybackMode(store)).toBe("list");
    expect(getInitialBoolean(store, STORAGE_KEYS.autoUpdate, true)).toBe(false);
  });

  it("ignores corrupt enum values", () => {
    const store = fakeStore({
      [STORAGE_KEYS.theme]: "neon",
      [STORAGE_KEYS.language]: "kr",
      [STORAGE_KEYS.playbackMode]: "shuffle",
    });
    expect(getInitialTheme(store)).toBe("dark");
    expect(getInitialLanguage(store)).toBe("zh");
    expect(getInitialPlaybackMode(store)).toBe("pause");
  });

  it("honours an explicit 'system' theme", () => {
    expect(getInitialTheme(fakeStore({ [STORAGE_KEYS.theme]: "system" }))).toBe("system");
  });
});

describe("getInitialNumber", () => {
  // Regression: Number(null) is 0, so a missing key used to force the minimum.
  it("returns the fallback for a missing key rather than zero", () => {
    expect(getInitialNumber(fakeStore(), STORAGE_KEYS.volume, 0.8, 0, 1)).toBe(0.8);
    expect(getInitialNumber(fakeStore(), STORAGE_KEYS.speed, 1, 0.25, 2)).toBe(1);
    expect(getInitialNumber(fakeStore(), STORAGE_KEYS.seekStep, 10, 5, 60)).toBe(10);
  });

  it("clamps stored values into range", () => {
    expect(getInitialNumber(fakeStore({ v: "5" }), "v", 0.8, 0, 1)).toBe(1);
    expect(getInitialNumber(fakeStore({ v: "-3" }), "v", 0.8, 0, 1)).toBe(0);
    expect(getInitialNumber(fakeStore({ v: "0.45" }), "v", 0.8, 0, 1)).toBe(0.45);
  });

  it("falls back for unparseable values", () => {
    expect(getInitialNumber(fakeStore({ v: "loud" }), "v", 0.8, 0, 1)).toBe(0.8);
    expect(getInitialNumber(fakeStore({ v: "NaN" }), "v", 0.8, 0, 1)).toBe(0.8);
  });

  it("treats a stored explicit zero as zero", () => {
    expect(getInitialNumber(fakeStore({ v: "0" }), "v", 0.8, 0, 1)).toBe(0);
  });

  it("respects the documented seek-step bounds", () => {
    expect(getInitialNumber(fakeStore({ s: "5" }), "s", 10, SEEK_STEP_MIN, SEEK_STEP_MAX)).toBe(5);
    expect(getInitialNumber(fakeStore({ s: "60" }), "s", 10, SEEK_STEP_MIN, SEEK_STEP_MAX)).toBe(60);
    expect(getInitialNumber(fakeStore({ s: "999" }), "s", 10, SEEK_STEP_MIN, SEEK_STEP_MAX)).toBe(60);
  });
});

describe("clamp", () => {
  it("bounds values on both sides", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe("parseStoredPlaylist", () => {
  it("returns an empty list for empty or malformed input", () => {
    expect(parseStoredPlaylist(null)).toEqual([]);
    expect(parseStoredPlaylist("")).toEqual([]);
    expect(parseStoredPlaylist("{not json")).toEqual([]);
    expect(parseStoredPlaylist('{"a":1}')).toEqual([]);
  });

  it("restores valid entries", () => {
    const items = [item("a"), item("b")];
    expect(parseStoredPlaylist(JSON.stringify(items))).toHaveLength(2);
  });

  // blob: URLs cannot survive a restart, so restoring them would show dead rows.
  it("drops blob-backed entries", () => {
    const raw = JSON.stringify([
      item("keep"),
      item("drop", { source: "blob:http://localhost/dead" }),
    ]);
    const restored = parseStoredPlaylist(raw);
    expect(restored.map((entry) => entry.id)).toEqual(["keep"]);
  });

  it("drops structurally invalid entries", () => {
    const raw = JSON.stringify([
      item("good"),
      { id: "missing-source", name: "x", path: "x" },
      { name: "no-id", source: "asset://x" },
      null,
    ]);
    expect(parseStoredPlaylist(raw).map((entry) => entry.id)).toEqual(["good"]);
  });
});

describe("resolveActiveId", () => {
  it("keeps a still-valid selection", () => {
    expect(resolveActiveId([item("a"), item("b")], "b")).toBe("b");
  });

  it("falls back to the first item when the selection vanished", () => {
    expect(resolveActiveId([item("a"), item("b")], "gone")).toBe("a");
    expect(resolveActiveId([item("a")], null)).toBe("a");
  });

  it("returns null for an empty playlist", () => {
    expect(resolveActiveId([], "a")).toBeNull();
  });
});

describe("nextIndex", () => {
  it("wraps forward and backward", () => {
    expect(nextIndex(0, 3, 1)).toBe(1);
    expect(nextIndex(2, 3, 1)).toBe(0);
    expect(nextIndex(0, 3, -1)).toBe(2);
  });

  it("is safe for an empty list", () => {
    expect(nextIndex(0, 0, 1)).toBe(0);
  });
});

describe("stepSpeed", () => {
  it("walks the preset ladder", () => {
    expect(stepSpeed(1, 1)).toBe(1.25);
    expect(stepSpeed(1, -1)).toBe(0.75);
  });

  it("wraps at both ends", () => {
    expect(stepSpeed(SPEED_STEPS[SPEED_STEPS.length - 1], 1)).toBe(SPEED_STEPS[0]);
    expect(stepSpeed(SPEED_STEPS[0], -1)).toBe(SPEED_STEPS[SPEED_STEPS.length - 1]);
  });

  it("starts from 1x when the current rate is off-ladder", () => {
    expect(stepSpeed(1.1, 1)).toBe(1.25);
  });
});

describe("resolveEndedAction", () => {
  const items = [item("a"), item("b"), item("c")];

  it("stops in pause mode", () => {
    expect(resolveEndedAction(items, "a", "pause")).toEqual({ kind: "stop" });
  });

  it("repeats in single mode", () => {
    expect(resolveEndedAction(items, "b", "single")).toEqual({ kind: "repeat" });
  });

  it("advances through the playlist then stops at the end", () => {
    expect(resolveEndedAction(items, "a", "playlist")).toEqual({ kind: "advance", id: "b" });
    expect(resolveEndedAction(items, "c", "playlist")).toEqual({ kind: "stop" });
  });

  it("wraps around in list mode", () => {
    expect(resolveEndedAction(items, "c", "list")).toEqual({ kind: "advance", id: "a" });
  });

  it("stops when the active item is unknown", () => {
    expect(resolveEndedAction(items, "ghost", "list")).toEqual({ kind: "stop" });
  });

  it("stops for an empty playlist", () => {
    expect(resolveEndedAction([], "a", "list")).toEqual({ kind: "stop" });
  });
});

describe("detectPlatform", () => {
  it("recognises macOS", () => {
    expect(detectPlatform("Mozilla/5.0 (Macintosh)", "MacIntel")).toBe("mac");
    expect(detectPlatform("Mozilla/5.0 (iPhone)", "iPhone")).toBe("mac");
  });

  it("recognises Windows", () => {
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0)", "Win32")).toBe("windows");
  });

  it("treats everything else as linux", () => {
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)", "Linux x86_64")).toBe("linux");
  });
});

describe("resolveShortcut on macOS", () => {
  const mac = "mac" as const;

  it("maps plain arrow keys to seek and volume", () => {
    expect(resolveShortcut({ key: "ArrowRight" }, mac)).toEqual({ type: "seek", amount: 1 });
    expect(resolveShortcut({ key: "ArrowLeft" }, mac)).toEqual({ type: "seek", amount: -1 });
    expect(resolveShortcut({ key: "ArrowUp" }, mac)).toEqual({ type: "volume", amount: 1 });
    expect(resolveShortcut({ key: "ArrowDown" }, mac)).toEqual({ type: "volume", amount: -1 });
  });

  it("maps cmd+arrows to track and speed", () => {
    expect(resolveShortcut({ key: "ArrowRight", metaKey: true }, mac)).toEqual({ type: "track", direction: 1 });
    expect(resolveShortcut({ key: "ArrowLeft", metaKey: true }, mac)).toEqual({ type: "track", direction: -1 });
    expect(resolveShortcut({ key: "ArrowUp", metaKey: true }, mac)).toEqual({ type: "speed", direction: 1 });
    expect(resolveShortcut({ key: "ArrowDown", metaKey: true }, mac)).toEqual({ type: "speed", direction: -1 });
  });

  it("uses cmd for panels, not ctrl", () => {
    expect(resolveShortcut({ key: ",", metaKey: true }, mac)).toEqual({ type: "panel", panel: "settings" });
    expect(resolveShortcut({ key: "p", metaKey: true }, mac)).toEqual({ type: "panel", panel: "playlist" });
    expect(resolveShortcut({ key: "p", ctrlKey: true }, mac)).toBeNull();
  });

  it("ignores alt+arrow, which belongs to Windows/Linux", () => {
    expect(resolveShortcut({ key: "ArrowRight", altKey: true }, mac)).toEqual({ type: "seek", amount: 1 });
  });
});

describe("resolveShortcut on Windows/Linux", () => {
  for (const platform of ["windows", "linux"] as const) {
    it(`uses alt+arrows for track and speed on ${platform}`, () => {
      expect(resolveShortcut({ key: "ArrowRight", altKey: true }, platform)).toEqual({ type: "track", direction: 1 });
      expect(resolveShortcut({ key: "ArrowLeft", altKey: true }, platform)).toEqual({ type: "track", direction: -1 });
      expect(resolveShortcut({ key: "ArrowUp", altKey: true }, platform)).toEqual({ type: "speed", direction: 1 });
      expect(resolveShortcut({ key: "ArrowDown", altKey: true }, platform)).toEqual({ type: "speed", direction: -1 });
    });

    it(`uses ctrl for panels on ${platform}`, () => {
      expect(resolveShortcut({ key: ",", ctrlKey: true }, platform)).toEqual({ type: "panel", panel: "settings" });
      expect(resolveShortcut({ key: "p", ctrlKey: true }, platform)).toEqual({ type: "panel", panel: "playlist" });
      expect(resolveShortcut({ key: "p", metaKey: true }, platform)).toBeNull();
    });
  }

  it("accepts uppercase P as well", () => {
    expect(resolveShortcut({ key: "P", ctrlKey: true }, "windows")).toEqual({ type: "panel", panel: "playlist" });
  });
});

describe("resolveShortcut shared keys", () => {
  it("maps space to play/pause, including the code fallback", () => {
    expect(resolveShortcut({ key: " " }, "windows")).toEqual({ type: "toggle-play" });
    expect(resolveShortcut({ key: "Spacebar", code: "Space" }, "linux")).toEqual({ type: "toggle-play" });
  });

  it("maps Enter to fullscreen and Escape to escape", () => {
    expect(resolveShortcut({ key: "Enter" }, "windows")).toEqual({ type: "fullscreen" });
    expect(resolveShortcut({ key: "Escape" }, "windows")).toEqual({ type: "escape" });
  });

  it("returns null for unrelated keys", () => {
    expect(resolveShortcut({ key: "a" }, "windows")).toBeNull();
    expect(resolveShortcut({ key: "F5" }, "mac")).toBeNull();
  });
});

describe("resolveEscape precedence", () => {
  it("closes the settings panel first", () => {
    expect(resolveEscape("settings", true)).toEqual({ handled: true, close: "settings" });
  });

  it("closes the playlist next", () => {
    expect(resolveEscape("playlist", true)).toEqual({ handled: true, close: "playlist" });
  });

  it("only exits fullscreen when no panel is open", () => {
    expect(resolveEscape(null, true)).toEqual({ handled: true, exitFullscreen: true });
  });

  it("does nothing when nothing is open", () => {
    expect(resolveEscape(null, false)).toEqual({ handled: false });
  });

  // Both panels share one slot, so settings and playlist cannot be open at the
  // same time; the ordering in the spec is not independently observable here.
  it("prefers closing a panel over leaving fullscreen", () => {
    const settings = resolveEscape("settings", true);
    expect("close" in settings && settings.close).toBe("settings");
  });
});

describe("isTypingTarget", () => {
  it("protects text entry from shortcuts", () => {
    expect(isTypingTarget("INPUT")).toBe(true);
    expect(isTypingTarget("TEXTAREA")).toBe(true);
    expect(isTypingTarget("SELECT")).toBe(true);
    expect(isTypingTarget("DIV")).toBe(false);
    expect(isTypingTarget("BUTTON")).toBe(false);
  });
});

describe("watch history", () => {
  it("parses a valid entry", () => {
    const raw = JSON.stringify({ id: "a", name: "A", position: 42, updatedAt: 1 });
    expect(parseStoredHistory(raw)).toEqual({ id: "a", name: "A", position: 42, updatedAt: 1 });
  });

  it("rejects malformed entries", () => {
    expect(parseStoredHistory(null)).toBeNull();
    expect(parseStoredHistory("nope")).toBeNull();
    expect(parseStoredHistory(JSON.stringify({ id: "a", position: -5 }))).toBeNull();
    expect(parseStoredHistory(JSON.stringify({ position: 3 }))).toBeNull();
  });

  it("resumes only for the matching, unfinished item", () => {
    const history = { id: "a", name: "A", position: 30, updatedAt: 1 };
    expect(resumePosition(history, "a", 100)).toBe(30);
    expect(resumePosition(history, "b", 100)).toBe(0);
    expect(resumePosition(null, "a", 100)).toBe(0);
  });

  it("does not resume when the saved point is at the very end", () => {
    expect(resumePosition({ id: "a", name: "A", position: 99, updatedAt: 1 }, "a", 100)).toBe(0);
  });

  it("does not resume without a usable duration", () => {
    expect(resumePosition({ id: "a", name: "A", position: 5, updatedAt: 1 }, "a", 0)).toBe(0);
    expect(resumePosition({ id: "a", name: "A", position: 5, updatedAt: 1 }, "a", Number.NaN)).toBe(0);
  });
});

describe("fitWindowToVideo", () => {
  const shapes: [number, number][] = [
    [1920, 1080],
    [1280, 720],
    [720, 1280],
    [2560, 1080],
    [1080, 1920],
    [3840, 2160],
  ];

  it("keeps the aspect ratio for common shapes", () => {
    for (const [width, height] of shapes) {
      const size = fitWindowToVideo(width, height);
      expect(size).not.toBeNull();
      expect(size!.width / size!.height).toBeCloseTo(width / height, 2);
    }
  });

  // Regression: clamping width and height independently distorted these.
  it("keeps the aspect ratio for extreme shapes", () => {
    const extreme: [number, number][] = [
      [3840, 240], // very wide
      [100, 2000], // very tall
      [720, 5760], // extreme portrait
      [5120, 1440], // super ultrawide
    ];
    for (const [width, height] of extreme) {
      const size = fitWindowToVideo(width, height)!;
      expect(size.width / size.height).toBeCloseTo(width / height, 2);
    }
  });

  it("uses the target width for standard landscape video", () => {
    const size = fitWindowToVideo(1920, 1080)!;
    expect(size.width).toBeCloseTo(WINDOW_FIT.targetWidth, 1);
    expect(size.height).toBeCloseTo(630, 0);
  });

  it("never exceeds the maximums", () => {
    for (const [width, height] of [...shapes, [3840, 240], [100, 2000]] as [number, number][]) {
      const size = fitWindowToVideo(width, height)!;
      expect(size.width).toBeLessThanOrEqual(WINDOW_FIT.maxWidth + 0.01);
      expect(size.height).toBeLessThanOrEqual(WINDOW_FIT.maxHeight + 0.01);
    }
  });

  it("honours the minimums when they fit", () => {
    const size = fitWindowToVideo(1920, 1080)!;
    expect(size.width).toBeGreaterThanOrEqual(WINDOW_FIT.minWidth);
    expect(size.height).toBeGreaterThanOrEqual(WINDOW_FIT.minHeight);
  });

  it("rejects unusable dimensions", () => {
    expect(fitWindowToVideo(0, 1080)).toBeNull();
    expect(fitWindowToVideo(1920, 0)).toBeNull();
    expect(fitWindowToVideo(-1920, 1080)).toBeNull();
    expect(fitWindowToVideo(Number.NaN, 1080)).toBeNull();
    expect(fitWindowToVideo(1920, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("constants stay coherent", () => {
  it("keeps the chrome delay positive", () => {
    expect(CHROME_HIDE_DELAY_MS).toBeGreaterThan(0);
  });

  it("keeps the status indicator brief but readable", () => {
    expect(OSD_DURATION_MS).toBeGreaterThanOrEqual(800);
    expect(OSD_DURATION_MS).toBeLessThanOrEqual(2000);
  });

  it("keeps speed steps ordered and centred on 1x", () => {
    expect(SPEED_STEPS).toContain(1);
    expect([...SPEED_STEPS].sort((a, b) => a - b)).toEqual([...SPEED_STEPS]);
  });

  it("keeps storage keys namespaced and unique", () => {
    const keys = Object.values(STORAGE_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key.startsWith("mirror-")).toBe(true);
  });
});
