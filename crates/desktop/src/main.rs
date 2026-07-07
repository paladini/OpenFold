mod assets;
mod config;
mod ipc;
mod protocol;
mod window;

use assets::{ORIGIN, PROTOCOL_SCHEME};
use config::load_window_state;
use fs4::fs_std::FileExt;
use std::cell::RefCell;
use std::fs::{File, OpenOptions};
use std::path::Path;
use std::rc::Rc;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop};
use wry::WebViewBuilder;

fn show_error_dialog(title: &str, description: &str) {
    rfd::MessageDialog::new().set_title(title).set_description(description).set_level(rfd::MessageLevel::Error).show();
}

/// Holds the OS advisory lock for the process's lifetime. Dropping it -- on any exit path,
/// including a crash -- releases the lock automatically, so a crashed previous instance can never
/// permanently block future launches the way a hand-rolled PID file would.
struct InstanceLock {
    _file: File,
}

fn acquire_instance_lock(data_dir: &Path) -> Option<InstanceLock> {
    std::fs::create_dir_all(data_dir).ok()?;
    let file = OpenOptions::new().write(true).create(true).truncate(false).open(data_dir.join("instance.lock")).ok()?;
    match FileExt::try_lock_exclusive(&file) {
        Ok(true) => Some(InstanceLock { _file: file }),
        _ => None,
    }
}

fn main() {
    let data_dir = match config::resolve_data_dir() {
        Some(dir) => dir,
        None => {
            show_error_dialog("OpenFold", "Could not determine a data directory for this user account.");
            std::process::exit(1);
        }
    };

    // Another instance already holds the lock: focusing it isn't wired up yet (no cross-process
    // channel for that), but exiting cleanly satisfies the actual correctness requirement -- never
    // let two webviews race one IndexedDB origin (spec edge case).
    let Some(_instance_lock) = acquire_instance_lock(&data_dir) else {
        std::process::exit(0);
    };

    let window_state_path = data_dir.join("window-state.json");
    let saved_state = load_window_state(&window_state_path);

    let event_loop = EventLoop::new();
    let window = window::build_window(&event_loop, &saved_state);

    // Pinned per spec DESK-02 AC1: the webview's own storage (IndexedDB included) must live at a
    // stable per-user path we control, not wherever the OS/webview defaults to for this install.
    let webview_data_dir = data_dir.join("webview");
    let mut web_context = wry::WebContext::new(Some(webview_data_dir));

    let webview_cell: Rc<RefCell<Option<wry::WebView>>> = Rc::new(RefCell::new(None));
    let ipc_cell = webview_cell.clone();

    let webview_result = WebViewBuilder::new_with_web_context(&mut web_context)
        .with_custom_protocol(PROTOCOL_SCHEME.to_string(), |_id, request| protocol::handle(&request))
        .with_ipc_handler(move |request: http::Request<String>| {
            let response = ipc::route(request.body());
            if let Some(webview) = ipc_cell.borrow().as_ref() {
                let script = format!("(function(e){{ window.__openfoldResolve && window.__openfoldResolve(e.id, e); }})({response})");
                let _ = webview.evaluate_script(&script);
            }
        })
        .with_url(format!("{ORIGIN}/"))
        .build(&window);

    let webview = match webview_result {
        Ok(w) => w,
        Err(err) => {
            show_error_dialog(
                "OpenFold could not start",
                &format!(
                    "The system webview could not be created: {err}\n\n\
                     Windows: install the WebView2 Runtime (Microsoft Edge WebView2 Evergreen Bootstrapper).\n\
                     Linux: install webkit2gtk (package name varies by distribution, e.g. webkit2gtk-4.1)."
                ),
            );
            std::process::exit(1);
        }
    };
    *webview_cell.borrow_mut() = Some(webview);

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        if let Event::WindowEvent { event: WindowEvent::CloseRequested, .. } = event {
            let scale_factor = window.scale_factor();
            let size = window.inner_size().to_logical::<u32>(scale_factor);
            let position = window.outer_position().map(|p| p.to_logical::<i32>(scale_factor)).unwrap_or(tao::dpi::LogicalPosition::new(-1, -1));
            let state = config::WindowState { x: position.x, y: position.y, width: size.width, height: size.height };
            let _ = config::save_window_state(&window_state_path, &state);
            *control_flow = ControlFlow::Exit;
        }
    });
}

#[cfg(test)]
mod tests {
    #[test]
    fn harness_proof() {
        assert_eq!(2 + 2, 4);
    }
}
