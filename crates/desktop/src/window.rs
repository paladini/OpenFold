//! Window creation and position/size decision logic (spec DESK-03). tao's Window/EventLoop types
//! can't be constructed in a headless `cargo test` run, so the position/centering math is a pure
//! function taking plain rects, independently testable without a real display.

use crate::config::{clamp_to_monitors, Rect, WindowState, MIN_HEIGHT, MIN_WIDTH};

/// Decides where the window should open: restore the saved position if we have one (clamped to
/// still-visible monitors), or center on the primary monitor for a first-ever launch. Falls back
/// to a fixed offset when no monitor geometry is available at all (e.g. some Wayland compositors
/// forbid querying it) -- centering is a nicety, never a launch blocker.
pub fn resolve_window_state(saved: &WindowState, monitors: &[Rect]) -> WindowState {
    let is_first_launch = saved.x < 0 && saved.y < 0;
    if !is_first_launch {
        return clamp_to_monitors(saved, monitors);
    }

    let Some(primary) = monitors.first() else {
        return WindowState { x: 100, y: 100, width: saved.width, height: saved.height };
    };
    let width = saved.width.min(primary.width);
    let height = saved.height.min(primary.height);
    WindowState {
        x: primary.x + ((primary.width - width) / 2) as i32,
        y: primary.y + ((primary.height - height) / 2) as i32,
        width,
        height,
    }
}

pub fn build_window<T>(
    event_loop: &tao::event_loop::EventLoopWindowTarget<T>,
    saved_state: &WindowState,
) -> tao::window::Window {
    let monitors: Vec<Rect> = event_loop
        .available_monitors()
        .map(|m| {
            let pos = m.position();
            let size = m.size();
            Rect { x: pos.x, y: pos.y, width: size.width, height: size.height }
        })
        .collect();

    let resolved = resolve_window_state(saved_state, &monitors);

    tao::window::WindowBuilder::new()
        .with_title("OpenFold")
        .with_inner_size(tao::dpi::LogicalSize::new(resolved.width, resolved.height))
        .with_min_inner_size(tao::dpi::LogicalSize::new(MIN_WIDTH, MIN_HEIGHT))
        .with_position(tao::dpi::LogicalPosition::new(resolved.x, resolved.y))
        .with_theme(None) // None = follow the OS theme (spec DESK-03 AC3)
        .build(event_loop)
        .expect("failed to create the application window")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn primary() -> Rect {
        Rect { x: 0, y: 0, width: 1920, height: 1080 }
    }

    #[test]
    fn first_launch_centers_on_the_primary_monitor() {
        let saved = WindowState::default(); // x=-1, y=-1 sentinel
        let resolved = resolve_window_state(&saved, &[primary()]);
        assert_eq!(resolved.x, (1920 - 1280) / 2);
        assert_eq!(resolved.y, (1080 - 800) / 2);
        assert_eq!(resolved.width, 1280);
        assert_eq!(resolved.height, 800);
    }

    #[test]
    fn first_launch_with_no_monitor_geometry_falls_back_to_a_fixed_offset_instead_of_blocking() {
        let saved = WindowState::default();
        let resolved = resolve_window_state(&saved, &[]);
        assert_eq!(resolved.x, 100);
        assert_eq!(resolved.y, 100);
    }

    #[test]
    fn a_restored_position_within_a_monitor_is_used_as_is() {
        let saved = WindowState { x: 200, y: 150, width: 1024, height: 768 };
        let resolved = resolve_window_state(&saved, &[primary()]);
        assert_eq!(resolved.x, 200);
        assert_eq!(resolved.y, 150);
    }

    #[test]
    fn a_restored_position_on_a_now_disconnected_monitor_is_clamped_back_onto_the_primary() {
        let saved = WindowState { x: 5000, y: 5000, width: 1280, height: 800 };
        let resolved = resolve_window_state(&saved, &[primary()]);
        assert_eq!(resolved.x, 0);
        assert_eq!(resolved.y, 0);
    }

    #[test]
    fn centering_shrinks_a_saved_size_larger_than_the_primary_monitor() {
        let saved = WindowState { x: -1, y: -1, width: 4000, height: 3000 };
        let resolved = resolve_window_state(&saved, &[primary()]);
        assert!(resolved.width <= 1920);
        assert!(resolved.height <= 1080);
    }
}
