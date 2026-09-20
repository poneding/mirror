/**
 * Pure, side-effect-free helpers for Mirror.
 *
 * Everything here is deliberately free of DOM/React/Tauri access so it can be
 * unit tested directly. Effects that touch `localStorage`, the video element or
 * the Rust command bridge stay in `App.tsx`.
 */

export type MediaItem = {
  id: string;
  name: string;
  path: string;
  source: string;
  duration: number;
  width?: number;
  height?: number;
};

export type Theme = "dark" | "light" | "system";
export type Language = "zh" | "en";
export type PlaybackMode = "pause" | "playlist" | "single" | "list";
export type Panel = "settings" | "playlist" | null;

export const SUPPORTED_VIDEO_EXTENSIONS = ["mp4", "mkv", "webm", "mov", "avi", "m4v"];

export const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const SEEK_STEP_MIN = 5;
export const SEEK_STEP_MAX = 60;

/** Storage keys, centralised so the Makefile/docs and tests agree on them. */
export const STORAGE_KEYS = {
  theme: "mirror-theme",
  language: "mirror-language",
  playbackMode: "mirror-playback-mode",
  seekStep: "mirror-seek-step",
  speed: "mirror-speed",
  volume: "mirror-volume",
  playlist: "mirror-playlist",
  activeId: "mirror-active",
  autoUpdate: "mirror-auto-update",
  previewUpdates: "mirror-preview-updates",
  autoClearHistory: "mirror-auto-clear-history",
  history: "mirror-history",
  uiFont: "mirror-ui-font",
  monoFont: "mirror-mono-font",
} as const;

/** Minimal read/write surface so tests can pass a fake store instead of jsdom. */
export type KeyValueStore = {
  getItem: (key: string) => string | null;
};

export function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "00:00";
  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Handles both POSIX and Windows separators. */
export function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || "Untitled video";
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) return "";
  return name.slice(index + 1).toLowerCase();
}

export function isSupportedVideo(name: string): boolean {
  const extension = extensionOf(name);
  // A selection without an extension is allowed through; the media element
  // decides whether it can actually be decoded.
  return extension === "" || SUPPORTED_VIDEO_EXTENSIONS.includes(extension);
}

export function getInitialTheme(store: KeyValueStore): Theme {
  const stored = store.getItem(STORAGE_KEYS.theme);
  return stored === "dark" || stored === "light" || stored === "system" ? stored : "dark";
}

/** The default UI face, identical to `--font-sans` in styles.css (a test in
 *  typography.test.ts fails if the two drift apart). */
export const DEFAULT_SANS_STACK =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans", sans-serif';

/** The default counting face, identical to `--font-mono` in styles.css. */
export const DEFAULT_MONO_STACK = 'ui-monospace, "Cascadia Mono", Consolas, SFMono-Regular, Menlo, monospace';

/** Reads a free-form persisted string; a missing key means "not set". */
export function getInitialString(store: KeyValueStore, key: string): string {
  return store.getItem(key) ?? "";
}

/**
 * The CSS `font-family` value for a chosen font.
 *
 * The chosen family goes first and the platform stack follows it, so a missing
 * glyph — or a font uninstalled after the choice was made — falls back to the
 * stock face instead of a serif default. An empty choice is the stack itself.
 */
export function resolveFontStack(chosen: string, fallback: string): string {
  const family = chosen.trim();
  if (!family) return fallback;
  const escaped = family.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}", ${fallback}`;
}

/**
 * Keeps a stored font choice only while the system still has that font.
 *
 * The CSS would fall through to the stock stack for an uninstalled font either
 * way; dropping the stale choice also makes the dropdown tell the truth. Only
 * call this with a list that was actually fetched — an empty fetch (browser
 * preview) must not wipe a valid choice.
 */
export function resolveStoredFont(stored: string, available: string[]): string {
  return stored && available.includes(stored) ? stored : "";
}

export function getInitialLanguage(store: KeyValueStore): Language {
  return store.getItem(STORAGE_KEYS.language) === "en" ? "en" : "zh";
}

export function getInitialPlaybackMode(store: KeyValueStore): PlaybackMode {
  const stored = store.getItem(STORAGE_KEYS.playbackMode);
  return stored === "playlist" || stored === "single" || stored === "list" ? stored : "pause";
}

export function getInitialBoolean(store: KeyValueStore, key: string, fallback: boolean): boolean {
  const stored = store.getItem(key);
  return stored === null ? fallback : stored === "true";
}

/**
 * Reads a persisted number, clamping it into range.
 *
 * A missing key must yield the fallback. Treating `Number(null)` (which is `0`)
 * as a valid value silently forced volume/speed/seekStep to their minimums.
 */
export function getInitialNumber(
  store: KeyValueStore,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const stored = store.getItem(key);
  if (stored === null) return fallback;
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? clamp(parsed, minimum, maximum) : fallback;
}

/** Restores a playlist, dropping entries that cannot outlive a restart. */
export function parseStoredPlaylist(raw: string | null): MediaItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as MediaItem[]).filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.source === "string" &&
        item.source.length > 0 &&
        !item.source.startsWith("blob:"),
    );
  } catch {
    return [];
  }
}

export type MediaKind = "audio" | "video";

/**
 * Whether an item has a picture to show.
 *
 * The media element reports `0 × 0` for a file whose container carries no video
 * track, so a probed item with no dimensions is audio-only. An item that has not
 * been probed yet stays a video: the picker only offers video files, and the
 * label must not claim otherwise before the metadata says so.
 */
export function mediaKind(item: Pick<MediaItem, "width" | "height">): MediaKind {
  return item.width === 0 && item.height === 0 ? "audio" : "video";
}

/**
 * Picks the id that should be active for a playlist.
 *
 * Falls back to the first item when the previous selection is gone, and to
 * `null` when the playlist is empty.
 */
export function resolveActiveId(items: MediaItem[], activeId: string | null): string | null {
  if (items.length === 0) return null;
  if (activeId && items.some((item) => item.id === activeId)) return activeId;
  return items[0].id;
}

/**
 * Decides whether a load should start playing.
 *
 * The item that was active when the app opened must stay paused: launching
 * Mirror is not a request to play. Every later load comes from something the
 * user did — adding a file, picking a row, moving to the next track — so it
 * plays. The exception is spent once another item loads, which is why the
 * returned `launchId` is kept for the next call.
 */
export type AutoplayDecision = { autoplay: boolean; launchId: string | null };

export function resolveAutoplay(launchId: string | null, activeId: string | null): AutoplayDecision {
  if (launchId !== null && launchId === activeId) return { autoplay: false, launchId };
  return { autoplay: true, launchId: null };
}

/** Wraps around in both directions, so prev at index 0 lands on the last item. */
export function nextIndex(current: number, length: number, direction: 1 | -1): number {
  if (length <= 0) return 0;
  return (current + direction + length) % length;
}

export function stepSpeed(current: number, direction: 1 | -1): number {
  const index = SPEED_STEPS.indexOf(current);
  const next = nextIndex(index === -1 ? 2 : index, SPEED_STEPS.length, direction);
  return SPEED_STEPS[next];
}

/**
 * Snaps an arbitrary rate onto the nearest preset.
 *
 * The speed control is a fixed list, so a value that is not on the ladder (a
 * hand-edited or legacy stored number) would have no matching entry to display.
 */
export function snapSpeed(value: number): number {
  return SPEED_STEPS.reduce(
    (best, step) => (Math.abs(step - value) < Math.abs(best - value) ? step : best),
    SPEED_STEPS[0],
  );
}

export type EndedAction =
  | { kind: "repeat" }
  | { kind: "advance"; id: string }
  | { kind: "stop" };

/**
 * Decides what happens when the current track ends.
 *
 * - `single`: replay the same track (handled by the caller resetting time).
 * - `playlist`: advance only while items remain, then stop.
 * - `list`: advance and wrap around forever.
 * - `pause`: stop.
 */
export function resolveEndedAction(
  items: MediaItem[],
  activeId: string | null,
  mode: PlaybackMode,
): EndedAction {
  if (mode === "single") return { kind: "repeat" };

  const current = items.findIndex((item) => item.id === activeId);
  if (current === -1) return { kind: "stop" };

  if (mode === "playlist") {
    const next = current + 1;
    return next < items.length ? { kind: "advance", id: items[next].id } : { kind: "stop" };
  }

  if (mode === "list" && items.length > 0) {
    return { kind: "advance", id: items[nextIndex(current, items.length, 1)].id };
  }

  return { kind: "stop" };
}

export type Platform = "mac" | "windows" | "linux";

export function detectPlatform(userAgent: string, platform: string): Platform {
  const probe = `${platform} ${userAgent}`;
  if (/Mac|iPhone|iPad|iPod/i.test(probe)) return "mac";
  if (/Win/i.test(probe)) return "windows";
  return "linux";
}

export type ShortcutCommand =
  | { type: "escape" }
  | { type: "toggle-play" }
  | { type: "seek"; amount: 1 | -1 }
  | { type: "volume"; amount: 1 | -1 }
  | { type: "track"; direction: 1 | -1 }
  | { type: "speed"; direction: 1 | -1 }
  | { type: "fullscreen" }
  | { type: "panel"; panel: Exclude<Panel, null> };

/**
 * Shortcut rows shown in settings.
 *
 * Settings lists only the bindings that apply to the platform Mirror is running
 * on, so the keys shown always match the keys that actually work.
 */
export type ShortcutId =
  | "playPause"
  | "seek"
  | "volume"
  | "track"
  | "speed"
  | "fullscreen"
  | "settings"
  | "playlist"
  | "closePanel";

export const SHORTCUT_ORDER: ShortcutId[] = [
  "playPause",
  "seek",
  "volume",
  "track",
  "speed",
  "fullscreen",
  "settings",
  "playlist",
  "closePanel",
];

/** Display keys for one shortcut on the given platform. */
export function shortcutKeys(id: ShortcutId, platform: Platform): string[] {
  const isMac = platform === "mac";
  switch (id) {
    case "playPause":
      return ["Space"];
    case "seek":
      return ["←", "→"];
    case "volume":
      return ["↑", "↓"];
    case "track":
      return isMac ? ["⌘", "← / →"] : ["Alt", "← / →"];
    case "speed":
      return isMac ? ["⌘", "↑ / ↓"] : ["Alt", "↑ / ↓"];
    case "fullscreen":
      return ["Enter"];
    case "settings":
      return isMac ? ["⌘", ","] : ["Ctrl", ","];
    case "playlist":
      return isMac ? ["⌘", "P"] : ["Ctrl", "P"];
    case "closePanel":
      return ["Esc"];
  }
}

export type ShortcutKeyEvent = {
  key: string;
  code?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

/** Momentary rates a held arrow key scans at: ← slows the picture, → speeds it up. */
export const HOLD_SPEED_BACK = 0.25;
export const HOLD_SPEED_FORWARD = 2;

/** How long an arrow stays down before the tap becomes a scan, in milliseconds. */
export const HOLD_SPEED_DELAY_MS = 300;

/** The rate a held arrow scans at. */
export function holdSpeed(amount: 1 | -1): number {
  return amount === 1 ? HOLD_SPEED_FORWARD : HOLD_SPEED_BACK;
}

/** The seek direction an arrow key carries; `null` for any other key. */
export function arrowSeekAmount(key: string): 1 | -1 | null {
  if (key === "ArrowRight") return 1;
  if (key === "ArrowLeft") return -1;
  return null;
}

/**
 * The hold-to-scan gesture on the plain arrow keys.
 *
 * A tap still seeks; holding past `HOLD_SPEED_DELAY_MS` turns the same key into
 * a momentary scan at `holdSpeed`, and the chosen rate comes back on release.
 * The gesture lives here so the tap/hold split, the auto-repeat stream and a
 * release of the other arrow are decided in one testable place; `App.tsx` only
 * runs the timer and writes the video's `playbackRate`.
 */
export type SeekHoldState = { amount: 1 | -1; scanning: boolean } | null;

export type SeekHoldEvent =
  | { type: "press"; amount: 1 | -1; repeat: boolean }
  | { type: "release"; amount: 1 | -1 }
  | { type: "elapsed" }
  | { type: "cancel" };

export type SeekHoldStep =
  | { type: "arm" }
  | { type: "scan"; rate: number }
  | { type: "seek"; amount: 1 | -1 }
  | { type: "end" }
  | { type: "ignore" };

/**
 * Advances the gesture.
 *
 * The returned `step` is the one thing the caller owes the player: start the
 * hold timer, apply the scan rate, seek, or restore the chosen rate. The key
 * that went down owns the gesture, so auto-repeat and the other arrow are
 * dropped instead of restarting it.
 */
export function advanceSeekHold(
  state: SeekHoldState,
  event: SeekHoldEvent,
): { state: SeekHoldState; step: SeekHoldStep } {
  switch (event.type) {
    case "press":
      if (state || event.repeat) return { state, step: { type: "ignore" } };
      return { state: { amount: event.amount, scanning: false }, step: { type: "arm" } };
    case "elapsed":
      if (!state || state.scanning) return { state, step: { type: "ignore" } };
      return {
        state: { amount: state.amount, scanning: true },
        step: { type: "scan", rate: holdSpeed(state.amount) },
      };
    case "release":
      if (!state || state.amount !== event.amount) return { state, step: { type: "ignore" } };
      return {
        state: null,
        step: state.scanning ? { type: "end" } : { type: "seek", amount: state.amount },
      };
    case "cancel":
      return { state: null, step: state ? { type: "end" } : { type: "ignore" } };
  }
}

/**
 * Maps a key event to a player command, applying the platform-specific
 * modifier layout:
 *
 *   macOS          cmd + arrows  -> prev/next, cmd + up/down -> speed
 *   Windows/Linux  alt + arrows  -> prev/next, alt + up/down -> speed
 *
 * Returns `null` for anything that is not a Mirror shortcut, so the caller can
 * leave the event alone.
 */
export function resolveShortcut(
  event: ShortcutKeyEvent,
  platform: Platform,
): ShortcutCommand | null {
  const command = platform === "mac" ? Boolean(event.metaKey) : Boolean(event.ctrlKey);
  const trackModifier = platform === "mac" ? Boolean(event.metaKey) : Boolean(event.altKey);
  const speedModifier = trackModifier;

  if (event.key === "Escape") return { type: "escape" };

  if (event.key === " " || event.code === "Space") return { type: "toggle-play" };

  if (event.key === "Enter") return { type: "fullscreen" };

  if (trackModifier) {
    if (event.key === "ArrowRight") return { type: "track", direction: 1 };
    if (event.key === "ArrowLeft") return { type: "track", direction: -1 };
    if (speedModifier && event.key === "ArrowUp") return { type: "speed", direction: 1 };
    if (speedModifier && event.key === "ArrowDown") return { type: "speed", direction: -1 };
  }

  const seekAmount = arrowSeekAmount(event.key);
  if (seekAmount !== null) return { type: "seek", amount: seekAmount };
  if (event.key === "ArrowUp") return { type: "volume", amount: 1 };
  if (event.key === "ArrowDown") return { type: "volume", amount: -1 };

  if (command && event.key === ",") return { type: "panel", panel: "settings" };
  if (command && event.key.toLowerCase() === "p") return { type: "panel", panel: "playlist" };

  return null;
}

export type EscapeOutcome =
  | { handled: true; close: Exclude<Panel, null> }
  | { handled: true; closeDialog: true }
  | { handled: true; exitFullscreen: true }
  | { handled: false };

/**
 * Escape precedence: update dialog, settings panel, playlist panel, fullscreen.
 *
 * The dialog is a modal on top of everything, so it takes Escape first; without
 * that, Escape would close a panel behind it and leave the dialog up.
 *
 * The settings-before-playlist ordering is stated by the product spec. Mirror
 * renders both panels into a single slot, so at most one is ever open; the
 * ordering is therefore equivalent in practice and kept for clarity and in case
 * the panels ever become independent.
 */
export function resolveEscape(panel: Panel, isFullscreen: boolean, dialogOpen: boolean): EscapeOutcome {
  if (dialogOpen) return { handled: true, closeDialog: true };
  if (panel === "settings") return { handled: true, close: "settings" };
  if (panel === "playlist") return { handled: true, close: "playlist" };
  if (isFullscreen) return { handled: true, exitFullscreen: true };
  return { handled: false };
}

/** Where the keyboard event came from matters: never hijack text entry. */
export function isTypingTarget(tagName: string): boolean {
  return tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA";
}

/** One entry in the watch history: enough to resume and to list it. */
export type HistoryEntry = {
  id: string;
  name: string;
  path: string;
  source: string;
  position: number;
  duration: number;
  updatedAt: number;
};

/** Most recent entries kept; older ones fall off the end. */
export const HISTORY_LIMIT = 60;

function toHistoryEntry(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<HistoryEntry>;
  if (typeof entry.id !== "string" || typeof entry.position !== "number") return null;
  if (!Number.isFinite(entry.position) || entry.position < 0) return null;
  return {
    id: entry.id,
    name: typeof entry.name === "string" ? entry.name : "",
    path: typeof entry.path === "string" ? entry.path : "",
    source: typeof entry.source === "string" ? entry.source : "",
    position: entry.position,
    duration: typeof entry.duration === "number" && Number.isFinite(entry.duration) ? entry.duration : 0,
    updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0,
  };
}

/**
 * Reads the watch history.
 *
 * Accepts both the current array form and the earlier single-entry object, so an
 * existing profile upgrades without losing its resume point.
 */
export function parseHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map(toHistoryEntry)
        .filter((entry): entry is HistoryEntry => entry !== null)
        .slice(0, HISTORY_LIMIT);
    }
    const single = toHistoryEntry(parsed);
    return single ? [single] : [];
  } catch {
    return [];
  }
}

/** Moves an entry to the front, replacing any earlier visit to the same item. */
export function recordHistory(
  list: HistoryEntry[],
  entry: HistoryEntry,
  limit: number = HISTORY_LIMIT,
): HistoryEntry[] {
  return [entry, ...list.filter((item) => item.id !== entry.id)].slice(0, limit);
}

/** Drops a single entry, for removing one item without clearing the list. */
export function removeHistoryEntry(list: HistoryEntry[], id: string): HistoryEntry[] {
  return list.filter((entry) => entry.id !== id);
}

/**
 * Resumes a saved position only when it still makes sense for this item and it
 * is not effectively at the end of the video.
 */
export function resumePosition(list: HistoryEntry[], activeId: string | null, duration: number): number {
  if (!activeId) return 0;
  const entry = list.find((item) => item.id === activeId);
  if (!entry) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (entry.position >= duration - 2) return 0;
  return entry.position;
}

/** Promotes a history entry back into a playable playlist item. */
export function historyToMediaItem(entry: HistoryEntry): MediaItem {
  return {
    id: entry.id,
    name: entry.name,
    path: entry.path,
    source: entry.source,
    duration: entry.duration,
  };
}

/**
 * Project metadata shown in the About section.
 *
 * `repository` is the single place to edit once the public repository exists.
 */
export const PROJECT = {
  name: "mirror",
  repository: "https://github.com/poneding/mirror",
};

/** Shown when the native version lookup is unavailable (browser preview). */
export const FALLBACK_VERSION = "0.1.0";

/**
 * Whether a release is a preview build (alpha, beta, rc).
 *
 * Preview builds are opt-in, so this looks at the version SemVer itself, not at
 * any release flag on the hosting side: `0.1.0-alpha.2` is a preview wherever it
 * was published from, and the trailing `+build` metadata never makes one.
 */
export function isPreviewVersion(version: string): boolean {
  const withoutBuild = version.trim().replace(/^v/, "").split("+")[0];
  const dash = withoutBuild.indexOf("-");
  return dash >= 0 && withoutBuild.slice(dash + 1).length > 0;
}

/**
 * Whether an offered release may be installed.
 *
 * Preview builds are opt-in, so a user on a stable version is never moved onto
 * an alpha by the updater. The dialog reports a withheld preview instead of
 * hiding it, so the choice stays visible rather than looking like "up to date".
 */
export function acceptsUpdate(remoteVersion: string, allowPreview: boolean): boolean {
  return allowPreview || !isPreviewVersion(remoteVersion);
}

/** Max chrome opacity timer while playing. */
export const CHROME_HIDE_DELAY_MS = 2800;

/** How long the transient status indicator stays on screen. */
export const OSD_DURATION_MS = 1000;

export const HISTORY_WRITE_INTERVAL_MS = 4000;

/** Initial window size target, and the bounds the aspect fitter respects. */
export const WINDOW_FIT: {
  targetWidth: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
} = {
  targetWidth: 1120,
  minWidth: 640,
  minHeight: 360,
  maxWidth: 1920,
  maxHeight: 1200,
};

export type WindowSize = { width: number; height: number };

/**
 * Computes the window size that matches a video's aspect ratio.
 *
 * The aspect ratio is authoritative: the window must always match the picture
 * shape. Scale is therefore applied uniformly, and constraints only ever change
 * the overall size, never one axis on its own.
 *
 * Rules, in order:
 *   1. Start at the target width and derive the height from the video aspect.
 *   2. Grow uniformly to satisfy the minimums when the maximums still allow it.
 *   3. Never exceed the maximums; for ratios too extreme to satisfy both, the
 *      maximums win so the window still fits on screen.
 *
 * Clamping the axes independently (as `Math.max(width, min)` per axis does)
 * silently distorts the picture shape for extreme ratios such as 32:9 or tall
 * portrait video.
 *
 * Mirrors `resize_to_video` in `src-tauri/src/lib.rs`; both are covered by
 * tests so the native and preview paths stay in agreement.
 */
export function fitWindowToVideo(videoWidth: number, videoHeight: number): WindowSize | null {
  if (!Number.isFinite(videoWidth) || !Number.isFinite(videoHeight)) return null;
  if (videoWidth <= 0 || videoHeight <= 0) return null;

  const aspect = videoWidth / videoHeight;

  let width = WINDOW_FIT.targetWidth;
  let height = width / aspect;

  // Grow uniformly to honour the minimums, but only as far as the maximums allow.
  const growToMinimum = Math.max(
    WINDOW_FIT.minWidth / width,
    WINDOW_FIT.minHeight / height,
    1,
  );
  const growthAllowed = Math.min(
    WINDOW_FIT.maxWidth / width,
    WINDOW_FIT.maxHeight / height,
  );
  const growth = Math.min(growToMinimum, growthAllowed);

  width *= growth;
  height *= growth;

  return { width, height };
}
