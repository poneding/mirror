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
            set_window_fullscreen
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
}
