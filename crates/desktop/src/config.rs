//! Per-OS data directory resolution and window-state persistence (spec DESK-02/DESK-03).

use directories::BaseDirs;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub const DEFAULT_WIDTH: u32 = 1280;
pub const DEFAULT_HEIGHT: u32 = 800;
pub const MIN_WIDTH: u32 = 960;
pub const MIN_HEIGHT: u32 = 640;

/// Resolves the stable per-user data directory for OpenFold's IndexedDB store and window-state
/// file. This origin/location must never move across versions -- IndexedDB is origin-keyed, and
/// an unstable data dir silently wipes local history (spec DESK-02 AC2).
///
///   Windows: `%LOCALAPPDATA%\OpenFold`
///   macOS:   `~/Library/Application Support/OpenFold`
///   Linux:   `~/.local/share/openfold`
pub fn resolve_data_dir() -> Option<PathBuf> {
    let base = BaseDirs::new()?;
    #[cfg(target_os = "windows")]
    {
        Some(base.data_local_dir().join("OpenFold"))
    }
    #[cfg(target_os = "macos")]
    {
        Some(base.data_dir().join("OpenFold"))
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Some(base.data_dir().join("openfold"))
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub struct WindowState {
    /// -1 is a sentinel meaning "not yet positioned -- center on the primary monitor".
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Default for WindowState {
    fn default() -> Self {
        WindowState { x: -1, y: -1, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
    }
}

/// Loads window state from `path`, falling back to defaults on any read/parse failure (missing
/// file, corrupt JSON, or a schema from a future/older version) -- corruption never blocks launch.
pub fn load_window_state(path: &Path) -> WindowState {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str(&contents).ok())
        .unwrap_or_default()
}

pub fn save_window_state(path: &Path, state: &WindowState) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(state).expect("WindowState always serializes");
    std::fs::write(path, json)
}

#[derive(Debug, Clone, Copy)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

fn rects_overlap(a: &Rect, b: &Rect) -> bool {
    a.x < b.x + b.width as i32 && a.x + (a.width as i32) > b.x && a.y < b.y + (b.height as i32) && a.y + (a.height as i32) > b.y
}

/// Pulls an off-screen window rect back onto a visible monitor. An empty monitor list (some
/// Wayland compositors forbid querying absolute monitor geometry) is treated as "can't verify,
/// don't touch it" -- the state passes through unchanged rather than guessing.
pub fn clamp_to_monitors(state: &WindowState, monitors: &[Rect]) -> WindowState {
    if monitors.is_empty() {
        return *state;
    }
    let window_rect = Rect { x: state.x, y: state.y, width: state.width, height: state.height };
    if monitors.iter().any(|m| rects_overlap(&window_rect, m)) {
        return *state;
    }
    let primary = monitors[0];
    WindowState {
        x: primary.x,
        y: primary.y,
        width: state.width.min(primary.width).max(MIN_WIDTH.min(primary.width)),
        height: state.height.min(primary.height).max(MIN_HEIGHT.min(primary.height)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_os = "windows")]
    fn data_dir_is_under_local_appdata_on_windows() {
        let dir = resolve_data_dir().expect("BaseDirs should resolve on a real machine");
        assert!(dir.ends_with("OpenFold"));
        let local_appdata = std::env::var("LOCALAPPDATA").expect("LOCALAPPDATA should be set on Windows");
        assert!(dir.starts_with(local_appdata));
    }

    #[test]
    fn window_state_default_centers_at_the_spec_size() {
        let state = WindowState::default();
        assert_eq!(state.width, 1280);
        assert_eq!(state.height, 800);
        assert_eq!(state.x, -1);
        assert_eq!(state.y, -1);
    }

    #[test]
    fn round_trips_through_save_and_load() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("window-state.json");
        let state = WindowState { x: 100, y: 200, width: 1024, height: 768 };
        save_window_state(&path, &state).unwrap();
        assert_eq!(load_window_state(&path), state);
    }

    #[test]
    fn load_from_a_missing_file_falls_back_to_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("does-not-exist.json");
        assert_eq!(load_window_state(&path), WindowState::default());
    }

    #[test]
    fn load_from_corrupt_json_falls_back_to_defaults_instead_of_panicking() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("corrupt.json");
        std::fs::write(&path, "{ not valid json ").unwrap();
        assert_eq!(load_window_state(&path), WindowState::default());
    }

    #[test]
    fn load_from_a_future_version_schema_falls_back_to_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("future.json");
        std::fs::write(&path, r#"{"totallyDifferentSchema": true}"#).unwrap();
        assert_eq!(load_window_state(&path), WindowState::default());
    }

    #[test]
    fn clamp_leaves_a_window_that_overlaps_a_monitor_unchanged() {
        let state = WindowState { x: 100, y: 100, width: 1280, height: 800 };
        let monitors = [Rect { x: 0, y: 0, width: 1920, height: 1080 }];
        assert_eq!(clamp_to_monitors(&state, &monitors), state);
    }

    #[test]
    fn clamp_pulls_a_fully_off_screen_window_onto_the_primary_monitor() {
        // The second monitor that this window used to live on is now disconnected.
        let state = WindowState { x: 5000, y: 5000, width: 1280, height: 800 };
        let monitors = [Rect { x: 0, y: 0, width: 1920, height: 1080 }];
        let clamped = clamp_to_monitors(&state, &monitors);
        assert_eq!(clamped.x, 0);
        assert_eq!(clamped.y, 0);
        assert!(clamped.width <= 1920);
        assert!(clamped.height <= 1080);
    }

    #[test]
    fn clamp_shrinks_a_window_larger_than_the_only_monitor() {
        let state = WindowState { x: 5000, y: 5000, width: 4000, height: 3000 };
        let monitors = [Rect { x: 0, y: 0, width: 1920, height: 1080 }];
        let clamped = clamp_to_monitors(&state, &monitors);
        assert!(clamped.width <= 1920);
        assert!(clamped.height <= 1080);
    }

    #[test]
    fn clamp_with_an_empty_monitor_list_passes_through_unchanged() {
        let state = WindowState { x: 5000, y: 5000, width: 1280, height: 800 };
        assert_eq!(clamp_to_monitors(&state, &[]), state);
    }
}
