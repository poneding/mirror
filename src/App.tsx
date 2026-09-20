import {
  Check,
  ChevronDown,
  Command,
  Download,
  FolderOpen,
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
import { ChangeEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CHROME_HIDE_DELAY_MS,
  FALLBACK_VERSION,
  HISTORY_WRITE_INTERVAL_MS,
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
  type Theme,
  type HistoryEntry,
  clamp,
  detectPlatform,
  fileNameFromPath,
  formatTime,
  getInitialBoolean,
  getInitialLanguage,
  getInitialNumber,
  getInitialPlaybackMode,
  getInitialTheme,
  historyToMediaItem,
  isSupportedVideo,
  isTypingTarget,
  nextIndex,
  parseHistory,
  parseStoredPlaylist,
  recordHistory,
  removeHistoryEntry,
  resolveActiveId,
  resolveAutoplay,
  resolveEndedAction,
  resolveEscape,
  resolveShortcut,
  resumePosition,
  shortcutKeys,
  snapSpeed,
  stepSpeed,
  type ShortcutId,
} from "./lib/player";
import { type InlineNode, parseMarkdown } from "./lib/markdown";
import logo from "./assets/logo.png";

const isTauri = () => "__TAURI_INTERNALS__" in window;

/** Where the update notice is in its lifecycle; `Update` holds the release itself. */
type UpdateStatus = "idle" | "checking" | "current" | "installing" | "installed" | "error";

const copy = {
  zh: {
    add: "添加视频",
    open: "打开视频",
    playlist: "播放列表",
    settings: "设置",
    noVideos: "播放列表还是空的",
    addFirst: "添加一个视频，开始你的第一段播放",
    appearance: "外观",
    theme: "主题",
    dark: "深色",
    light: "浅色",
    system: "跟随系统",
    language: "语言",
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
    clearHistory: "自动清除播放记录",
    checkUpdate: "检查更新",
    checking: "检查中…",
    upToDate: "已是最新版本",
    updateAvailable: "有新版本可用",
    installUpdate: "下载并安装",
    installing: "下载中",
    restartToApply: "更新已安装，重启应用后生效",
    updateFailed: "检查更新失败：",
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
    open: "Open video",
    playlist: "Playlist",
    settings: "Settings",
    noVideos: "Your playlist is empty",
    addFirst: "Add a video to start your first session",
    appearance: "Appearance",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    system: "System",
    language: "Language",
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
    clearHistory: "Clear watch history automatically",
    checkUpdate: "Check for updates",
    checking: "Checking…",
    upToDate: "You're up to date",
    updateAvailable: "Update available",
    installUpdate: "Download and install",
    installing: "Downloading",
    restartToApply: "Update installed — restart Mirror to apply it",
    updateFailed: "Update check failed: ",
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

const store = { getItem: (key: string) => localStorage.getItem(key) };

/** Picks the volume glyph that matches the current level. */
function volumeIcon(level: number, size: number) {
  if (level === 0) return <VolumeX size={size} />;
  if (level < 0.5) return <Volume1 size={size} />;
  return <Volume2 size={size} />;
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hideChromeTimer = useRef<number | undefined>(undefined);
  const osdTimer = useRef<number | undefined>(undefined);
  const historyWriteAt = useRef(0);
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
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(() => getInitialPlaybackMode(store));
  const [seekStep, setSeekStep] = useState(() => getInitialNumber(store, STORAGE_KEYS.seekStep, 10, 5, 60));
  const [speed, setSpeed] = useState(() => snapSpeed(getInitialNumber(store, STORAGE_KEYS.speed, 1, 0.25, 2)));
  const [volume, setVolume] = useState(() => getInitialNumber(store, STORAGE_KEYS.volume, 0.8, 0, 1));
  const [isPinned, setIsPinned] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [toast, setToast] = useState("");
  const [autoUpdate, setAutoUpdate] = useState(() => getInitialBoolean(store, STORAGE_KEYS.autoUpdate, true));
  const [autoClearHistory, setAutoClearHistory] = useState(() => getInitialBoolean(store, STORAGE_KEYS.autoClearHistory, false));
  const [isMaximized, setIsMaximized] = useState(false);
  const [osd, setOsd] = useState<{ icon: ReactNode; text: string } | null>(null);
  const [appVersion, setAppVersion] = useState(FALLBACK_VERSION);
  const [history, setHistory] = useState<HistoryEntry[]>(() => parseHistory(localStorage.getItem(STORAGE_KEYS.history)));
  const [panelTab, setPanelTab] = useState<"playlist" | "history">("playlist");
  const [available, setAvailable] = useState<Update | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState("");

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
   * user asked for reports what happened.
   */
  const runUpdateCheck = useCallback(async (manual: boolean) => {
    if (!isTauri()) return;
    setUpdateStatus("checking");
    setUpdateError("");
    try {
      const found = await check();
      setAvailable(found);
      setUpdateStatus(!found && manual ? "current" : "idle");
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : String(error));
      setUpdateStatus(manual ? "error" : "idle");
    }
  }, []);

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
    void runUpdateCheck(false);
  }, [autoUpdate, runUpdateCheck]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  }, [theme]);

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
    localStorage.setItem(STORAGE_KEYS.autoClearHistory, String(autoClearHistory));
  }, [autoClearHistory, autoUpdate, language, playbackMode, seekStep, speed, volume]);

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

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed, activeId]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume, activeId]);

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

      switch (shortcut.type) {
        case "escape": {
          const outcome = resolveEscape(panel, isFullscreen);
          if (outcome.handled && "close" in outcome) setPanel(null);
          else if (outcome.handled && outcome.exitFullscreen) void toggleFullscreen();
          return;
        }
        case "toggle-play":
          togglePlay();
          return;
        case "seek":
          seekBy(shortcut.amount * seekStep);
          return;
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    window.clearTimeout(hideChromeTimer.current);
    if (isPlaying && !panel) {
      hideChromeTimer.current = window.setTimeout(() => setChromeVisible(false), CHROME_HIDE_DELAY_MS);
    }
  }, [isPlaying, panel]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "over") {
          setIsDragOver(true);
        } else if (event.payload.type === "drop") {
          setIsDragOver(false);
          createItemsFromPaths(event.payload.paths);
        } else {
          setIsDragOver(false);
        }
      })
      .then((dispose) => {
        unlisten = dispose;
      })
      .catch(() => undefined);
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    showChrome();
    return () => window.clearTimeout(hideChromeTimer.current);
  }, [isPlaying, panel, showChrome]);

  const selectItem = (id: string) => {
    setActiveId(id);
    setPanel(null);
  };

  const createItems = (files: FileList | File[]) => {
    const selected = Array.from(files).filter((file) => isSupportedVideo(file.name));
    const created = selected.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      name: file.name,
      path: file.name,
      source: URL.createObjectURL(file),
      duration: 0,
    }));
    if (created.length === 0) return;
    setItems((current) => [...current, ...created]);
    setActiveId(created[0].id);
    setPanel(null);
  };

  const createItemsFromPaths = (paths: string[]) => {
    const created = paths
      .filter((path) => isSupportedVideo(fileNameFromPath(path)))
      .map((path) => ({
        id: `${path}-${Math.random()}`,
        name: fileNameFromPath(path),
        path,
        source: convertFileSrc(path),
        duration: 0,
      }));
    if (!created.length) return;
    setItems((current) => [...current, ...created]);
    setActiveId(created[0].id);
    setPanel(null);
  };

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
    createItemsFromPaths(paths);
  };

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

  return (
    <main
      className={`mirror-shell ${activeItem ? "has-video" : ""} ${chromeVisible ? "chrome-visible" : "chrome-hidden"} ${panel ? "panel-open" : ""}`}
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
      <header className={`titlebar${isMac ? " mac" : ""}`} data-tauri-drag-region="true">
        <div className="titlebar-actions no-drag">
          <button className={`icon-button subtle ${isPinned ? "active" : ""}`} onClick={() => void togglePinned()} title={isPinned ? strings.pinned : strings.pinWindow} aria-label={isPinned ? strings.pinned : strings.pinWindow}>
            {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
          <button className="icon-button subtle" onClick={() => setPanel("settings")} title={strings.settings} aria-label={strings.settings}>
            <Settings2 size={17} />
          </button>
        </div>
        <div className="titlebar-center" data-tauri-drag-region="true">
          <span>{activeItem?.name ?? ""}</span>
        </div>
        <div className="titlebar-actions no-drag">
          <button className="icon-button subtle" onClick={() => setPanel("playlist")} title={strings.playlist} aria-label={strings.playlist}>
            <ListVideo size={17} />
          </button>
          {!isMac && <span className="window-divider" aria-hidden="true" />}
          {!isMac && (
            <>
              <button className="icon-button subtle window-control" onClick={() => void minimizeWindow()} title={strings.minimize} aria-label={strings.minimize}>
                <Minus size={14} />
              </button>
              {showMaximize && (
                <button className="icon-button subtle window-control" onClick={() => void toggleMaximizeWindow()} title={isMaximized ? strings.restore : strings.maximize} aria-label={isMaximized ? strings.restore : strings.maximize}>
                  {isMaximized ? <Minimize2 size={14} /> : <Square size={14} />}
                </button>
              )}
              <button className="icon-button subtle danger-strong window-control close-control" onClick={() => void closeWindow()} title={strings.close} aria-label={strings.close}>
                <X size={15} />
              </button>
            </>
          )}
        </div>
      </header>

      <section className={`stage ${isDragOver ? "drag-over" : ""}`}>
        {activeItem ? (
          <video
            ref={videoRef}
            className="video-element"
            playsInline
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
            <button className="home-open" onClick={() => void addVideos()}>
              <FolderOpen size={16} />
              {strings.open}
            </button>
          </div>
        )}
        {isDragOver && (
          <div className="drop-overlay">
            <Upload size={34} />
            <strong>{strings.add}</strong>
          </div>
        )}
        {activeItem && !isPlaying && currentTime === 0 && (
          <button className="center-play" onClick={togglePlay} aria-label={strings.playPause}><Play size={25} fill="currentColor" /></button>
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
              <button className="control-button" onClick={() => applyVolume(volume > 0 ? 0 : 0.8)} title={volume === 0 ? "Unmute" : strings.muted} aria-label={volume === 0 ? "Unmute" : strings.muted}>
                {volumeIcon(volume, 17)}
              </button>
              <input aria-label={strings.volume} className="volume-input" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => applyVolume(Number(event.target.value))} style={{ "--progress": `${volume * 100}%` } as CSSProperties} />
            </div>
          </div>
          <div className="controls-center">
            <button className="control-button" onClick={() => moveTrack(-1)} title={strings.nextPrevious} aria-label="Previous"><SkipBack size={17} fill="currentColor" /></button>
            <button className="play-button" onClick={togglePlay} title={strings.playPause} aria-label={strings.playPause}>
              {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            </button>
            <button className="control-button" onClick={() => moveTrack(1)} title={strings.nextPrevious} aria-label="Next"><SkipForward size={17} fill="currentColor" /></button>
          </div>
          <div className="controls-right">
            <Combobox
              value={String(speed)}
              options={speedOptions}
              onChange={(next) => applySpeed(Number(next))}
              label={strings.playbackSpeed}
              placement="up"
              variant="chrome"
            />
            <button className="control-button" onClick={() => void toggleFullscreen()} title={strings.fullScreen} aria-label={strings.fullScreen}>{isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
          </div>
        </div>
      </footer>
      )}

      <input ref={fileInputRef} className="hidden-input" type="file" accept="video/*" multiple onChange={handleFileInput} />

      {panel && (
        <>
          <button className="panel-backdrop" aria-label={strings.closePanel} onClick={() => setPanel(null)} />
          <aside className={`side-panel ${panel}`}>
            <div className="panel-header">
              <h2>{panel === "settings" ? strings.settings : strings.playlist}</h2>
              <button className="icon-button subtle danger-strong" onClick={() => setPanel(null)} title={strings.closePanel} aria-label={strings.closePanel}><X size={17} /></button>
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
                        <button className="icon-button subtle" onClick={() => void addVideos()} title={strings.add} aria-label={strings.add}><Plus size={15} /></button>
                        <button className="icon-button subtle danger" onClick={clearPlaylist} disabled={items.length === 0} title={strings.clearPlaylist} aria-label={strings.clearPlaylist}><Trash2 size={14} /></button>
                      </>
                    ) : (
                      <button className="icon-button subtle danger" onClick={clearHistory} disabled={history.length === 0} title={strings.clearHistoryNow} aria-label={strings.clearHistoryNow}><Trash2 size={14} /></button>
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
                              <span className="playlist-name"><strong>{item.name}</strong><small>{item.duration ? formatTime(item.duration) : "Video"}</small></span>
                            </button>
                            <button className="item-remove" onClick={() => removeItem(item.id)} title={strings.removeItem} aria-label={`${strings.removeItem}: ${item.name}`}><X size={13} /></button>
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
                              <strong>{entry.name}</strong>
                              <small>{formatTime(entry.position)}{entry.duration ? ` / ${formatTime(entry.duration)}` : ""}</small>
                            </span>
                          </button>
                          <button className="item-remove" onClick={() => removeHistory(entry.id)} title={strings.removeItem} aria-label={`${strings.removeItem}: ${entry.name}`}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            ) : (
              <ScrollArea className="panel-body settings-content">
                <SettingSection icon={<Palette size={14} />} title={strings.appearance}>
                  <div className="setting-row">
                    <span className="setting-row-label">{strings.theme}</span>
                    <Combobox value={theme} options={themeOptions} onChange={(next) => setTheme(next as Theme)} label={strings.theme} />
                  </div>
                  <div className="setting-row">
                    <span className="setting-row-label">{strings.language}</span>
                    <Combobox value={language} options={languageOptions} onChange={(next) => setLanguage(next as Language)} label={strings.language} />
                  </div>
                </SettingSection>
                <SettingSection icon={<SlidersHorizontal size={14} />} title={strings.playback}>
                  <div className="range-setting"><div className="setting-label"><span>{strings.seekStep}</span><strong>{seekStep} {strings.seconds}</strong></div><input type="range" min="5" max="60" step="5" value={seekStep} onChange={(event) => setSeekStep(Number(event.target.value))} style={{ "--progress": `${((seekStep - 5) / 55) * 100}%` } as CSSProperties} /></div>
                  <div className="setting-label"><span>{strings.playbackMode}</span></div>
                  <div className="mode-list">{playbackOptions.map(({ key, label, icon: Icon }) => <button key={key} className={playbackMode === key ? "selected" : ""} onClick={() => setPlaybackMode(key)}><span><Icon size={15} />{label}</span>{playbackMode === key && <Zap size={13} />}</button>)}</div>
                  <ToggleRow label={strings.clearHistory} checked={autoClearHistory} onChange={setAutoClearHistory} />
                </SettingSection>
                <SettingSection
                  icon={<RefreshCw size={14} />}
                  title={strings.update}
                  action={isTauri() ? (
                    <button className="ghost-button" onClick={() => void runUpdateCheck(true)} disabled={updateBusy}>
                      <RefreshCw size={12} />
                      {updateStatus === "checking" ? strings.checking : strings.checkUpdate}
                    </button>
                  ) : undefined}
                >
                  <ToggleRow label={strings.autoUpdate} checked={autoUpdate} onChange={setAutoUpdate} />
                  {isTauri() && (updateStatusText !== "" || available !== null) && (
                    <div className="update-block">
                      {updateStatusText && <p className={`update-status ${updateStatus === "error" ? "error" : ""}`}>{updateStatusText}</p>}
                      {available && (
                        <>
                          <p className="update-status"><strong>v{available.version}</strong> · {strings.updateAvailable}</p>
                          <Changelog body={available.body ?? ""} />
                          {updateStatus !== "installed" && (
                            <button className="update-button" onClick={() => void installUpdate()} disabled={updateBusy}>
                              <Download size={14} />
                              {updateStatus === "installing" ? strings.installing : strings.installUpdate}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </SettingSection>
                <SettingSection icon={<Command size={14} />} title={strings.shortcuts}>
                  {SHORTCUT_ORDER.map((id) => (
                    <ShortcutRow key={id} keys={shortcutKeys(id, platform)} label={shortcutLabels[id]} />
                  ))}
                </SettingSection>
                <SettingSection icon={<Info size={14} />} title={strings.about}>
                  <div className="about-row"><span>{strings.version}</span><strong>v{appVersion}</strong></div>
                  <div className="about-row"><span>{strings.repository}</span><strong className="about-repo">{PROJECT.repository}</strong></div>
                </SettingSection>
              </ScrollArea>
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
 * The release notes of the pending update.
 *
 * Blocks become elements, never markup: the text arrives over the network, so
 * a commit message containing a tag must stay text.
 */
function Changelog({ body }: { body: string }) {
  return (
    <div className="changelog">
      {parseMarkdown(body).map((block, index) => {
        switch (block.type) {
          case "heading":
            return <h4 key={index} className={block.level >= 3 ? "changelog-group" : undefined}>{inline(block.content)}</h4>;
          case "list":
            return block.ordered
              ? <ol key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ol>
              : <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>;
          case "rule":
            return <hr key={index} />;
          default:
            return <p key={index}>{inline(block.content)}</p>;
        }
      })}
    </div>
  );
}

/** Renders one line of release notes; links stay text so nothing navigates away. */
function inline(nodes: InlineNode[]) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "strong":
        return <strong key={index}>{node.value}</strong>;
      case "code":
        return <code key={index}>{node.value}</code>;
      case "link":
        return <span className="changelog-link" key={index} title={node.href}>{node.value}</span>;
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

type ComboboxOption = { value: string; label: string };

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
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  role?: string;
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
 * Dropdown listbox for a small, fixed set of choices.
 *
 * Implemented as a real combobox so the trigger keeps focus and the active
 * option is tracked with `aria-activedescendant`. Keys it handles are stopped
 * from reaching the global shortcut listener — otherwise Space would also
 * toggle playback and the arrows would change the volume.
 */
function Combobox({
  value,
  options,
  onChange,
  label,
  placement = "down",
  variant = "field",
}: {
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  label: string;
  placement?: "down" | "up";
  variant?: "field" | "chrome";
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
  };

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
        <ul className="combobox-list" role="listbox" id={listId} aria-label={label}>
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`combobox-option${index === active ? " active" : ""}${option.value === value ? " selected" : ""}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => commit(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={12} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
