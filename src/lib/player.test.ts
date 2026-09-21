import { describe, expect, it } from "vitest";
import {
  CHROME_HIDE_DELAY_MS,
  HISTORY_LIMIT,
  HOLD_SPEED_BACK,
  HOLD_SPEED_DELAY_MS,
  HOLD_SPEED_FORWARD,
  type HistoryEntry,
  historyToMediaItem,
  type KeyValueStore,
  type MediaItem,
  OSD_DURATION_MS,
  PROJECT,
  SHORTCUT_ORDER,
  SEEK_STEP_MAX,
  SEEK_STEP_MIN,
  SPEED_STEPS,
  STORAGE_KEYS,
  TOOLTIP_FLIP_PX,
  WINDOW_FIT,
  acceptsUpdate,
  advanceSeekHold,
  arrowSeekAmount,
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
  getInitialString,
  getInitialTheme,
  DEFAULT_MONO_STACK,
  DEFAULT_SANS_STACK,
  holdSpeed,
  isPreviewVersion,
  isSupportedVideo,
  isTextTruncated,
  isTypingTarget,
  mediaKind,
  nextIndex,
  parseHistory,
  parseStoredPlaylist,
  pictureOffset,
  recordHistory,
  removeHistoryEntry,
  resolveActiveId,
  resolveAutoplay,
  resolveEndedAction,
  resolveEscape,
  resolveFontStack,
  resolveShortcut,
  resolveStoredFont,
  resumePosition,
  shortcutKeys,
  snapSpeed,
  stepSpeed,
  tipShift,
  tooltipPlacement,
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

  it("treats a missing font choice as unset", () => {
    expect(getInitialString(fakeStore(), STORAGE_KEYS.uiFont)).toBe("");
    expect(getInitialString(fakeStore(), STORAGE_KEYS.monoFont)).toBe("");
    expect(getInitialString(fakeStore({ [STORAGE_KEYS.monoFont]: "Cascadia Code" }), STORAGE_KEYS.monoFont)).toBe("Cascadia Code");
  });
});

describe("font choices", () => {
  it("leaves the default stacks untouched when nothing is chosen", () => {
    expect(resolveFontStack("", DEFAULT_SANS_STACK)).toBe(DEFAULT_SANS_STACK);
    expect(resolveFontStack("   ", DEFAULT_MONO_STACK)).toBe(DEFAULT_MONO_STACK);
  });

  it("puts the chosen family first with the stock stack as its fallback", () => {
    expect(resolveFontStack("Cascadia Code", DEFAULT_MONO_STACK)).toBe(
      `"Cascadia Code", ${DEFAULT_MONO_STACK}`,
    );
  });

  it("trims whitespace around a stored family", () => {
    expect(resolveFontStack("  Segoe UI  ", DEFAULT_SANS_STACK)).toBe(`"Segoe UI", ${DEFAULT_SANS_STACK}`);
  });

  it("escapes quote characters instead of breaking the CSS value", () => {
    expect(resolveFontStack('a"b\\c', DEFAULT_MONO_STACK)).toBe(`"a\\"b\\\\c", ${DEFAULT_MONO_STACK}`);
  });

  it("keeps a stored choice the system still has", () => {
    expect(resolveStoredFont("Cascadia Code", ["Arial", "Cascadia Code"])).toBe("Cascadia Code");
  });

  it("drops a stored choice the system has lost", () => {
    expect(resolveStoredFont("Gone Sans", ["Arial"])).toBe("");
    expect(resolveStoredFont("", ["Arial"])).toBe("");
  });

  it("matches family names exactly", () => {
    // The dropdown offers the OS's own spelling; a near-miss is a different font.
    expect(resolveStoredFont("cascadia code", ["Cascadia Code"])).toBe("");
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

describe("mediaKind", () => {
  it("calls a probed item without video dimensions audio", () => {
    expect(mediaKind({ width: 0, height: 0 })).toBe("audio");
  });

  it("calls an item with video dimensions a video", () => {
    expect(mediaKind({ width: 1920, height: 1080 })).toBe("video");
  });

  it("keeps unprobed items labelled as video", () => {
    expect(mediaKind({})).toBe("video");
    expect(mediaKind({ width: 1920 })).toBe("video");
  });
});

describe("resolveAutoplay", () => {
  it("keeps the item restored at launch paused", () => {
    expect(resolveAutoplay("a", "a")).toEqual({ autoplay: false, launchId: "a" });
  });

  it("plays a user-chosen item and spends the launch exception", () => {
    expect(resolveAutoplay("a", "b")).toEqual({ autoplay: true, launchId: null });
  });

  it("plays the launch item again once the exception is spent", () => {
    expect(resolveAutoplay(null, "a")).toEqual({ autoplay: true, launchId: null });
  });

  it("plays every load when nothing was restored", () => {
    expect(resolveAutoplay(null, "b")).toEqual({ autoplay: true, launchId: null });
    expect(resolveAutoplay(null, null)).toEqual({ autoplay: true, launchId: null });
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

describe("snapSpeed", () => {
  it("leaves preset rates untouched", () => {
    for (const step of SPEED_STEPS) expect(snapSpeed(step)).toBe(step);
  });

  it("snaps an off-ladder rate to the nearest preset", () => {
    expect(snapSpeed(1.1)).toBe(1);
    expect(snapSpeed(1.15)).toBe(1.25);
    expect(snapSpeed(0.6)).toBe(0.5);
  });

  it("clamps rates outside the ladder to the ends", () => {
    expect(snapSpeed(9)).toBe(SPEED_STEPS[SPEED_STEPS.length - 1]);
    expect(snapSpeed(0.01)).toBe(SPEED_STEPS[0]);
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

describe("platform-specific shortcut list", () => {
  it("uses cmd on macOS and alt on Windows/Linux for track and speed", () => {
    expect(shortcutKeys("track", "mac")).toEqual(["⌘", "← / →"]);
    expect(shortcutKeys("speed", "mac")).toEqual(["⌘", "↑ / ↓"]);
    expect(shortcutKeys("track", "windows")).toEqual(["Alt", "← / →"]);
    expect(shortcutKeys("speed", "linux")).toEqual(["Alt", "↑ / ↓"]);
  });

  it("uses cmd on macOS and ctrl elsewhere for panels", () => {
    expect(shortcutKeys("settings", "mac")).toEqual(["⌘", ","]);
    expect(shortcutKeys("playlist", "mac")).toEqual(["⌘", "P"]);
    expect(shortcutKeys("settings", "windows")).toEqual(["Ctrl", ","]);
    expect(shortcutKeys("playlist", "linux")).toEqual(["Ctrl", "P"]);
  });

  it("renders the same modifier-free keys on every platform", () => {
    for (const platform of ["mac", "windows", "linux"] as const) {
      expect(shortcutKeys("playPause", platform)).toEqual(["Space"]);
      expect(shortcutKeys("seek", platform)).toEqual(["←", "→"]);
      expect(shortcutKeys("volume", platform)).toEqual(["↑", "↓"]);
      expect(shortcutKeys("fullscreen", platform)).toEqual(["Enter"]);
    }
  });

  // Every row must map to a binding that resolveShortcut actually implements.
  it("lists exactly one binding per row and never an empty one", () => {
    for (const platform of ["mac", "windows", "linux"] as const) {
      for (const id of SHORTCUT_ORDER) {
        const keys = shortcutKeys(id, platform);
        expect(keys.length).toBeGreaterThan(0);
        expect(keys.every((key) => key.length > 0)).toBe(true);
      }
    }
  });

  it("never advertises the other platform's modifier", () => {
    for (const id of SHORTCUT_ORDER) {
      expect(shortcutKeys(id, "mac")).not.toContain("Alt");
      expect(shortcutKeys(id, "mac")).not.toContain("Ctrl");
      for (const platform of ["windows", "linux"] as const) {
        expect(shortcutKeys(id, platform)).not.toContain("⌘");
      }
    }
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

describe("hold-to-scan on the arrow keys", () => {
  it("scans slowly backwards and fast forwards", () => {
    expect(holdSpeed(-1)).toBe(HOLD_SPEED_BACK);
    expect(holdSpeed(1)).toBe(HOLD_SPEED_FORWARD);
    expect(holdSpeed(-1)).toBeLessThan(1);
    expect(holdSpeed(1)).toBeGreaterThan(1);
  });

  it("maps only the left and right arrows", () => {
    expect(arrowSeekAmount("ArrowLeft")).toBe(-1);
    expect(arrowSeekAmount("ArrowRight")).toBe(1);
    expect(arrowSeekAmount("ArrowUp")).toBeNull();
    expect(arrowSeekAmount(" ")).toBeNull();
  });

  // The hold is a gesture on the seek binding, not a separate key: a pressed
  // arrow still resolves to a seek, which is what the settings row advertises.
  it("still resolves the plain arrows to seek", () => {
    expect(resolveShortcut({ key: "ArrowRight" }, "windows")).toEqual({ type: "seek", amount: 1 });
    expect(resolveShortcut({ key: "ArrowLeft", shiftKey: true }, "mac")).toEqual({ type: "seek", amount: -1 });
  });

  it("seeks when the key comes up before the delay", () => {
    const pressed = advanceSeekHold(null, { type: "press", amount: 1, repeat: false });
    expect(pressed).toEqual({ state: { amount: 1, scanning: false }, step: { type: "arm" } });
    expect(advanceSeekHold(pressed.state, { type: "release", amount: 1 })).toEqual({
      state: null,
      step: { type: "seek", amount: 1 },
    });
  });

  it("scans once the delay elapses and restores on release", () => {
    const pressed = advanceSeekHold(null, { type: "press", amount: -1, repeat: false });
    const elapsed = advanceSeekHold(pressed.state, { type: "elapsed" });
    expect(elapsed.state).toEqual({ amount: -1, scanning: true });
    expect(elapsed.step).toEqual({ type: "scan", rate: HOLD_SPEED_BACK });
    expect(advanceSeekHold(elapsed.state, { type: "release", amount: -1 })).toEqual({
      state: null,
      step: { type: "end" },
    });
  });

  it("drops auto-repeat instead of restarting the gesture", () => {
    const pressed = advanceSeekHold(null, { type: "press", amount: 1, repeat: false });
    const repeated = advanceSeekHold(pressed.state, { type: "press", amount: 1, repeat: true });
    expect(repeated).toEqual({ state: pressed.state, step: { type: "ignore" } });
    // The press that started it still scans when the delay elapses.
    expect(advanceSeekHold(repeated.state, { type: "elapsed" }).step).toEqual({ type: "scan", rate: 2 });
  });

  it("leaves the gesture with the key that started it", () => {
    const pressed = advanceSeekHold(null, { type: "press", amount: 1, repeat: false });
    const otherKey = advanceSeekHold(pressed.state, { type: "release", amount: -1 });
    expect(otherKey).toEqual({ state: pressed.state, step: { type: "ignore" } });
    expect(advanceSeekHold(otherKey.state, { type: "press", amount: -1, repeat: false })).toEqual({
      state: pressed.state,
      step: { type: "ignore" },
    });
  });

  it("ends a scan when the window loses focus, without seeking", () => {
    const pending = advanceSeekHold(null, { type: "press", amount: 1, repeat: false }).state;
    const scanning = advanceSeekHold(pending, { type: "elapsed" }).state;
    expect(advanceSeekHold(pending, { type: "cancel" })).toEqual({ state: null, step: { type: "end" } });
    expect(advanceSeekHold(scanning, { type: "cancel" })).toEqual({ state: null, step: { type: "end" } });
    expect(advanceSeekHold(null, { type: "cancel" })).toEqual({ state: null, step: { type: "ignore" } });
  });

  it("ignores events no press started", () => {
    expect(advanceSeekHold(null, { type: "release", amount: 1 })).toEqual({ state: null, step: { type: "ignore" } });
    expect(advanceSeekHold(null, { type: "elapsed" })).toEqual({ state: null, step: { type: "ignore" } });
  });

  it("waits long enough to tap and not long enough to feel stuck", () => {
    expect(HOLD_SPEED_DELAY_MS).toBeGreaterThanOrEqual(200);
    expect(HOLD_SPEED_DELAY_MS).toBeLessThanOrEqual(500);
  });
});

describe("resolveEscape precedence", () => {
  it("closes the update dialog before anything behind it", () => {
    expect(resolveEscape("settings", true, true)).toEqual({ handled: true, closeDialog: true });
    expect(resolveEscape("playlist", true, true)).toEqual({ handled: true, closeDialog: true });
    // Nothing else open: the dialog still wins, so fullscreen stays.
    expect(resolveEscape(null, true, true)).toEqual({ handled: true, closeDialog: true });
  });

  it("closes the settings panel first", () => {
    expect(resolveEscape("settings", true, false)).toEqual({ handled: true, close: "settings" });
  });

  it("closes the playlist next", () => {
    expect(resolveEscape("playlist", true, false)).toEqual({ handled: true, close: "playlist" });
  });

  it("only exits fullscreen when no panel is open", () => {
    expect(resolveEscape(null, true, false)).toEqual({ handled: true, exitFullscreen: true });
  });

  it("does nothing when nothing is open", () => {
    expect(resolveEscape(null, false, false)).toEqual({ handled: false });
  });

  // Both panels share one slot, so settings and playlist cannot be open at the
  // same time; the ordering in the spec is not independently observable here.
  it("prefers closing a panel over leaving fullscreen", () => {
    const settings = resolveEscape("settings", true, false);
    expect("close" in settings && settings.close).toBe("settings");
  });
});

describe("preview builds are opt-in", () => {
  it("recognises a SemVer prerelease", () => {
    expect(isPreviewVersion("0.1.0-alpha.2")).toBe(true);
    expect(isPreviewVersion("1.2.3-beta")).toBe(true);
    expect(isPreviewVersion("2.0.0-rc.1")).toBe(true);
    expect(isPreviewVersion("v0.1.0-alpha.2")).toBe(true);
  });

  it("treats a plain release as stable", () => {
    expect(isPreviewVersion("0.1.0")).toBe(false);
    expect(isPreviewVersion("1.2.3")).toBe(false);
    expect(isPreviewVersion("v1.2.3")).toBe(false);
  });

  it("ignores build metadata", () => {
    expect(isPreviewVersion("1.2.3+build.7")).toBe(false);
    expect(isPreviewVersion("1.2.3-rc.1+build.7")).toBe(true);
  });

  it("does not mistake junk for a preview", () => {
    expect(isPreviewVersion("")).toBe(false);
    expect(isPreviewVersion("1.2.3-")).toBe(false);
  });

  it("withholds a preview until it is opted into", () => {
    expect(acceptsUpdate("0.1.0-alpha.2", false)).toBe(false);
    expect(acceptsUpdate("0.1.0-alpha.2", true)).toBe(true);
  });

  it("always offers a stable release", () => {
    expect(acceptsUpdate("0.1.0", false)).toBe(true);
    expect(acceptsUpdate("2.0.0", false)).toBe(true);
  });

  it("defaults to off, so a stable install is never moved onto a preview", () => {
    expect(getInitialBoolean(fakeStore(), STORAGE_KEYS.previewUpdates, false)).toBe(false);
    expect(getInitialBoolean(fakeStore({ [STORAGE_KEYS.previewUpdates]: "true" }), STORAGE_KEYS.previewUpdates, false)).toBe(true);
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

describe("isTextTruncated", () => {
  it("is false while the label exactly fits its box", () => {
    expect(isTextTruncated(120, 120)).toBe(false);
    expect(isTextTruncated(0, 0)).toBe(false);
  });

  it("is true once the content overflows the visible box", () => {
    expect(isTextTruncated(121, 120)).toBe(true);
    expect(isTextTruncated(2000, 40)).toBe(true);
  });

  it("never fires when the box is wider than the content", () => {
    expect(isTextTruncated(50, 200)).toBe(false);
  });
});

describe("tooltipPlacement", () => {
  it("opens over labels that have room above them", () => {
    expect(tooltipPlacement(120)).toBe("above");
    expect(tooltipPlacement(TOOLTIP_FLIP_PX)).toBe("above");
  });

  it("flips below labels that hug the window top", () => {
    expect(tooltipPlacement(0)).toBe("below");
    expect(tooltipPlacement(12)).toBe("below");
    expect(tooltipPlacement(TOOLTIP_FLIP_PX - 1)).toBe("below");
  });
});

describe("tipShift", () => {
  it("keeps the bubble centred while there is room on both sides", () => {
    expect(tipShift(400, 200, 800)).toBe(400);
  });

  it("slides the bubble inward near the left edge", () => {
    expect(tipShift(40, 200, 800)).toBe(108);
  });

  it("slides inward near the right edge", () => {
    expect(tipShift(760, 200, 800)).toBe(692);
  });

  it("keeps even the smallest bubble inside the margin", () => {
    expect(tipShift(6, 300, 800)).toBe(158);
  });

  it("never pushes the bubble off the far edge on a tiny window", () => {
    expect(tipShift(20, 260, 280)).toBe(138);
  });
});

describe("watch history", () => {
  const entry = (id: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
    id,
    name: `${id}.mp4`,
    path: `/videos/${id}.mp4`,
    source: `asset://localhost/${id}.mp4`,
    position: 30,
    duration: 100,
    updatedAt: 1,
    ...overrides,
  });

  it("parses a stored array", () => {
    const list = parseHistory(JSON.stringify([entry("a"), entry("b")]));
    expect(list.map((item) => item.id)).toEqual(["a", "b"]);
  });

  // The earlier format kept only one entry; an upgrade must not lose it.
  it("upgrades the previous single-entry format", () => {
    const legacy = JSON.stringify({ id: "old", name: "Old", position: 12, updatedAt: 5 });
    const list = parseHistory(legacy);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("old");
    expect(list[0].position).toBe(12);
  });

  it("rejects malformed entries and input", () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory("nope")).toEqual([]);
    expect(parseHistory(JSON.stringify([{ id: "a", position: -5 }, { position: 3 }, null]))).toEqual([]);
  });

  it("caps the list at the limit", () => {
    const many = Array.from({ length: HISTORY_LIMIT + 20 }, (_, i) => entry(`id-${i}`));
    expect(parseHistory(JSON.stringify(many))).toHaveLength(HISTORY_LIMIT);
  });

  it("records newest first and replaces an earlier visit", () => {
    const list = recordHistory([entry("a"), entry("b")], entry("b", { position: 70 }));
    expect(list.map((item) => item.id)).toEqual(["b", "a"]);
    expect(list[0].position).toBe(70);
  });

  it("drops the oldest entry past the limit", () => {
    const list = recordHistory([entry("a"), entry("b")], entry("c"), 2);
    expect(list.map((item) => item.id)).toEqual(["c", "a"]);
  });

  it("removes a single entry and leaves the rest in order", () => {
    const list = [entry("a"), entry("b"), entry("c")];
    expect(removeHistoryEntry(list, "b").map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("removing an unknown id leaves the list untouched", () => {
    const list = [entry("a")];
    expect(removeHistoryEntry(list, "missing")).toHaveLength(1);
  });

  // Removing the entry the player resumed from must not resurface the position.
  it("a removed entry no longer resumes", () => {
    const list = removeHistoryEntry([entry("a"), entry("b")], "a");
    expect(resumePosition(list, "a", 100)).toBe(0);
  });

  it("resumes only for the matching, unfinished item", () => {
    const list = [entry("a"), entry("b", { position: 40 })];
    expect(resumePosition(list, "a", 100)).toBe(30);
    expect(resumePosition(list, "b", 100)).toBe(40);
    expect(resumePosition(list, "missing", 100)).toBe(0);
    expect(resumePosition([], "a", 100)).toBe(0);
  });

  it("does not resume at the very end or without a duration", () => {
    const atEnd = [entry("a", { position: 99 })];
    expect(resumePosition(atEnd, "a", 100)).toBe(0);
    expect(resumePosition([entry("a")], "a", 0)).toBe(0);
    expect(resumePosition([entry("a")], "a", Number.NaN)).toBe(0);
  });

  it("converts a history entry back into a playable item", () => {
    const item = historyToMediaItem(entry("a"));
    expect(item.id).toBe("a");
    expect(item.source).toContain("asset://");
    expect(item).not.toHaveProperty("position");
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

describe("pictureOffset", () => {
  it("lands the letterbox offset on a whole CSS pixel", () => {
    // 1120x631.43 stage — the page's viewport for a 630.29 CSS px client on a
    // 175% display — with a 16:9 video: the picture is 630 CSS px tall, so
    // centring it puts the offset at 0.71 px, the fraction the two compositing
    // passes disagreed about, one device pixel apart, whenever a frosted bar
    // above the picture appeared.
    const page = pictureOffset(1120, 631.43, 1920, 1080)!;
    expect(page.x).toBe(0);
    expect(page.y).toBe(1);
    expect(Number.isInteger(page.y)).toBe(true);
    // Snapping may only ever move the picture by half a CSS pixel.
    expect(Math.abs(page.y - (631.43 - 630) / 2)).toBeLessThanOrEqual(0.5 + 1e-9);

    // The client area is the smaller figure the stage is actually sized to:
    // there the surplus is under half a pixel, so the picture sits flush at the
    // top instead of leaving the gap the page-sized stage produced.
    const client = pictureOffset(1120, 630.286, 1920, 1080)!;
    expect(client.x).toBe(0);
    expect(client.y).toBe(0);
  });

  it("keeps every offset on a whole CSS pixel, within half a pixel of centred", () => {
    const shapes: [number, number][] = [
      [1920, 1080],
      [720, 1280],
      [2560, 1080],
      [1080, 1920],
      [640, 640],
    ];
    const stages: [number, number][] = [
      [1120, 631.43],
      [640, 360],
      [1960, 1103],
      [800, 1200],
      [1120.5, 630.25],
    ];
    for (const [width, height] of shapes) {
      for (const [stageWidth, stageHeight] of stages) {
        const offset = pictureOffset(stageWidth, stageHeight, width, height)!;
        const scale = Math.min(stageWidth / width, stageHeight / height);
        const centredX = (stageWidth - width * scale) / 2;
        const centredY = (stageHeight - height * scale) / 2;

        expect(Number.isInteger(offset.x)).toBe(true);
        expect(Number.isInteger(offset.y)).toBe(true);
        expect(Math.abs(offset.x - centredX)).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(Math.abs(offset.y - centredY)).toBeLessThanOrEqual(0.5 + 1e-9);
        // `contain` never lets the picture leave the stage, so snapping the
        // offsets must not push one of them below zero either.
        expect(offset.x).toBeGreaterThanOrEqual(0);
        expect(offset.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("leaves an offset that is already whole alone", () => {
    // A stage the video fills exactly has nothing to snap.
    expect(pictureOffset(640, 360, 1920, 1080)!.x).toBe(0);
    expect(pictureOffset(640, 360, 1920, 1080)!.y).toBe(0);
    expect(pictureOffset(1120, 630, 1920, 1080)!.y).toBe(0);
  });

  it("rejects unusable input", () => {
    expect(pictureOffset(0, 600, 1920, 1080)).toBeNull();
    expect(pictureOffset(1000, 0, 1920, 1080)).toBeNull();
    expect(pictureOffset(1000, 600, 0, 1080)).toBeNull();
    expect(pictureOffset(1000, 600, 1920, -1080)).toBeNull();
    expect(pictureOffset(Number.NaN, 600, 1920, 1080)).toBeNull();
    expect(pictureOffset(1000, 600, 1920, Number.POSITIVE_INFINITY)).toBeNull();
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

  it("points the About section at an https repository", () => {
    expect(PROJECT.repository.startsWith("https://")).toBe(true);
    expect(PROJECT.name).toBe("mirror");
  });
});
