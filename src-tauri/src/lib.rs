use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::{LogicalSize, Manager, Size, Window};

#[cfg(target_os = "windows")]
use std::sync::atomic::{AtomicBool, Ordering};

/// Whether Mirror dropped a maximized window to enter fullscreen, so the way out
/// knows to put the maximized window back. Mirror has one window.
#[cfg(target_os = "windows")]
static UNMAXIMIZED_FOR_FULLSCREEN: AtomicBool = AtomicBool::new(false);

const MIN_WIDTH: f64 = 640.0;
const MIN_HEIGHT: f64 = 360.0;
const MAX_WIDTH: f64 = 1920.0;
const MAX_HEIGHT: f64 = 1200.0;
const TARGET_WIDTH: f64 = 1120.0;

/// Computes the window size that matches a video's aspect ratio.
///
/// The aspect ratio is authoritative: the window must always match the picture
/// shape, so scale is only ever applied uniformly. Clamping each axis
/// independently would silently distort extreme ratios such as 32:9 or tall
/// portrait video.
///
/// Order of operations:
///   1. Start at `TARGET_WIDTH` and derive the height from the video aspect.
///   2. Grow uniformly to satisfy the minimums, as far as the maximums allow.
///   3. Never exceed the maximums. When a ratio is too extreme to satisfy both
///      bounds, the maximums win so the window still fits on screen.
///
/// Kept in agreement with `fitWindowToVideo` in `src/lib/player.ts`; both are
/// covered by tests.
fn fitted_size(video_width: f64, video_height: f64) -> Option<(f64, f64)> {
    if !video_width.is_finite() || !video_height.is_finite() {
        return None;
    }
    if video_width <= 0.0 || video_height <= 0.0 {
        return None;
    }

    let aspect = video_width / video_height;
    let mut width = TARGET_WIDTH;
    let mut height = width / aspect;

    // Grow uniformly to honour the minimums, capped so the maximums still hold.
    let grow_to_minimum = (MIN_WIDTH / width).max(MIN_HEIGHT / height).max(1.0);
    let growth_allowed = (MAX_WIDTH / width).min(MAX_HEIGHT / height);
    let growth = grow_to_minimum.min(growth_allowed);

    width *= growth;
    height *= growth;

    Some((width, height))
}

#[tauri::command]
fn resize_to_video(window: Window, width: f64, height: f64) -> Result<(), String> {
    let (target_width, target_height) =
        fitted_size(width, height).ok_or("Video dimensions must be positive numbers")?;

    window
        .set_size(Size::Logical(LogicalSize::new(target_width, target_height)))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_window_pinned(window: Window, pinned: bool) -> Result<(), String> {
    window
        .set_always_on_top(pinned)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_window_fullscreen(window: Window, fullscreen: bool) -> Result<(), String> {
    // Win32 ignores `SetWindowPos` geometry while the window carries
    // `WS_MAXIMIZE`, and tao 0.35 through 0.37 leave that bit set when they
    // switch a window to borderless fullscreen (tauri-apps/tao#1087; the fix in
    // #1088 is unmerged). The fullscreen geometry then lands on the restore
    // rect instead of the window, so entering fullscreen from a maximized
    // window left Mirror at the work area size with the taskbar still showing
    // while the transport hid as if the picture had grown. Both halves below
    // exist for that one cause, and the window is measured around them: the
    // intermediate states they pass through are not presented (see AGENTS.md).
    #[cfg(target_os = "windows")]
    if !fullscreen && UNMAXIMIZED_FOR_FULLSCREEN.swap(false, Ordering::SeqCst) {
        // Maximize before tao restores its saved placement: that restore puts
        // the normal rect back first and maximizes on top of it, which is one
        // visible frame of a small window.
        window
            .maximize()
            .map_err(|error| error.to_string())?;
    }

    window
        .set_fullscreen(fullscreen)
        .map_err(|error| error.to_string())?;

    #[cfg(target_os = "windows")]
    if fullscreen && window.is_maximized().unwrap_or(false) {
        // Fullscreen first, so tao saves the maximized placement as the one to
        // come back to. Dropping the maximize afterwards only needs the
        // geometry re-applied, which is the one thing tao could not do itself.
        window
            .unmaximize()
            .map_err(|error| error.to_string())?;
        UNMAXIMIZED_FOR_FULLSCREEN.store(true, Ordering::SeqCst);

        if let Some(monitor) = window.current_monitor().map_err(|error| error.to_string())? {
            window
                .set_position(*monitor.position())
                .and_then(|_| window.set_size(*monitor.size()))
                .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

/// The system's installed fonts, split into the two lists the settings panel
/// offers: every family, and the monospace subset.
#[derive(Clone, Serialize)]
struct SystemFonts {
    families: Vec<String>,
    monospace: Vec<String>,
}

/// Builds the font dropdown lists from `(family, is-monospace)` pairs.
///
/// A family repeats once per face (regular, bold, italic…), so entries are
/// deduplicated case-insensitively and sorted the way a person scans a list —
/// `arial` before `Cascadia Code`, not wherever byte order puts capitals.
fn font_lists(faces: impl IntoIterator<Item = (String, bool)>) -> SystemFonts {
    let mut seen = HashSet::new();
    let mut families = Vec::new();
    let mut monospace = Vec::new();
    for (family, is_monospace) in faces {
        let family = family.trim();
        if family.is_empty() || !seen.insert(family.to_lowercase()) {
            continue;
        }
        let family = family.to_string();
        if is_monospace {
            monospace.push(family.clone());
        }
        families.push(family);
    }
    families.sort_by_key(|name| name.to_lowercase());
    monospace.sort_by_key(|name| name.to_lowercase());
    SystemFonts { families, monospace }
}

/// Enumerates the fonts the OS has installed. `fontdb` only reads the name and
/// metrics tables, so this stays a fast scan rather than a full load.
fn enumerate_system_fonts() -> SystemFonts {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();
    font_lists(db.faces().map(|face| {
        // The first entry is the English (US) name unless the font lacks one.
        let family = face
            .families
            .first()
            .map(|(name, _)| name.clone())
            .unwrap_or_default();
        (family, face.monospaced)
    }))
}

/// Installed fonts cannot change while Mirror runs, so enumerate once and
/// reuse: the first settings render waits, later ones do not.
static SYSTEM_FONTS: OnceLock<SystemFonts> = OnceLock::new();

#[tauri::command]
fn list_system_fonts() -> Result<SystemFonts, String> {
    Ok(SYSTEM_FONTS.get_or_init(enumerate_system_fonts).clone())
}

/// Video file paths under any of `paths`, in the order a person would list
/// them.
///
/// A directory is walked recursively — its own files first, then each
/// subdirectory's — and a file is kept when its extension is one of
/// `extensions`. Only the native side can enumerate a folder, so that is all
/// this does; the extension list is passed in rather than written down again
/// here, so the frontend stays its single source of truth.
///
/// One unreadable folder must not sink the whole selection, so entries that
/// cannot be read are skipped. A directory reached through a symlink is not
/// walked: a link that points back at a parent would otherwise loop forever.
#[tauri::command]
fn collect_video_paths(paths: Vec<String>, extensions: Vec<String>) -> Result<Vec<String>, String> {
    let extensions: HashSet<String> = extensions
        .iter()
        .map(|extension| extension.trim_start_matches('.').to_lowercase())
        .filter(|extension| !extension.is_empty())
        .collect();

    let mut collected = Vec::new();
    for path in &paths {
        collect_video_path(Path::new(path), &extensions, &mut collected);
    }

    // IPC carries UTF-8, so a name that is not valid UTF-8 is dropped rather
    // than mangled into one that could never be opened again.
    Ok(collected
        .into_iter()
        .filter_map(|path| path.to_str().map(String::from))
        .collect())
}

/// Adds one entry of a selection: a file offers itself, a directory brings its
/// contents.
fn collect_video_path(path: &Path, extensions: &HashSet<String>, collected: &mut Vec<PathBuf>) {
    match fs::metadata(path) {
        Ok(metadata) if metadata.is_dir() => collect_directory(path, extensions, collected),
        // A file the caller picked is allowed through without an extension — the
        // media element decides what it can decode — but a file the walk finds
        // must carry a listed one.
        Ok(_) if extension_of(path).map_or(true, |ext| extensions.contains(&ext)) => {
            collected.push(path.to_path_buf())
        }
        _ => {}
    }
}

/// Walks one directory: its video files in name order, then each of its
/// subdirectories the same way.
fn collect_directory(dir: &Path, extensions: &HashSet<String>, collected: &mut Vec<PathBuf>) {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    let mut files = Vec::new();
    let mut directories = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let is_link = entry
            .file_type()
            .map(|kind| kind.is_symlink())
            .unwrap_or(false);
        // A link to a file is a video like any other; a link to a directory is
        // where the walk could come back around.
        let Ok(metadata) = fs::metadata(&path) else {
            continue;
        };
        if metadata.is_dir() {
            if !is_link {
                directories.push(path);
            }
        } else if is_video_path(&path, extensions) {
            files.push(path);
        }
    }

    sort_by_name(&mut files);
    sort_by_name(&mut directories);
    collected.append(&mut files);
    for directory in directories {
        collect_directory(&directory, extensions, collected);
    }
}

/// Sorts like a person scans a list: by file name, ignoring case.
fn sort_by_name(paths: &mut [PathBuf]) {
    paths.sort_by_cached_key(|path| {
        path.file_name()
            .map(|name| name.to_string_lossy().to_lowercase())
            .unwrap_or_default()
    });
}

/// Whether a file's extension — case-insensitively, dot or no dot — is one of
/// the listed ones.
fn is_video_path(path: &Path, extensions: &HashSet<String>) -> bool {
    extension_of(path).is_some_and(|extension| extensions.contains(&extension))
}

/// A file name's extension, lowercased and without its dot. A name that carries
/// no extension at all — or nothing after the dot — has none.
fn extension_of(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_lowercase();
    let extension = extension.trim_start_matches('.').to_string();
    (!extension.is_empty()).then_some(extension)
}

#[cfg(target_os = "windows")]
fn apply_glass(window: &tauri::WebviewWindow) {
    use window_vibrancy::apply_acrylic;
    let _ = apply_acrylic(window, Some((9, 9, 11, 60)));
}

#[cfg(target_os = "macos")]
fn apply_glass(window: &tauri::WebviewWindow) {
    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
    let _ = apply_vibrancy(window, NSVisualEffectMaterial::HudWindow, None, Some(12.0));
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn apply_glass(_window: &tauri::WebviewWindow) {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());

    // The updater plugin reads `plugins > updater` from tauri.conf.json, which
    // is where the release endpoint and signing public key live.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                apply_glass(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            resize_to_video,
            set_window_pinned,
            set_window_fullscreen,
            list_system_fonts,
            collect_video_paths
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mirror");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Aspect ratio must survive fitting; this is the property Mirror promises.
    fn assert_aspect_kept(video_width: f64, video_height: f64) {
        let (width, height) = fitted_size(video_width, video_height).expect("valid dimensions");
        let wanted = video_width / video_height;
        let got = width / height;
        assert!(
            (wanted - got).abs() < 0.02,
            "{video_width}x{video_height}: wanted ratio {wanted:.4}, got {got:.4} ({width:.1}x{height:.1})"
        );
    }

    #[test]
    fn keeps_aspect_for_common_shapes() {
        for (width, height) in [
            (1920.0, 1080.0),
            (1280.0, 720.0),
            (720.0, 1280.0),
            (2560.0, 1080.0),
            (1080.0, 1920.0),
            (3840.0, 2160.0),
        ] {
            assert_aspect_kept(width, height);
        }
    }

    /// Regression: clamping width and height independently used to distort these.
    #[test]
    fn keeps_aspect_for_extreme_shapes() {
        for (width, height) in [
            (3840.0, 240.0),  // very wide
            (100.0, 2000.0),  // very tall
            (720.0, 5760.0),  // extreme portrait
            (5120.0, 1440.0), // super ultrawide
        ] {
            assert_aspect_kept(width, height);
        }
    }

    #[test]
    fn uses_target_width_for_landscape_video() {
        let (width, height) = fitted_size(1920.0, 1080.0).unwrap();
        assert!((width - TARGET_WIDTH).abs() < 0.01, "width was {width}");
        assert!((height - 630.0).abs() < 1.0, "height was {height}");
    }

    #[test]
    fn never_exceeds_the_maximums() {
        for (width, height) in [
            (3840.0, 240.0),
            (5120.0, 1440.0),
            (100.0, 2000.0),
            (1920.0, 1080.0),
        ] {
            let (fitted_width, fitted_height) = fitted_size(width, height).unwrap();
            assert!(
                fitted_width <= MAX_WIDTH + 0.01,
                "width {fitted_width} exceeded"
            );
            assert!(
                fitted_height <= MAX_HEIGHT + 0.01,
                "height {fitted_height} exceeded"
            );
        }
    }

    #[test]
    fn respects_minimums_when_they_fit() {
        let (width, height) = fitted_size(1920.0, 1080.0).unwrap();
        assert!(width >= MIN_WIDTH);
        assert!(height >= MIN_HEIGHT);
    }

    #[test]
    fn rejects_unusable_dimensions() {
        assert!(fitted_size(0.0, 1080.0).is_none());
        assert!(fitted_size(1920.0, 0.0).is_none());
        assert!(fitted_size(-1920.0, 1080.0).is_none());
        assert!(fitted_size(f64::NAN, 1080.0).is_none());
        assert!(fitted_size(1920.0, f64::INFINITY).is_none());
    }

    /// The frontend mirrors this function; keep both in step on a known case.
    #[test]
    fn matches_the_frontend_expectation() {
        let (width, height) = fitted_size(2560.0, 1080.0).unwrap();
        assert!((width / height - 2560.0 / 1080.0).abs() < 0.01);
        assert!((width - 1120.0).abs() < 0.01, "width was {width}");
    }

    /// A scratch directory tree that removes itself when the test ends.
    struct TempTree {
        root: PathBuf,
    }

    impl TempTree {
        fn new(name: &str) -> Self {
            let root =
                std::env::temp_dir().join(format!("mirror-collect-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&root);
            fs::create_dir_all(&root).expect("a scratch directory");
            Self { root }
        }

        /// Creates an empty file at a slash-separated path under the root and
        /// answers with the path the frontend would receive.
        fn write(&self, relative: &str) -> String {
            let path = self
                .root
                .join(relative.replace('/', std::path::MAIN_SEPARATOR_STR));
            fs::create_dir_all(path.parent().expect("a parent directory"))
                .expect("the parent directory");
            fs::write(&path, b"").expect("a scratch file");
            path_string(&path)
        }
    }

    impl Drop for TempTree {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn path_string(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

    /// The file names of a collected list, which is what the order is about.
    fn names(paths: &[String]) -> Vec<String> {
        paths
            .iter()
            .map(|path| {
                Path::new(path)
                    .file_name()
                    .map(|name| name.to_string_lossy().into_owned())
                    .unwrap_or_default()
            })
            .collect()
    }

    /// A folder is walked recursively: its own files in name order, then each
    /// subdirectory's, and only the listed extensions come back.
    #[test]
    fn collect_expands_a_folder_in_name_order() {
        let tree = TempTree::new("order");
        tree.write("b.mp4");
        tree.write("A.mkv");
        tree.write("notes.txt");
        tree.write("Season 1/e02.mp4");
        tree.write("Season 1/e01.mkv");
        tree.write("Season 1/cover.jpg");
        tree.write("Season 1/Extras/trailer.mp4");
        tree.write("Season 2/e03.mp4");

        let collected = collect_video_paths(
            vec![path_string(&tree.root)],
            vec!["mp4".into(), "mkv".into()],
        )
        .expect("a path list");

        assert_eq!(
            names(&collected),
            [
                "A.mkv",
                "b.mp4",
                "e01.mkv",
                "e02.mp4",
                "trailer.mp4",
                "e03.mp4"
            ]
        );
    }

    /// A flat selection keeps the video files and drops anything else,
    /// including a path that is no longer there.
    #[test]
    fn collect_keeps_files_and_skips_the_rest() {
        let tree = TempTree::new("files");
        let video = tree.write("clip.MP4");
        let notes = tree.write("notes.txt");
        let missing = path_string(&tree.root.join("gone.mp4"));

        let collected =
            collect_video_paths(vec![video.clone(), notes, missing], vec![".mp4".into()])
                .expect("a path list");

        assert_eq!(collected, [video]);
    }

    /// A file the caller picked without an extension is kept, while the walk
    /// only takes files whose extension is listed.
    #[test]
    fn collect_lets_a_picked_file_through_without_an_extension() {
        let tree = TempTree::new("extensionless");
        let picked = tree.write("mystery-clip");
        tree.write("Season/unnamed");
        tree.write("Season/bonus.mp4");

        let collected = collect_video_paths(
            vec![picked.clone(), path_string(&tree.root.join("Season"))],
            vec!["mp4".into()],
        )
        .expect("a path list");

        assert_eq!(names(&collected), ["mystery-clip", "bonus.mp4"]);
    }

    /// Nothing to collect is an empty answer, not a failure.
    #[test]
    fn collect_answers_nothing_for_an_empty_selection() {
        assert!(collect_video_paths(Vec::new(), vec!["mp4".into()])
            .expect("a path list")
            .is_empty());

        let tree = TempTree::new("empty");
        let collected = collect_video_paths(vec![path_string(&tree.root)], vec!["mp4".into()])
            .expect("a path list");
        assert!(collected.is_empty());
    }

    #[test]
    fn font_lists_dedup_sort_and_split() {
        let fonts = font_lists([
            ("Segoe UI".into(), false),
            ("Segoe UI".into(), false), // the same family in another face
            ("Cascadia Code".into(), true),
            ("Cascadia Code".into(), true), // its italic face
            ("Consolas".into(), true),
            ("arial".into(), false),
            ("   ".into(), false), // a face with no usable family name
        ]);
        assert_eq!(
            fonts.families,
            ["arial", "Cascadia Code", "Consolas", "Segoe UI"]
        );
        assert_eq!(fonts.monospace, ["Cascadia Code", "Consolas"]);
        assert!(fonts
            .monospace
            .iter()
            .all(|mono| fonts.families.contains(mono)));
    }

    #[test]
    fn font_lists_tolerate_an_empty_collection() {
        let fonts = font_lists([]);
        assert!(fonts.families.is_empty());
        assert!(fonts.monospace.is_empty());
    }
}
