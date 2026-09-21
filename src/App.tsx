import {
  Check,
  ChevronDown,
  Command,
  Download,
  FileVideo,
  FolderOpen,
  FolderPlus,
  History,
  Info,
  List,
  ListVideo,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Palette,
  Pin,
  PinOff,
  Play,
  Plus,
  Repeat2,
  RefreshCw,
  Settings2,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Square,
  Trash2,
  Upload,
  Volume1,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { ChangeEvent, type CSSProperties, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CHROME_HIDE_DELAY_MS,
  FALLBACK_VERSION,
  HISTORY_WRITE_INTERVAL_MS,
  HOLD_SPEED_DELAY_MS,
  OSD_DURATION_MS,
  PROJECT,
  SHORTCUT_ORDER,
  SPEED_STEPS,
  type Language,
  type MediaItem,
  type Panel,
  type PlaybackMode,
  STORAGE_KEYS,
  SUPPORTED_VIDEO_EXTENSIONS,
  TOOLTIP_DELAY_MS,
  type Theme,
  type HistoryEntry,
  acceptsUpdate,
  advanceSeekHold,
  arrowSeekAmount,
  clamp,
  detectPlatform,
  fileNameFromPath,
  formatTime,
  getInitialBoolean,
  getInitialLanguage,
  getInitialNumber,
  getInitialPlaybackMode,
  getInitialString,
  getInitialTheme,
  DEFAULT_MONO_STACK,
  DEFAULT_SANS_STACK,
  historyToMediaItem,
  isSupportedVideo,
  isTextTruncated,
  isTypingTarget,
  mediaKind,
  nextIndex,
  parseHistory,
  parseStoredPlaylist,
  pictureOffset,
  type PictureOffset,
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
  type SeekHoldState,
  shortcutKeys,
  snapSpeed,
  stepSpeed,
  tipShift,
  tooltipPlacement,
  type ShortcutId,
} from "./lib/player";
import { type InlineNode, parseMarkdown } from "./lib/markdown";
import logo from "./assets/logo.png";

const isTauri = () => "__TAURI_INTERNALS__" in window;

/**
 * Expands a selection of files and folders into video paths.
 *
 * Only the native side can enumerate a folder, so it answers with every video
 * file under one, however deep it sits; the browser preview keeps the flat list
 * its inputs produced.
 */
async function resolveVideoPaths(paths: string[]): Promise<string[]> {
  if (!isTauri()) return paths;
  return invoke<string[]>("collect_video_paths", {
    paths,
    extensions: SUPPORTED_VIDEO_EXTENSIONS,
  }).catch(() => []);
}

/** Where the update notice is in its lifecycle; `Update` holds the release itself. */
type UpdateStatus = "idle" | "checking" | "current" | "preview" | "installing" | "installed" | "error";

/** The installed fonts the settings dropdowns offer, from `list_system_fonts`. */
type SystemFonts = { families: string[]; monospace: string[] };

/** The settings panel's sections, which the left rail switches between. */
type SettingsSectionId = "appearance" | "playback" | "update" | "shortcuts" | "about";

const copy = {
  zh: {
    add: "添加视频",
    addFolder: "添加视频文件夹",
    openMenu: "打开视频或文件夹",
    openVideo: "打开视频",
    openFolder: "打开文件夹",
    playlist: "播放列表",
    settings: "设置",
    noVideos: "播放列表还是空的",
    noVideosFound: "没有找到视频文件",
    addFirst: "添加一个视频，开始你的第一段播放",
    video: "视频",
    audio: "音频",
    appearance: "外观",
    theme: "主题",
    dark: "深色",
    light: "浅色",
    system: "跟随系统",
    language: "语言",
    uiFont: "界面字体",
    monoFont: "等宽字体",
    fontDefault: "跟随默认",
    playback: "播放",
    seekStep: "快进步长",
    seconds: "秒",
    update: "更新",
    about: "关于",
    version: "版本",
    repository: "仓库",
    playbackMode: "播放结束后",
    pauseAfter: "播完暂停",
    continuePlaylist: "继续播放列表",
    repeatOne: "单项循环",
    repeatList: "列表循环",
    autoUpdate: "自动检查更新",
    previewUpdates: "接收预览版更新",
    clearHistory: "自动清除播放记录",
    checkUpdate: "检查更新",
    checking: "检查中…",
    upToDate: "已是最新版本",
    updateAvailable: "有新版本可用",
    installUpdate: "下载并安装",
    installing: "下载中",
    restartToApply: "更新已安装，重启应用后生效",
    updateFailed: "检查更新失败：",
    viewDetails: "查看详情",
    closeDialog: "关闭弹窗",
    updateDetails: "更新详情",
    previewTag: "预览版",
    previewWithheld: "这是预览版（alpha / beta），当前设置不接收预览版更新。",
    enablePreview: "开启并重新检查",
    currentVersion: "当前版本",
    pinned: "窗口已置顶",
    pinWindow: "置顶窗口",
    shortcuts: "快捷键",
    playPause: "播放 / 暂停",
    seek: "快进 / 快退",
    volume: "调整音量",
    nextPrevious: "上一个 / 下一个",
    speed: "调整倍速",
    fullScreen: "全屏",
    closePanel: "关闭面板",
    playbackSpeed: "倍速",
    muted: "已静音",
    clearHistoryDone: "播放记录已清除",
    clearPlaylistDone: "播放列表已清空",
    history: "历史记录",
    noHistory: "还没有观看记录",
    historyHint: "播放过的视频会出现在这里",
    clearPlaylist: "清空播放列表",
    clearHistoryNow: "清除历史记录",
    removeItem: "移除",
    osdPlay: "播放",
    osdPause: "暂停",
    osdVolume: "音量",
    osdSpeed: "倍速",
    osdMuted: "静音",
    minimize: "最小化",
    maximize: "最大化",
    restore: "向下还原",
    close: "关闭",
  },
  en: {
    add: "Add video",
    addFolder: "Add video folder",
    openMenu: "Open video or folder",
    openVideo: "Open video",
    openFolder: "Open folder",
    playlist: "Playlist",
    settings: "Settings",
    noVideos: "Your playlist is empty",
    noVideosFound: "No videos found",
    addFirst: "Add a video to start your first session",
    video: "Video",
    audio: "Audio",
    appearance: "Appearance",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    system: "System",
    language: "Language",
    uiFont: "Interface font",
    monoFont: "Monospace font",
    fontDefault: "Default",
    playback: "Playback",
    seekStep: "Seek step",
    seconds: "sec",
    update: "Update",
    about: "About",
    version: "Version",
    repository: "Repository",
    playbackMode: "After playback",
    pauseAfter: "Pause",
    continuePlaylist: "Continue playlist",
    repeatOne: "Repeat one",
    repeatList: "Repeat playlist",
    autoUpdate: "Check for updates automatically",
    previewUpdates: "Accept preview builds",
    clearHistory: "Clear watch history automatically",
    checkUpdate: "Check for updates",
    checking: "Checking…",
    upToDate: "You're up to date",
    updateAvailable: "Update available",
    installUpdate: "Download and install",
    installing: "Downloading",
    restartToApply: "Update installed — restart Mirror to apply it",
    updateFailed: "Update check failed: ",
    viewDetails: "View details",
    closeDialog: "Close dialog",
    updateDetails: "Update details",
    previewTag: "Preview",
    previewWithheld: "This is a preview build (alpha / beta), and preview updates are turned off.",
    enablePreview: "Turn on and check again",
    currentVersion: "Current version",
    pinned: "Window pinned",
    pinWindow: "Pin window",
    shortcuts: "Shortcuts",
    playPause: "Play / pause",
    seek: "Seek",
    volume: "Volume",
    nextPrevious: "Previous / next",
    speed: "Playback speed",
    fullScreen: "Fullscreen",
    closePanel: "Close panel",
    playbackSpeed: "Speed",
    muted: "Muted",
    clearHistoryDone: "Watch history cleared",
    clearPlaylistDone: "Playlist cleared",
    history: "History",
    noHistory: "Nothing watched yet",
    historyHint: "Videos you play show up here",
    clearPlaylist: "Clear playlist",
    clearHistoryNow: "Clear history",
    removeItem: "Remove",
    osdPlay: "Play",
    osdPause: "Pause",
    osdVolume: "Volume",
    osdSpeed: "Speed",
    osdMuted: "Muted",
    minimize: "Minimize",
    maximize: "Maximize",
    restore: "Restore",
    close: "Close",
  },
} as const;

/** One language's strings, so components can take the whole table. */
type Copy = (typeof copy)[Language];

const store = { getItem: (key: string) => localStorage.getItem(key) };

/** Picks the volume glyph that matches the current level. */
function volumeIcon(level: number, size: number) {
  if (level === 0) return <VolumeX size={size} />;
  if (level < 0.5) return <Volume1 size={size} />;
  return <Volume2 size={size} />;
}

/**
 * One bubble of the app tooltip: the full label for a truncated name or a
 * hovered button. `anchorCx` is the label's centre and stays the source of
 * truth; `cx` is where the bubble actually sits after tipShift slid it inside
 * the window. `below` flips it under anchors that hug the window top (the
 * titlebar name).
 */
type Tip = { id: string; text: string; anchorCx: number; cx: number; top: number; below: boolean };

/** The handler bundle `tipFor(key, text)` spreads onto buttons and links. */
type TipProps = {
  onMouseEnter: (event: ReactMouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
  onFocus: (event: ReactFocusEvent<HTMLElement>) => void;
  onBlur: () => void;
  "aria-describedby"?: string;
};

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const titlebarNameRef = useRef<HTMLSpanElement>(null);
  const hideChromeTimer = useRef<number | undefined>(undefined);
  const osdTimer = useRef<number | undefined>(undefined);
  const historyWriteAt = useRef(0);
  const holdTimer = useRef<number | undefined>(undefined);
  /** The arrow key that is down, if any: a tap seeks, a hold scans. */
  const seekHold = useRef<SeekHoldState>(null);
  const [items, setItems] = useState<MediaItem[]>(() => parseStoredPlaylist(localStorage.getItem(STORAGE_KEYS.playlist)));
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEYS.activeId));
  /**
   * The selection the app opened with. Its first load stays paused — starting
   * Mirror must not start a restored video on its own — while every later load
   * (adding, picking, next/previous) plays. Cleared once another item loads, so
   * returning to this one later behaves like any other selection.
   */
  const launchIdRef = useRef<string | null>(resolveActiveId(items, activeId));
  const [panel, setPanel] = useState<Panel>(null);
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme(store));
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage(store));
  const [uiFont, setUiFont] = useState(() => getInitialString(store, STORAGE_KEYS.uiFont));
  const [monoFont, setMonoFont] = useState(() => getInitialString(store, STORAGE_KEYS.monoFont));
  /** The system's installed fonts; `null` until the native scan answers. */
  const [systemFonts, setSystemFonts] = useState<SystemFonts | null>(null);
  /** Which settings section the left rail shows; one at a time. */
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>("appearance");
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(() => getInitialPlaybackMode(store));
  const [seekStep, setSeekStep] = useState(() => getInitialNumber(store, STORAGE_KEYS.seekStep, 10, 5, 60));
  const [speed, setSpeed] = useState(() => snapSpeed(getInitialNumber(store, STORAGE_KEYS.speed, 1, 0.25, 2)));
  /** The momentary rate a held arrow is scanning at; `null` when it is not. */
  const [holdRate, setHoldRate] = useState<number | null>(null);
  const [volume, setVolume] = useState(() => getInitialNumber(store, STORAGE_KEYS.volume, 0.8, 0, 1));
  const [isPinned, setIsPinned] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  /** Where the picture sits inside the stage, snapped to whole CSS pixels. */
  const [picture, setPicture] = useState<PictureOffset | null>(null);
  /**
   * The window's client area in CSS pixels — what the window actually shows.
   *
   * The page's viewport is *not* that: WebView2 rounds it up to whole CSS
   * pixels, so a 630.29 CSS px client reports 631.43 and the page is about a
   * CSS pixel taller than the window. Sizing the stage to the client keeps the
   * picture fitted and centred inside the visible area instead of inside the
   * page, which otherwise leaves a gap above the picture and crops its bottom.
   */
  const [clientSize, setClientSize] = useState<{ width: number; height: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [toast, setToast] = useState("");
  const [autoUpdate, setAutoUpdate] = useState(() => getInitialBoolean(store, STORAGE_KEYS.autoUpdate, true));
  const [previewUpdates, setPreviewUpdates] = useState(() => getInitialBoolean(store, STORAGE_KEYS.previewUpdates, false));
  const [autoClearHistory, setAutoClearHistory] = useState(() => getInitialBoolean(store, STORAGE_KEYS.autoClearHistory, false));
  const [isMaximized, setIsMaximized] = useState(false);
  const [osd, setOsd] = useState<{ icon: ReactNode; text: string } | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const tipTimer = useRef<number | undefined>(undefined);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();
  const [appVersion, setAppVersion] = useState(FALLBACK_VERSION);
  const [history, setHistory] = useState<HistoryEntry[]>(() => parseHistory(localStorage.getItem(STORAGE_KEYS.history)));
  const [panelTab, setPanelTab] = useState<"playlist" | "history">("playlist");
  const [available, setAvailable] = useState<Update | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState("");
  /** A preview build the preference withheld, kept so the dialog can say why. */
  const [blockedPreview, setBlockedPreview] = useState<string | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  const platform = useMemo(() => detectPlatform(navigator.userAgent, navigator.platform), []);
  /** macOS keeps its own window-control set; Windows/Linux get maximize too. */
  const showMaximize = platform !== "mac";
  const isMac = platform === "mac";

  /** Shows a brief frosted status indicator for a transient action. */
  const flashOsd = useCallback((icon: ReactNode, text: string) => {
    setOsd({ icon, text });
    window.clearTimeout(osdTimer.current);
    osdTimer.current = window.setTimeout(() => setOsd(null), OSD_DURATION_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(osdTimer.current), []);

  /**
   * The browser preview picks folders through the file input's directory mode.
   * React has no typed prop for the attribute that turns it on, so it is set
   * here rather than cast into the JSX.
   */
  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  // Version comes from the bundle itself, so it never drifts from what shipped.
  useEffect(() => {
    if (!isTauri()) return;
    void getVersion()
      .then(setAppVersion)
      .catch(() => undefined);
  }, []);

  /**
   * Asks the updater whether a newer release exists. The check on launch stays
   * quiet when it fails — Mirror is meant to work offline — while a check the
   * user asked for reports what happened, in the update dialog.
   *
   * `allowPreview` is passed in rather than read from state so a caller can turn
   * the preference on and re-check in the same tick, without the stale closure a
   * captured `previewUpdates` would give it.
   */
  const runUpdateCheck = useCallback(async (manual: boolean, allowPreview: boolean) => {
    if (!isTauri()) return;
    setUpdateStatus("checking");
    setUpdateError("");
    if (manual) setUpdateDialogOpen(true);
    try {
      const found = await check();
      const offered = found !== null && acceptsUpdate(found.version, allowPreview);
      setAvailable(offered ? found : null);
      setBlockedPreview(found !== null && !offered ? found.version : null);
      setUpdateStatus(found === null ? (manual ? "current" : "idle") : offered ? "idle" : "preview");
      // An update worth acting on is worth interrupting for; a check nobody
      // asked for says nothing in any other case.
      if (offered && !manual) setUpdateDialogOpen(true);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : String(error));
      setUpdateStatus(manual ? "error" : "idle");
    }
  }, []);

  /** Turns preview builds on and re-checks, so the withheld release appears. */
  const enablePreviewUpdates = useCallback(() => {
    setPreviewUpdates(true);
    void runUpdateCheck(true, true);
  }, [runUpdateCheck]);

  /** Downloads the pending release and hands it to the OS installer. */
  const installUpdate = useCallback(async () => {
    if (!available) return;
    let total = 0;
    let downloaded = 0;
    setUpdateError("");
    setUpdateProgress(null);
    setUpdateStatus("installing");
    try {
      await available.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            setUpdateProgress(total > 0 ? 0 : null);
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (total > 0) setUpdateProgress(Math.min(downloaded / total, 1));
            break;
          default:
            setUpdateProgress(1);
        }
      });
      setUpdateStatus("installed");
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : String(error));
      setUpdateStatus("error");
    }
  }, [available]);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) || null,
    [activeId, items],
  );
  const activeSource = activeItem?.source ?? null;
  const strings = copy[language];
  const updateBusy = updateStatus === "checking" || updateStatus === "installing";

  /** The settings panel's left rail: one entry per section, in display order. */
  const settingsSections: { id: SettingsSectionId; icon: typeof Palette; label: string }[] = [
    { id: "appearance", icon: Palette, label: strings.appearance },
    { id: "playback", icon: SlidersHorizontal, label: strings.playback },
    { id: "update", icon: RefreshCw, label: strings.update },
    { id: "shortcuts", icon: Command, label: strings.shortcuts },
    { id: "about", icon: Info, label: strings.about },
  ];

  /** What the update notice says; empty means there is nothing to say yet. */
  const updateStatusText = useMemo(() => {
    switch (updateStatus) {
      case "current":
        return strings.upToDate;
      case "installing":
        return updateProgress === null
          ? strings.installing
          : `${strings.installing} ${Math.round(updateProgress * 100)}%`;
      case "installed":
        return strings.restartToApply;
      case "error":
        return `${strings.updateFailed}${updateError}`;
      default:
        return "";
    }
  }, [strings, updateError, updateProgress, updateStatus]);

  // Only the preference and the button start a check, never a render — looking
  // for updates is the user's call, and `autoUpdate` is their answer.
  useEffect(() => {
    if (!autoUpdate) return;
    void runUpdateCheck(false, previewUpdates);
  }, [autoUpdate, previewUpdates, runUpdateCheck]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  }, [theme]);

  // The chosen faces ride the same two tokens the stylesheet defaults use, so
  // every element re-faces at once. The stock stack follows each choice as its
  // fallback for glyphs the chosen font lacks; with no choice the inline
  // override is removed so the stylesheet stays the single source of truth.
  useEffect(() => {
    const root = document.documentElement;
    const applyFace = (property: string, chosen: string, fallback: string) => {
      const stack = resolveFontStack(chosen, fallback);
      if (stack === fallback) root.style.removeProperty(property);
      else root.style.setProperty(property, stack);
    };
    applyFace("--font-sans", uiFont, DEFAULT_SANS_STACK);
    applyFace("--font-mono", monoFont, DEFAULT_MONO_STACK);
    localStorage.setItem(STORAGE_KEYS.uiFont, uiFont);
    localStorage.setItem(STORAGE_KEYS.monoFont, monoFont);
  }, [monoFont, uiFont]);

  // The font list is fetched once per run; the native side caches its scan
  // after the first call. The browser preview cannot enumerate fonts and
  // simply offers the default.
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    void invoke<SystemFonts>("list_system_fonts")
      .then((fonts) => {
        if (!cancelled) setSystemFonts(fonts);
      })
      .catch(() => {
        if (!cancelled) setSystemFonts({ families: [], monospace: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A stored choice survives only while its font is still installed. The CSS
  // would fall through to the stock stack either way; dropping the stale value
  // also keeps the dropdown honest. Runs only with a fetched list, so a
  // preview (or a failed scan) never wipes a valid choice.
  useEffect(() => {
    if (!systemFonts) return;
    setUiFont((current) => resolveStoredFont(current, systemFonts.families));
    setMonoFont((current) => resolveStoredFont(current, systemFonts.monospace));
  }, [systemFonts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.playlist, JSON.stringify(items));
    if (activeId) localStorage.setItem(STORAGE_KEYS.activeId, activeId);
  }, [activeId, items]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.language, language);
    localStorage.setItem(STORAGE_KEYS.playbackMode, playbackMode);
    localStorage.setItem(STORAGE_KEYS.seekStep, String(seekStep));
    localStorage.setItem(STORAGE_KEYS.speed, String(speed));
    localStorage.setItem(STORAGE_KEYS.volume, String(volume));
    localStorage.setItem(STORAGE_KEYS.autoUpdate, String(autoUpdate));
    localStorage.setItem(STORAGE_KEYS.previewUpdates, String(previewUpdates));
    localStorage.setItem(STORAGE_KEYS.autoClearHistory, String(autoClearHistory));
  }, [autoClearHistory, autoUpdate, language, playbackMode, previewUpdates, seekStep, speed, volume]);

  useEffect(() => {
    setActiveId((current) => resolveActiveId(items, current));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  }, [history]);

  // Turning the preference on clears what is already stored, including the
  // in-memory list, so the History tab empties immediately.
  useEffect(() => {
    if (autoClearHistory) setHistory([]);
  }, [autoClearHistory]);


  // Reload only when the selection or its source changes.
  //
  // This deliberately depends on the primitive `activeSource` rather than on
  // `activeItem`: `handleLoadedMetadata` writes the decoded duration/size back
  // into `items`, which changes the `activeItem` object identity on every load.
  // Depending on it would re-run this effect and reload the video in a loop.
  // The real duration arrives via `onLoadedMetadata`.
  useEffect(() => {
    const video = videoRef.current;
    if (!activeSource || !video) return;
    const decision = resolveAutoplay(launchIdRef.current, activeId);
    launchIdRef.current = decision.launchId;
    video.src = activeSource;
    video.load();
    setDuration(0);
    setCurrentTime(0);
    if (decision.autoplay) void video.play().catch(() => setIsPlaying(false));
  }, [activeId, activeSource]);

  /* A held arrow scans at a momentary rate that never touches the chosen speed,
     so the gesture cannot leak into the setting or what it persists. */
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = holdRate ?? speed;
  }, [speed, holdRate, activeId]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume, activeId]);

  useEffect(() => {
    if (!isTauri()) {
      const measure = () => setClientSize({ width: window.innerWidth, height: window.innerHeight });
      measure();
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    const measure = () => {
      void Promise.all([appWindow.innerSize(), appWindow.scaleFactor()])
        .then(([size, scale]) => {
          if (!scale) return;
          const width = size.width / scale;
          const height = size.height / scale;
          setClientSize((current) =>
            current && current.width === width && current.height === height ? current : { width, height },
          );
        })
        .catch(() => undefined);
    };
    measure();
    void appWindow
      .onResized(measure)
      .then((dispose) => {
        unlisten = dispose;
      })
      .catch(() => undefined);
    return () => unlisten?.();
  }, []);

  /**
   * Keeps the picture on whole CSS pixels. The letterbox offset has to be
   * snapped so both compositing passes Chromium can use for a playing video
   * draw it in the same place — `pictureOffset` owns the arithmetic and the
   * measurements behind it. Recomputed when the video reports its size and
   * whenever the window changes size.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeItem) {
      setPicture(null);
      return;
    }
    const update = () => {
      const next = pictureOffset(
        clientSize?.width ?? window.innerWidth,
        clientSize?.height ?? window.innerHeight,
        video.videoWidth,
        video.videoHeight,
      );
      setPicture((current) =>
        current && next && current.x === next.x && current.y === next.y ? current : next,
      );
    };
    update();
    video.addEventListener("loadedmetadata", update);
    window.addEventListener("resize", update);
    return () => {
      video.removeEventListener("loadedmetadata", update);
      window.removeEventListener("resize", update);
    };
  }, [activeId, activeItem, clientSize]);

  useEffect(() => {
    const handleFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  // Keep the maximize/restore glyph in sync when the window changes state by
  // any route (our button, double-click, or an OS shortcut).
  useEffect(() => {
    if (!isTauri()) return;
    const window = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    const sync = () => {
      void window.isMaximized().then(setIsMaximized).catch(() => undefined);
    };
    sync();
    void window
      .onResized(sync)
      .then((dispose) => {
        unlisten = dispose;
      })
      .catch(() => undefined);
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (isTypingTarget(target.tagName) && event.key !== "Escape") return;

      const shortcut = resolveShortcut(event, platform);
      if (!shortcut) return;

      event.preventDefault();

      // Escape closes the topmost surface. While the dialog is open nothing else
      // reaches the player either: a modal owns the keyboard, so Space must not
      // toggle playback behind it.
      if (shortcut.type === "escape") {
        const outcome = resolveEscape(panel, isFullscreen, updateDialogOpen);
        if (outcome.handled && "closeDialog" in outcome) setUpdateDialogOpen(false);
        else if (outcome.handled && "close" in outcome) setPanel(null);
        else if (outcome.handled && outcome.exitFullscreen) void toggleFullscreen();
        return;
      }
      if (updateDialogOpen) return;

      switch (shortcut.type) {
        case "toggle-play":
          togglePlay();
          return;
        case "seek": {
          // A tap seeks, a hold scans; the delay decides which, so a quick
          // press still seeks and the timer is armed exactly once.
          if (!videoRef.current) return;
          const pressed = advanceSeekHold(seekHold.current, {
            type: "press",
            amount: shortcut.amount,
            repeat: event.repeat,
          });
          seekHold.current = pressed.state;
          if (pressed.step.type !== "arm") return;
          window.clearTimeout(holdTimer.current);
          holdTimer.current = window.setTimeout(() => {
            const elapsed = advanceSeekHold(seekHold.current, { type: "elapsed" });
            seekHold.current = elapsed.state;
            if (elapsed.step.type !== "scan") return;
            setHoldRate(elapsed.step.rate);
            flashOsd(<Zap size={16} />, `${strings.osdSpeed} ${elapsed.step.rate}x`);
          }, HOLD_SPEED_DELAY_MS);
          return;
        }
        case "volume":
          applyVolume(volume + shortcut.amount * 0.05);
          return;
        case "track":
          moveTrack(shortcut.direction);
          return;
        case "speed":
          applySpeed(stepSpeed(speed, shortcut.direction));
          return;
        case "fullscreen":
          void toggleFullscreen();
          return;
        case "panel":
          setPanel(shortcut.panel);
          return;
      }
    };

    /**
     * The held key ends the gesture no matter what modifiers are down: pressing
     * Alt mid-scan must not leave the scan running past the release.
     */
    const handleKeyUp = (event: KeyboardEvent) => {
      const state = seekHold.current;
      if (!state) return;
      const amount = arrowSeekAmount(event.key);
      if (amount === null || amount !== state.amount) return;
      const released = advanceSeekHold(state, { type: "release", amount });
      seekHold.current = released.state;
      window.clearTimeout(holdTimer.current);
      if (released.step.type === "seek") seekBy(released.step.amount * seekStep);
      else if (released.step.type === "end") setHoldRate(null);
    };

    /* Losing the window means the key-up never arrives, so the scan would hold
       the picture at a rate the user is no longer holding. */
    const handleBlur = () => {
      const cancelled = advanceSeekHold(seekHold.current, { type: "cancel" });
      seekHold.current = cancelled.state;
      window.clearTimeout(holdTimer.current);
      if (cancelled.step.type === "end") setHoldRate(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  });

  /* The pointer is the one gesture that also restarts the clock, so the bars
     step aside again a moment after the user stops moving. */
  const showChrome = useCallback(() => {
    setChromeVisible(true);
    window.clearTimeout(hideChromeTimer.current);
    if (activeItem && !panel) {
      hideChromeTimer.current = window.setTimeout(() => setChromeVisible(false), CHROME_HIDE_DELAY_MS);
    }
  }, [activeItem, panel]);

  /* The clock is armed when a picture arrives and when a panel closes: the bars
     are for the pointer, so they step aside on their own once it stops moving.
     A paused picture is no reason to keep them — the window is still showing
     something and the pointer is the way back.

     Neither this nor anything else may key on `isPlaying`, and panels never
     *reveal* the bars on the way in or out. An open panel already keeps the
     titlebar up through `chromeShown` (so the window stays draggable) and hides
     the control bar in CSS; closing one is not a pointer gesture — `Esc` and
     the panel shortcut happen with the pointer asleep or outside the window,
     and waking the bars there is exactly what must not happen. A pointer close
     reveals them on its own, through `showChrome`. */
  useEffect(() => {
    if (!activeItem || panel) return;
    hideChromeTimer.current = window.setTimeout(() => setChromeVisible(false), CHROME_HIDE_DELAY_MS);
    return () => window.clearTimeout(hideChromeTimer.current);
  }, [activeItem, panel]);

  const selectItem = (id: string) => {
    setActiveId(id);
    setPanel(null);
  };

  /**
   * Adds picked files to the playlist.
   *
   * A browser folder pick hands back every file in the tree, each named
   * relative to the folder it came from, so the same file name twice in two
   * subdirectories stays tellable apart.
   */
  const createItems = (files: FileList | File[]) => {
    const selected = Array.from(files).filter((file) => isSupportedVideo(file.name));
    const created = selected.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      name: file.name,
      path: file.webkitRelativePath || file.name,
      source: URL.createObjectURL(file),
      duration: 0,
    }));
    if (created.length === 0) {
      flashOsd(<FolderOpen size={16} />, strings.noVideosFound);
      return;
    }
    setItems((current) => [...current, ...created]);
    setActiveId(created[0].id);
    setPanel(null);
  };

  /** Turns a picked selection into playlist items, folders and all. */
  const createItemsFromPaths = useCallback(
    async (paths: string[]) => {
      const expanded = await resolveVideoPaths(paths);
      const created = expanded
        .filter((path) => isSupportedVideo(fileNameFromPath(path)))
        .map((path) => ({
          id: `${path}-${Math.random()}`,
          name: fileNameFromPath(path),
          path,
          source: convertFileSrc(path),
          duration: 0,
        }));
      if (!created.length) {
        flashOsd(<FolderOpen size={16} />, strings.noVideosFound);
        return;
      }
      setItems((current) => [...current, ...created]);
      setActiveId(created[0].id);
      setPanel(null);
    },
    [flashOsd, strings],
  );

  const addVideos = async () => {
    if (!isTauri()) {
      fileInputRef.current?.click();
      return;
    }
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: "Video", extensions: SUPPORTED_VIDEO_EXTENSIONS }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await createItemsFromPaths(paths);
  };

  /** Opens folders; every video inside one joins the playlist. */
  const addFolder = async () => {
    if (!isTauri()) {
      folderInputRef.current?.click();
      return;
    }
    const selected = await open({ multiple: true, directory: true });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await createItemsFromPaths(paths);
  };

  /* What is dropped on the window is a selection like any other — a folder
     among it brings the videos inside it.

     The listener is disposed through its own promise rather than a captured
     variable: subscribing is asynchronous, and under StrictMode the cleanup can
     run before it resolves. Leaving that first listener behind made every drop
     arrive twice in development. */
  useEffect(() => {
    if (!isTauri()) return;
    const subscription = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setIsDragOver(true);
      } else if (event.payload.type === "drop") {
        setIsDragOver(false);
        void createItemsFromPaths(event.payload.paths);
      } else {
        setIsDragOver(false);
      }
    });
    return () => {
      void subscription.then((dispose) => dispose()).catch(() => undefined);
    };
  }, [createItemsFromPaths]);

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) createItems(event.target.files);
    event.target.value = "";
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = video.currentTime || 0;
    setCurrentTime(nextTime);
    if (!activeItem || autoClearHistory || nextTime <= 0) return;
    if (Date.now() - historyWriteAt.current < HISTORY_WRITE_INTERVAL_MS) return;
    historyWriteAt.current = Date.now();
    setHistory((current) => recordHistory(current, {
      id: activeItem.id,
      name: activeItem.name,
      path: activeItem.path,
      source: activeItem.source,
      position: nextTime,
      duration: video.duration || activeItem.duration || 0,
      updatedAt: Date.now(),
    }));
  };

  const togglePlay = () => {
    if (!videoRef.current || !activeItem) return;
    const willPlay = videoRef.current.paused;
    if (willPlay) void videoRef.current.play();
    else videoRef.current.pause();
    flashOsd(
      willPlay ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />,
      willPlay ? strings.osdPlay : strings.osdPause,
    );
  };

  /** Applies a volume change and announces it in the status indicator. */
  const applyVolume = (next: number) => {
    const clamped = clamp(Number(next.toFixed(2)), 0, 1);
    setVolume(clamped);
    flashOsd(
      volumeIcon(clamped, 16),
      clamped === 0 ? strings.osdMuted : `${strings.osdVolume} ${Math.round(clamped * 100)}%`,
    );
  };

  /** Applies a playback-rate change and announces it. */
  const applySpeed = (next: number) => {
    setSpeed(next);
    flashOsd(<Zap size={16} />, `${strings.osdSpeed} ${next}x`);
  };

  const seekBy = (amount: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || duration, videoRef.current.currentTime + amount));
  };

  const moveTrack = (direction: 1 | -1) => {
    if (!items.length) return;
    const index = Math.max(0, items.findIndex((item) => item.id === activeId));
    selectItem(items[nextIndex(index, items.length, direction)].id);
  };

  const handleEnded = () => {
    const action = resolveEndedAction(items, activeId, playbackMode);

    if (action.kind === "repeat") {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        void videoRef.current.play();
      }
      return;
    }

    if (action.kind === "advance") {
      setActiveId(action.id);
      return;
    }

    setIsPlaying(false);
  };

  const toggleFullscreen = async () => {
    if (isTauri()) {
      const next = !isFullscreen;
      await invoke("set_window_fullscreen", { fullscreen: next }).catch(() => undefined);
      setIsFullscreen(next);
      return;
    }
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen().catch(() => undefined);
    else await document.exitFullscreen().catch(() => undefined);
  };

  const togglePinned = async () => {
    const next = !isPinned;
    if (isTauri()) await invoke("set_window_pinned", { pinned: next }).catch(() => undefined);
    setIsPinned(next);
  };

  const minimizeWindow = async () => {
    if (isTauri()) await getCurrentWindow().minimize().catch(() => undefined);
  };

  const toggleMaximizeWindow = async () => {
    if (!isTauri()) return;
    const window = getCurrentWindow();
    await window.toggleMaximize().catch(() => undefined);
    const maximized = await window.isMaximized().catch(() => isMaximized);
    setIsMaximized(maximized);
  };

  const closeWindow = async () => {
    if (isTauri()) await getCurrentWindow().close().catch(() => undefined);
  };

  const handleLoadedMetadata = async () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    if (activeId) {
      if (!autoClearHistory) {
        const resume = resumePosition(history, activeId, video.duration);
        if (resume > 0) {
          video.currentTime = resume;
          setCurrentTime(resume);
        }
      }
      setItems((current) => current.map((item) => item.id === activeId
        ? { ...item, duration: video.duration, width: video.videoWidth, height: video.videoHeight }
        : item));
    }
    if (isTauri() && video.videoWidth && video.videoHeight) {
      await invoke("resize_to_video", { width: video.videoWidth, height: video.videoHeight }).catch(() => undefined);
    }
  };

  const removeItem = (id: string) => {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      if (id === activeId) {
        const fallback = next[0];
        setActiveId(fallback?.id || null);
      }
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    setToast(strings.clearHistoryDone);
    window.setTimeout(() => setToast(""), 1800);
  };

  /**
   * Opens a bubble for `anchor` after the hover pause (shadcn's provider
   * default). A bubble for another anchor that is already up yields at once
   * instead of lingering over the wrong spot.
   */
  function openTip(anchor: HTMLElement, key: string, text: string) {
    const rect = anchor.getBoundingClientRect();
    const below = tooltipPlacement(rect.top) === "below";
    setTip((current) => (current && current.id !== key ? null : current));
    window.clearTimeout(tipTimer.current);
    tipTimer.current = window.setTimeout(() => setTip({
      id: key,
      text,
      anchorCx: rect.left + rect.width / 2,
      cx: rect.left + rect.width / 2,
      top: below ? rect.bottom : rect.top,
      below,
    }), TOOLTIP_DELAY_MS);
  }

  /** The name rows only speak when the label is actually cut off — the
   *  ellipsis is the whole reason the name is unreadable. */
  function openNameTip(anchor: HTMLElement, key: string, text: string) {
    if (isTextTruncated(anchor.scrollWidth, anchor.clientWidth)) openTip(anchor, key, text);
    else hideTip();
  }

  function hideTip() {
    window.clearTimeout(tipTimer.current);
    setTip(null);
  }

  /** One shared hover/focus bundle: every tooltip in the app is this bubble.
   *  Focus shows it only for keyboard focus (:focus-visible), like shadcn. */
  const tipFor = (key: string, text: string): TipProps => ({
    onMouseEnter: (event) => openTip(event.currentTarget, key, text),
    onMouseLeave: hideTip,
    onFocus: (event) => {
      if (event.currentTarget.matches(":focus-visible")) openTip(event.currentTarget, key, text);
    },
    onBlur: hideTip,
    "aria-describedby": tip?.id === key ? tipId : undefined,
  });

  /** The bubble's width is only known once it is mounted, so the slide
   *  inside the window happens here — before the browser paints, so the
   *  bubble never appears at the clipped position. */
  useLayoutEffect(() => {
    if (!tip) return;
    const el = tipRef.current;
    if (!el) return;
    // offsetWidth, not getBoundingClientRect: the entrance animation scales
    // the visual box and would skew the measurement.
    const cx = tipShift(tip.anchorCx, el.offsetWidth, window.innerWidth);
    if (cx !== tip.cx) setTip({ ...tip, cx });
  }, [tip]);

  // Rows that leave the list (removed, cleared, tab or panel switched) take
  // their bubble with them — an unmounted anchor fires no mouseleave.
  useEffect(() => {
    window.clearTimeout(tipTimer.current);
    setTip(null);
  }, [items.length, history.length, panel, panelTab]);

  // A track that advances under a parked pointer must not leave the old name up.
  useEffect(() => {
    window.clearTimeout(tipTimer.current);
    setTip(null);
  }, [activeItem?.name]);

  const removeHistory = (id: string) => {
    setHistory((current) => removeHistoryEntry(current, id));
  };

  const clearPlaylist = () => {
    setItems([]);
    setActiveId(null);
    setToast(strings.clearPlaylistDone);
    window.setTimeout(() => setToast(""), 1800);
  };

  /** Plays a history entry, adding it back to the queue if it is not there. */
  const openHistoryEntry = (entry: HistoryEntry) => {
    setItems((current) => (current.some((item) => item.id === entry.id)
      ? current
      : [...current, historyToMediaItem(entry)]));
    setActiveId(entry.id);
    setPanelTab("history");
  };

  const themeOptions: { value: Theme; label: string }[] = [
    { value: "dark", label: strings.dark },
    { value: "light", label: strings.light },
    { value: "system", label: strings.system },
  ];

  const languageOptions: { value: Language; label: string }[] = [
    { value: "zh", label: "简体中文" },
    { value: "en", label: "English" },
  ];

  // The font dropdowns list the system's families; every option previews in
  // its own face, because choosing type by name alone is guessing.
  const uiFontOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "", label: strings.fontDefault },
      ...(systemFonts?.families ?? []).map((family) => ({
        value: family,
        label: family,
        style: { fontFamily: resolveFontStack(family, DEFAULT_SANS_STACK) } as CSSProperties,
      })),
    ],
    [strings.fontDefault, systemFonts],
  );

  const monoFontOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "", label: strings.fontDefault },
      ...(systemFonts?.monospace ?? []).map((family) => ({
        value: family,
        label: family,
        style: { fontFamily: resolveFontStack(family, DEFAULT_MONO_STACK) } as CSSProperties,
      })),
    ],
    [strings.fontDefault, systemFonts],
  );

  const speedOptions = useMemo(
    () => SPEED_STEPS.map((step) => ({ value: String(step), label: `${step}x` })),
    [],
  );

  /** Settings lists only the bindings that apply to this platform. */
  const shortcutLabels: Record<ShortcutId, string> = {
    playPause: strings.playPause,
    seek: strings.seek,
    volume: strings.volume,
    track: strings.nextPrevious,
    speed: strings.speed,
    fullscreen: strings.fullScreen,
    settings: strings.settings,
    playlist: strings.playlist,
    closePanel: strings.closePanel,
  };

  const playbackOptions: { key: PlaybackMode; label: string; icon: typeof Pause }[] = [
    { key: "pause", label: strings.pauseAfter, icon: Pause },
    { key: "playlist", label: strings.continuePlaylist, icon: List },
    { key: "single", label: strings.repeatOne, icon: Repeat2 },
    { key: "list", label: strings.repeatList, icon: ListVideo },
  ];

  // A panel is a surface the user opened on purpose, so while one is up the
  // titlebar stays out of the auto-hide cycle: the window has to remain
  // draggable and closable even when the pointer leaves it. The control bar is
  // the part that steps aside, which `.panel-open` in the stylesheet does.
  const chromeShown = chromeVisible || panel !== null;

  return (
    <main
      className={`mirror-shell ${activeItem ? "has-video" : ""} ${chromeShown ? "chrome-visible" : "chrome-hidden"} ${panel ? "panel-open" : ""}`}
      onMouseMove={showChrome}
      onMouseLeave={() => {
        // The pointer left the window: take the chrome away immediately, and
        // disarm the idle timer so it cannot bring it back on its own.
        window.clearTimeout(hideChromeTimer.current);
        setChromeVisible(false);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        createItems(event.dataTransfer.files);
      }}
    >
      <header
        className={`titlebar${isMac ? " mac" : ""}`}
        data-tauri-drag-region="true"
        aria-describedby={tip?.id === "titlebar" ? tipId : undefined}
        onMouseOver={(event) => {
          // The centre strip is pointer-events: none (it must not block the
          // drag region), so the header carries the hover for the name and is
          // measured against the span where the ellipsis clips. Buttons run
          // their own bubbles through tipFor.
          if ((event.target as HTMLElement).closest("button")) return;
          const name = titlebarNameRef.current;
          if (name) openNameTip(name, "titlebar", activeItem?.name ?? "");
        }}
        onMouseOut={(event) => {
          const to = event.relatedTarget as HTMLElement | null;
          if (!to || !to.closest(".titlebar")) hideTip();
        }}
      >
        <div className="titlebar-actions no-drag">
          <button className={`icon-button subtle ${isPinned ? "active" : ""}`} onClick={() => void togglePinned()} {...tipFor("pin", isPinned ? strings.pinned : strings.pinWindow)} aria-label={isPinned ? strings.pinned : strings.pinWindow}>
            {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
          <button className="icon-button subtle" onClick={() => setPanel("settings")} {...tipFor("settings", strings.settings)} aria-label={strings.settings}>
            <Settings2 size={17} />
          </button>
        </div>
        <div className="titlebar-center" data-tauri-drag-region="true">
          <span ref={titlebarNameRef}>{activeItem?.name ?? ""}</span>
        </div>
        <div className="titlebar-actions no-drag">
          <button className="icon-button subtle" onClick={() => setPanel("playlist")} {...tipFor("open-playlist", strings.playlist)} aria-label={strings.playlist}>
            <ListVideo size={17} />
          </button>
          {!isMac && <span className="window-divider" aria-hidden="true" />}
          {!isMac && (
            <>
              <button className="icon-button subtle window-control" onClick={() => void minimizeWindow()} {...tipFor("minimize", strings.minimize)} aria-label={strings.minimize}>
                <Minus size={14} />
              </button>
              {showMaximize && (
                <button className="icon-button subtle window-control" onClick={() => void toggleMaximizeWindow()} {...tipFor("maximize", isMaximized ? strings.restore : strings.maximize)} aria-label={isMaximized ? strings.restore : strings.maximize}>
                  {isMaximized ? <Minimize2 size={14} /> : <Square size={14} />}
                </button>
              )}
              <button className="icon-button subtle danger-strong window-control close-control" onClick={() => void closeWindow()} {...tipFor("close-window", strings.close)} aria-label={strings.close}>
                <X size={15} />
              </button>
            </>
          )}
        </div>
      </header>

      <section
        className={`stage ${isDragOver ? "drag-over" : ""}`}
        style={clientSize ? { width: clientSize.width, height: clientSize.height } : undefined}
      >
        {activeItem ? (
          <video
            ref={videoRef}
            className="video-element"
            playsInline
            style={picture ? { objectPosition: `${picture.x}px ${picture.y}px` } : undefined}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => void handleLoadedMetadata()}
            onEnded={handleEnded}
          />
        ) : (
          <div className="home">
            <img className="home-logo" src={logo} alt="" width={72} height={72} draggable={false} />
            <h1 className="home-title">Mirror Player</h1>
            <OpenSplitButton
              strings={strings}
              onOpenFiles={() => void addVideos()}
              onOpenFolder={() => void addFolder()}
            />
          </div>
        )}
        {isDragOver && (
          <div className="drop-overlay">
            <Upload size={34} />
            <strong>{strings.add}</strong>
          </div>
        )}
      </section>

      {activeItem && (
        <footer className="player-chrome">
        <div className="progress-row">
          <span className="time-label">{formatTime(currentTime)}</span>
          <input
            aria-label="Progress"
            className="progress-input"
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (videoRef.current) videoRef.current.currentTime = next;
              setCurrentTime(next);
            }}
            style={{ "--progress": `${duration ? (currentTime / duration) * 100 : 0}%` } as CSSProperties}
          />
          <span className="time-label">{formatTime(duration)}</span>
        </div>
        <div className="controls-row">
          <div className="controls-left">
            <div className="volume-control">
              <button className="control-button" onClick={() => applyVolume(volume > 0 ? 0 : 0.8)} {...tipFor("mute", volume === 0 ? "Unmute" : strings.muted)} aria-label={volume === 0 ? "Unmute" : strings.muted}>
                {volumeIcon(volume, 17)}
              </button>
              <input aria-label={strings.volume} className="volume-input" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => applyVolume(Number(event.target.value))} style={{ "--progress": `${volume * 100}%` } as CSSProperties} />
            </div>
          </div>
          <div className="controls-center">
            <button className="control-button" onClick={() => moveTrack(-1)} {...tipFor("previous", strings.nextPrevious)} aria-label="Previous"><SkipBack size={17} fill="currentColor" /></button>
            <button className="play-button" onClick={togglePlay} {...tipFor("play-pause", strings.playPause)} aria-label={strings.playPause}>
              {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            </button>
            <button className="control-button" onClick={() => moveTrack(1)} {...tipFor("next", strings.nextPrevious)} aria-label="Next"><SkipForward size={17} fill="currentColor" /></button>
          </div>
          <div className="controls-right">
            <Combobox
              value={String(speed)}
              options={speedOptions}
              onChange={(next) => applySpeed(Number(next))}
              label={strings.playbackSpeed}
              placement="up"
              variant="chrome"
              tipProps={tipFor("speed", strings.playbackSpeed)}
              onListOpen={hideTip}
            />
            <button className="control-button" onClick={() => void toggleFullscreen()} {...tipFor("fullscreen", strings.fullScreen)} aria-label={strings.fullScreen}>{isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
          </div>
        </div>
      </footer>
      )}

      <input ref={fileInputRef} className="hidden-input" type="file" accept="video/*" multiple onChange={handleFileInput} />
      <input ref={folderInputRef} className="hidden-input" type="file" accept="video/*" multiple onChange={handleFileInput} />

      {panel && (
        <>
          <button className="panel-backdrop" aria-label={strings.closePanel} onClick={() => setPanel(null)} />
          <aside
            className={`side-panel ${panel}`}
            onWheel={hideTip}
          >
            <div className="panel-header">
              <h2>{panel === "settings" ? strings.settings : strings.playlist}</h2>
              <button className="icon-button subtle danger-strong" onClick={() => setPanel(null)} {...tipFor("close-panel", strings.closePanel)} aria-label={strings.closePanel}><X size={17} /></button>
            </div>
            {panel === "playlist" ? (
              <>
                <div className="panel-toolbar">
                  <div className="tabs-list" role="tablist" aria-label={strings.playlist}>
                    <button
                      type="button"
                      role="tab"
                      id="tab-playlist"
                      aria-selected={panelTab === "playlist"}
                      aria-controls="panel-tab-body"
                      className="tabs-trigger"
                      onClick={() => setPanelTab("playlist")}
                    >
                      {strings.playlist}
                      <span className="tabs-count">{items.length}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      id="tab-history"
                      aria-selected={panelTab === "history"}
                      aria-controls="panel-tab-body"
                      className="tabs-trigger"
                      onClick={() => setPanelTab("history")}
                    >
                      {strings.history}
                      <span className="tabs-count">{history.length}</span>
                    </button>
                  </div>
                  <div className="tab-actions">
                    {panelTab === "playlist" ? (
                      <>
                        <button className="icon-button subtle" onClick={() => void addVideos()} {...tipFor("add", strings.add)} aria-label={strings.add}><Plus size={15} /></button>
                        <button className="icon-button subtle" onClick={() => void addFolder()} {...tipFor("add-folder", strings.addFolder)} aria-label={strings.addFolder}><FolderPlus size={15} /></button>
                        <button className="icon-button subtle danger" onClick={clearPlaylist} disabled={items.length === 0} {...tipFor("clear-playlist", strings.clearPlaylist)} aria-label={strings.clearPlaylist}><Trash2 size={14} /></button>
                      </>
                    ) : (
                      <button className="icon-button subtle danger" onClick={clearHistory} disabled={history.length === 0} {...tipFor("clear-history", strings.clearHistoryNow)} aria-label={strings.clearHistoryNow}><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
                <ScrollArea className="panel-body" id="panel-tab-body" role="tabpanel" labelledBy={panelTab === "playlist" ? "tab-playlist" : "tab-history"}>
                  {panelTab === "playlist" ? (
                    items.length === 0 ? (
                      <div className="playlist-empty"><ListVideo size={24} /><strong>{strings.noVideos}</strong><span>{strings.addFirst}</span></div>
                    ) : (
                      <div className="playlist-items">
                        {items.map((item, index) => (
                          <div className={`playlist-item ${item.id === activeId ? "selected" : ""}`} key={item.id}>
                            <button className="playlist-select" onClick={() => selectItem(item.id)}>
                              <span className="playlist-index">{item.id === activeId ? <Play size={11} fill="currentColor" /> : String(index + 1).padStart(2, "0")}</span>
                              <span className="playlist-name">
                                <strong
                                  onMouseEnter={(event) => openNameTip(event.currentTarget, `item-${item.id}`, item.name)}
                                  onMouseLeave={hideTip}
                                  aria-describedby={tip?.id === `item-${item.id}` ? tipId : undefined}
                                >{item.name}</strong>
                                <small><span>{mediaKind(item) === "audio" ? strings.audio : strings.video}</span><span className="num">{item.duration > 0 ? formatTime(item.duration) : ""}</span></small>
                              </span>
                            </button>
                            <button className="item-remove" onClick={() => removeItem(item.id)} {...tipFor(`remove-${item.id}`, strings.removeItem)} aria-label={`${strings.removeItem}: ${item.name}`}><X size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )
                  ) : history.length === 0 ? (
                    <div className="playlist-empty"><History size={24} /><strong>{strings.noHistory}</strong><span>{strings.historyHint}</span></div>
                  ) : (
                    <div className="playlist-items">
                      {history.map((entry) => (
                        <div className={`playlist-item ${entry.id === activeId ? "selected" : ""}`} key={entry.id}>
                          <button className="playlist-select" onClick={() => openHistoryEntry(entry)}>
                            <span className="playlist-index"><Play size={11} fill="currentColor" /></span>
                            <span className="playlist-name">
                              <strong
                                onMouseEnter={(event) => openNameTip(event.currentTarget, `hist-${entry.id}`, entry.name)}
                                onMouseLeave={hideTip}
                                aria-describedby={tip?.id === `hist-${entry.id}` ? tipId : undefined}
                              >{entry.name}</strong>
                              <small className="num">{formatTime(entry.position)}{entry.duration ? ` / ${formatTime(entry.duration)}` : ""}</small>
                            </span>
                          </button>
                          <button className="item-remove" onClick={() => removeHistory(entry.id)} {...tipFor(`remove-hist-${entry.id}`, strings.removeItem)} aria-label={`${strings.removeItem}: ${entry.name}`}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="settings-layout">
                <nav className="settings-nav" aria-label={strings.settings}>
                  {settingsSections.map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      className={settingsSection === id ? "selected" : ""}
                      aria-current={settingsSection === id ? "true" : undefined}
                      onClick={() => setSettingsSection(id)}
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                    </button>
                  ))}
                </nav>
                <ScrollArea className="panel-body settings-content">
                  {settingsSection === "appearance" && (
                    <SettingSection icon={<Palette size={14} />} title={strings.appearance}>
                      <div className="setting-row">
                        <span className="setting-row-label">{strings.theme}</span>
                        <Combobox value={theme} options={themeOptions} onChange={(next) => setTheme(next as Theme)} label={strings.theme} />
                      </div>
                      <div className="setting-row">
                        <span className="setting-row-label">{strings.language}</span>
                        <Combobox value={language} options={languageOptions} onChange={(next) => setLanguage(next as Language)} label={strings.language} />
                      </div>
                      <div className="setting-row">
                        <span className="setting-row-label">{strings.uiFont}</span>
                        <Combobox value={uiFont} options={uiFontOptions} onChange={setUiFont} label={strings.uiFont} />
                      </div>
                      <div className="setting-row">
                        <span className="setting-row-label">{strings.monoFont}</span>
                        <Combobox value={monoFont} options={monoFontOptions} onChange={setMonoFont} label={strings.monoFont} />
                      </div>
                    </SettingSection>
                  )}
                  {settingsSection === "playback" && (
                    <SettingSection icon={<SlidersHorizontal size={14} />} title={strings.playback}>
                      <div className="range-setting"><div className="setting-label"><span>{strings.seekStep}</span><strong className="num">{seekStep} {strings.seconds}</strong></div><input type="range" min="5" max="60" step="5" value={seekStep} onChange={(event) => setSeekStep(Number(event.target.value))} style={{ "--progress": `${((seekStep - 5) / 55) * 100}%` } as CSSProperties} /></div>
                      <div className="setting-label"><span>{strings.playbackMode}</span></div>
                      <div className="mode-list">{playbackOptions.map(({ key, label, icon: Icon }) => <button key={key} className={playbackMode === key ? "selected" : ""} onClick={() => setPlaybackMode(key)}><span><Icon size={15} />{label}</span>{playbackMode === key && <Zap size={13} />}</button>)}</div>
                      <ToggleRow label={strings.clearHistory} checked={autoClearHistory} onChange={setAutoClearHistory} />
                    </SettingSection>
                  )}
                  {settingsSection === "update" && (
                    <SettingSection
                      icon={<RefreshCw size={14} />}
                      title={strings.update}
                      action={isTauri() ? (
                        <button className="ghost-button" onClick={() => void runUpdateCheck(true, previewUpdates)} disabled={updateBusy}>
                          <RefreshCw size={12} />
                          {updateStatus === "checking" ? strings.checking : strings.checkUpdate}
                        </button>
                      ) : undefined}
                    >
                      <ToggleRow label={strings.autoUpdate} checked={autoUpdate} onChange={setAutoUpdate} />
                      <ToggleRow label={strings.previewUpdates} checked={previewUpdates} onChange={setPreviewUpdates} />
                      {isTauri() && (updateStatusText !== "" || available !== null || blockedPreview !== null) && (
                        <div className="update-block">
                          {updateStatusText && <p className={`update-status ${updateStatus === "error" ? "error" : ""}`}>{updateStatusText}</p>}
                          {available && <p className="update-status"><strong>v{available.version}</strong> · {strings.updateAvailable}</p>}
                          {blockedPreview && <p className="update-status"><strong>v{blockedPreview}</strong> · {strings.previewTag}</p>}
                          {(available !== null || blockedPreview !== null) && (
                            <button className="ghost-button" onClick={() => setUpdateDialogOpen(true)}>
                              <Info size={12} />
                              {strings.viewDetails}
                            </button>
                          )}
                        </div>
                      )}
                    </SettingSection>
                  )}
                  {settingsSection === "shortcuts" && (
                    <SettingSection icon={<Command size={14} />} title={strings.shortcuts}>
                      {SHORTCUT_ORDER.map((id) => (
                        <ShortcutRow key={id} keys={shortcutKeys(id, platform)} label={shortcutLabels[id]} />
                      ))}
                    </SettingSection>
                  )}
                  {settingsSection === "about" && (
                    <SettingSection icon={<Info size={14} />} title={strings.about}>
                      <div className="about-row"><span>{strings.version}</span><strong className="num">v{appVersion}</strong></div>
                      <div className="about-row"><span>{strings.repository}</span><strong className="about-repo">{PROJECT.repository}</strong></div>
                    </SettingSection>
                  )}
                </ScrollArea>
              </div>
            )}
          </aside>
        </>
      )}

      {osd && (
        <div className="osd" role="status" aria-live="polite">
          {osd.icon}
          <span>{osd.text}</span>
        </div>
      )}

      {toast && <div className="toast"><Trash2 size={14} /> {toast}</div>}

      {tip && (
        <div
          ref={tipRef}
          id={tipId}
          role="tooltip"
          className={`name-tip${tip.below ? " below" : ""}`}
          style={{ top: tip.top, "--tip-cx": `${tip.cx}px` } as CSSProperties}
        >
          {tip.text}
        </div>
      )}

      {updateDialogOpen && (
        <UpdateDialog
          strings={strings}
          tipFor={tipFor}
          status={updateStatus}
          currentVersion={appVersion}
          available={available}
          blockedPreview={blockedPreview}
          progress={updateProgress}
          error={updateError}
          busy={updateBusy}
          onClose={() => setUpdateDialogOpen(false)}
          onInstall={() => void installUpdate()}
          onEnablePreview={enablePreviewUpdates}
        />
      )}
    </main>
  );
}

function SettingSection({ icon, title, action, children }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="setting-section">
      <div className="section-heading">
        <span className="section-icon">{icon}</span>
        <h3>{title}</h3>
        {action && <span className="section-action">{action}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * The update check's own surface.
 *
 * The result used to be a paragraph inside the settings panel, where it was easy
 * to miss; a modal reports what happened and holds the release notes, so a user
 * can read what an update changes before installing it.
 *
 * It is modal, so it owns the keyboard while it is open: `resolveEscape` closes
 * it before the panels, and the global shortcut listener drops every key but
 * Escape.
 */
function UpdateDialog({
  strings,
  tipFor,
  status,
  currentVersion,
  available,
  blockedPreview,
  progress,
  error,
  busy,
  onClose,
  onInstall,
  onEnablePreview,
}: {
  strings: Copy;
  tipFor: (key: string, text: string) => TipProps;
  status: UpdateStatus;
  currentVersion: string;
  available: Update | null;
  blockedPreview: string | null;
  progress: number | null;
  error: string;
  busy: boolean;
  onClose: () => void;
  onInstall: () => void;
  onEnablePreview: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);

  // Focus moves into the dialog on open, and back to whatever opened it.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    card.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  /** Keeps Tab inside: what sits behind a modal must not be tabbable. */
  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      card.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const progressText = progress === null
    ? strings.installing
    : `${strings.installing} ${Math.round(progress * 100)}%`;

  return (
    <div className="update-dialog-layer">
      <button className="dialog-backdrop" aria-label={strings.closeDialog} onClick={onClose} />
      <div
        className="update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-dialog-title"
        tabIndex={-1}
        ref={card}
        onKeyDown={trapFocus}
      >
        <header className="dialog-header">
          <h2 id="update-dialog-title">{strings.updateDetails}</h2>
          <button className="icon-button subtle danger-strong" onClick={onClose} aria-label={strings.closeDialog}><X size={17} /></button>
        </header>

        {status === "checking" && <p className="dialog-lead">{strings.checking}</p>}
        {status === "error" && <p className="dialog-lead error">{strings.updateFailed}{error}</p>}
        {status === "current" && (
          <p className="dialog-lead">{strings.upToDate} · {strings.currentVersion} v{currentVersion}</p>
        )}
        {status === "installing" && available && <p className="dialog-lead">{progressText}</p>}
        {status === "installed" && <p className="dialog-lead">{strings.restartToApply}</p>}

        {status === "preview" && blockedPreview && (
          <>
            <p className="dialog-version">v{blockedPreview} <span>· {strings.previewTag}</span></p>
            <p className="dialog-lead">{strings.previewWithheld}</p>
          </>
        )}

        {available && (
          <>
            <p className="dialog-version">v{available.version} <span>· {strings.updateAvailable}</span></p>
            <ScrollArea className="dialog-changelog">
              <Changelog body={available.body ?? ""} tipFor={tipFor} />
            </ScrollArea>
          </>
        )}

        <footer className="dialog-actions">
          {status === "preview" && (
            <button className="update-button" onClick={onEnablePreview} disabled={busy}>
              <Download size={14} />
              {strings.enablePreview}
            </button>
          )}
          {available && status !== "installed" && (
            <button className="update-button" onClick={onInstall} disabled={busy}>
              <Download size={14} />
              {status === "installing" ? strings.installing : strings.installUpdate}
            </button>
          )}
          <button className="ghost-button" onClick={onClose}>{strings.close}</button>
        </footer>
      </div>
    </div>
  );
}

/**
 * The release notes of the pending update.
 *
 * Blocks become elements, never markup: the text arrives over the network, so
 * a commit message containing a tag must stay text.
 */function Changelog({ body, tipFor }: { body: string; tipFor: (key: string, text: string) => TipProps }) {
  return (
    <div className="changelog">
      {parseMarkdown(body).map((block, index) => {
        switch (block.type) {
          case "heading":
            return <h4 key={index} className={block.level >= 3 ? "changelog-group" : undefined}>{inline(block.content, tipFor)}</h4>;
          case "list":
            return block.ordered
              ? <ol key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, tipFor)}</li>)}</ol>
              : <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, tipFor)}</li>)}</ul>;
          case "rule":
            return <hr key={index} />;
          default:
            return <p key={index}>{inline(block.content, tipFor)}</p>;
        }
      })}
    </div>
  );
}

/** Renders one line of release notes; links stay text so nothing navigates away. */
function inline(nodes: InlineNode[], tipFor: (key: string, text: string) => TipProps) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "strong":
        return <strong key={index}>{node.value}</strong>;
      case "code":
        return <code key={index}>{node.value}</code>;
      case "link":
        return <span className="changelog-link" key={index} {...tipFor(`link-${index}`, node.href)}>{node.value}</span>;
      default:
        return node.value;
    }
  });
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span>{label}</span><button type="button" role="switch" aria-checked={checked} className={`switch ${checked ? "checked" : ""}`} onClick={() => onChange(!checked)}><span /></button></label>;
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return <div className="shortcut-row"><span>{label}</span><div>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</div></div>;
}

type ComboboxOption = { value: string; label: string; style?: CSSProperties };

/**
 * Scroll container with an overlay scrollbar.
 *
 * The native scrollbar is hidden and the thumb is drawn on top of the content,
 * so the scrollbar never takes layout width and the content does not reflow when
 * the thumb appears. Native wheel, touch and keyboard scrolling still work; only
 * the pointer drag of the thumb is reimplemented.
 */
function ScrollArea({
  children,
  className = "",
  id,
  role,
  label,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  role?: string;
  /** Names the scroller itself, for roles that carry no visible label. */
  label?: string;
  labelledBy?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ height: 0, top: 0 });
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight + 1) {
      setThumb({ height: 0, top: 0 });
      return;
    }
    const height = Math.max(28, (clientHeight / scrollHeight) * clientHeight);
    const maxScroll = scrollHeight - clientHeight;
    const top = maxScroll > 0 ? (scrollTop / maxScroll) * (clientHeight - height) : 0;
    setThumb({ height, top });
  }, []);

  // Re-measure on scroll, on resize, and whenever the content changes size.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, children]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const reveal = () => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    if (!dragging) hideTimer.current = window.setTimeout(() => setVisible(false), 1200);
  };

  const onThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    const track = event.currentTarget.parentElement;
    if (!el || !track) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    const trackHeight = track.clientHeight;
    const startY = event.clientY;
    const startScroll = el.scrollTop;
    const maxScroll = el.scrollHeight - el.clientHeight;
    const travel = trackHeight - thumb.height;

    const onMove = (move: PointerEvent) => {
      if (travel <= 0) return;
      const delta = ((move.clientY - startY) / travel) * maxScroll;
      el.scrollTop = Math.max(0, Math.min(maxScroll, startScroll + delta));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const scrollable = thumb.height > 0;

  return (
    <div className={`scroll-area ${className}`.trim()}>
      <div
        className="scroll-view"
        ref={scrollerRef}
        id={id}
        role={role}
        aria-label={label}
        aria-labelledby={labelledBy}
        onScroll={reveal}
        onMouseEnter={reveal}
      >
        {children}
      </div>
      {scrollable && (
        <div className="scroll-track" aria-hidden="true">
          <div
            className={`scroll-thumb${visible || dragging ? " visible" : ""}`}
            style={{ height: `${thumb.height}px`, transform: `translateY(${thumb.top}px)` }}
            onPointerDown={onThumbPointerDown}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Dropdown listbox — for a fixed handful of choices (theme, speed) and for the
 * system's full font list, which runs hundreds long and scrolls.
 *
 * Implemented as a real combobox so the trigger keeps focus and the active
 * option is tracked with `aria-activedescendant`. Keys it handles are stopped
 * from reaching the global shortcut listener — otherwise Space would also
 * toggle playback and the arrows would change the volume.
 */
/**
 * The one button that opens either video files or a folder.
 *
 * A native picker is either a file chooser or a folder chooser — it cannot offer
 * both — so the button carries the choice in a small menu instead. What is
 * dropped on the window needs no menu: files and folders both arrive as paths.
 *
 * Keys this control handles stop propagating, because the global shortcut
 * listener sits on `window`: without that, `Space` would also toggle playback,
 * `Enter` would also go fullscreen and the arrows would also seek.
 */
/**
 * The home screen's one way in, split in two: the label side opens video files
 * straight away, the caret side offers both ways in.
 *
 * A native picker is either a file chooser or a folder chooser — it cannot offer
 * both — so the folder sits one caret away instead of behind a menu that charged
 * the common case a click. What is dropped on the window needs neither: files
 * and folders both arrive as paths. The playlist toolbar, which has the room,
 * says the same thing with two buttons instead.
 *
 * Keys this control handles stop propagating, because the global shortcut
 * listener sits on `window`: without that, `Space` would also toggle playback,
 * `Enter` would also go fullscreen and the arrows would also seek.
 */
function OpenSplitButton({
  strings,
  onOpenFiles,
  onOpenFolder,
}: {
  strings: Copy;
  onOpenFiles: () => void;
  onOpenFolder: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const items = [
    { id: "files", label: strings.openVideo, icon: <FileVideo size={14} aria-hidden="true" />, run: onOpenFiles },
    { id: "folder", label: strings.openFolder, icon: <FolderOpen size={14} aria-hidden="true" />, run: onOpenFolder },
  ];

  const openMenu = () => {
    setActive(0);
    setOpen(true);
  };

  /* Opening moves focus to the first action, so the menu works from the
     keyboard alone; the actions are kept out of the Tab order for that. */
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  // Clicking anywhere outside closes it, as the dropdown does.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) caretRef.current?.focus();
  };

  const focusItem = (index: number) => {
    setActive(index);
    itemRefs.current[index]?.focus();
  };

  /* Focus leaving the control — Tab, or a click on something unfocusable —
     closes the menu. Focus has already moved on, so this never pulls it back. */
  const onBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (!open) return;
    const next = event.relatedTarget as Node | null;
    if (!next || !event.currentTarget.contains(next)) setOpen(false);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const { key } = event;

    if (key === "Escape" && open) {
      event.stopPropagation();
      event.preventDefault();
      close(true);
      return;
    }

    if (!open) {
      // Both halves are real buttons, so `Space` and `Enter` are their native
      // activation. Only the shortcut listener has to be kept out of it.
      if (key === "Enter" || key === " ") event.stopPropagation();
      else if (key === "ArrowDown" || key === "ArrowUp") {
        event.stopPropagation();
        event.preventDefault();
        openMenu();
      }
      return;
    }

    if (key === " " || key === "Enter" || key.startsWith("Arrow")) event.stopPropagation();
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      focusItem((active + (key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    }
  };

  return (
    <div
      className="open-menu"
      ref={rootRef}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <div className="open-split primary">
        <button
          type="button"
          className="open-main"
          aria-label={strings.openVideo}
          onClick={() => {
            // The file dialog is about to take the screen; a menu left open
            // behind it would still be there when the picker closes.
            close(false);
            onOpenFiles();
          }}
        >
          <FileVideo size={16} aria-hidden="true" />
          <span>{strings.openVideo}</span>
        </button>
        <button
          type="button"
          ref={caretRef}
          className="open-caret"
          aria-label={strings.openMenu}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => (open ? close(false) : openMenu())}
        >
          <ChevronDown size={13} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="open-menu-list" id={menuId} role="menu" aria-label={strings.openMenu}>
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="open-menu-item"
              onMouseEnter={() => focusItem(index)}
              onClick={() => {
                // The caret keeps focus, so the native picker has somewhere to
                // come back to.
                close(true);
                item.run();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Combobox({
  value,
  options,
  onChange,
  label,
  placement = "down",
  variant = "field",
  tipProps,
  onListOpen,
}: {
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  label: string;
  placement?: "down" | "up";
  variant?: "field" | "chrome";
  /** Hover/focus tooltip bundle for the trigger; suppressed while the list is
   *  open so the bubble never sits on top of the options. */
  tipProps?: TipProps;
  /** The list is opening — the caller dismisses what must not overlap it. */
  onListOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.findIndex((option) => option.value === value);
  const selectedLabel = (selected >= 0 ? options[selected] : options[0])?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const openList = () => {
    setActive(selected >= 0 ? selected : 0);
    setOpen(true);
    onListOpen?.();
  };

  // Keeps the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId, open]);

  const commit = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "Escape":
        if (!open) return;
        event.stopPropagation();
        event.preventDefault();
        setOpen(false);
        return;
      case "ArrowDown":
      case "ArrowUp": {
        event.stopPropagation();
        event.preventDefault();
        if (!open) {
          openList();
          return;
        }
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setActive((index) => (index + delta + options.length) % options.length);
        return;
      }
      case "Home":
      case "End":
        if (!open) return;
        event.stopPropagation();
        event.preventDefault();
        setActive(event.key === "Home" ? 0 : options.length - 1);
        return;
      case "Enter":
      case " ":
        event.stopPropagation();
        event.preventDefault();
        if (open) commit(active);
        else openList();
        return;
      default:
        return;
    }
  };

  return (
    <div className={`combobox ${placement} ${variant}`} ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        role="combobox"
        className="combobox-trigger"
        {...(open ? undefined : tipProps)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
      >
        <span className="combobox-value">{selectedLabel}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <ScrollArea className="combobox-list" id={listId} role="listbox" label={label}>
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`combobox-option${index === active ? " active" : ""}${option.value === value ? " selected" : ""}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => commit(index)}
            >
              <span style={option.style}>{option.label}</span>
              {option.value === value && <Check size={12} aria-hidden="true" />}
            </div>
          ))}
        </ScrollArea>
      )}
    </div>
  );
}

export default App;
