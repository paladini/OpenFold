//! Pure request-handling logic for the `openfold://` custom protocol. No webview involved --
//! `handle` maps an `http::Request` straight to an `http::Response` over the embedded asset map,
//! which is what makes it fully unit-testable without spinning up wry.

use crate::assets::Assets;
use http::{Request, Response, StatusCode};
use std::borrow::Cow;

/// Strips the leading slash and rejects `..` traversal. rust-embed's lookup is a compile-time
/// key/value map (no real filesystem access), so traversal can't escape the embedded set either
/// way -- this exists to make that guarantee explicit and independently testable, not because the
/// underlying mechanism is actually vulnerable without it.
fn normalize_path(raw_path: &str) -> Option<String> {
    let trimmed = raw_path.trim_start_matches('/');
    if trimmed.split('/').any(|segment| segment == "..") {
        return None;
    }
    if trimmed.is_empty() {
        return Some("index.html".to_string());
    }
    Some(trimmed.to_string())
}

fn has_extension(path: &str) -> bool {
    path.rsplit('/').next().is_some_and(|last| last.contains('.'))
}

fn mime_for(path: &str) -> &'static str {
    match path.rsplit('.').next() {
        Some("html") => "text/html; charset=utf-8",
        Some("js") | Some("mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("wasm") => "application/wasm",
        Some("svg") => "image/svg+xml",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("json") => "application/json",
        Some("png") => "image/png",
        Some("ico") => "image/x-icon",
        _ => "application/octet-stream",
    }
}

/// The SPA shell (index.html) must always be revalidated -- it's the entry point a new binary
/// version replaces. Every other embedded asset is content-hashed by the Vite build, so it's safe
/// to cache forever; a new build produces new hashed filenames rather than mutating old ones.
fn cache_control_for(path: &str) -> &'static str {
    if path == "index.html" {
        "no-cache"
    } else {
        "public, max-age=31536000, immutable"
    }
}

fn asset_response(status: StatusCode, path: &str, data: Cow<'static, [u8]>) -> Response<Cow<'static, [u8]>> {
    Response::builder()
        .status(status)
        .header("Content-Type", mime_for(path))
        .header("Cache-Control", cache_control_for(path))
        .body(data)
        .expect("a static status/header response always builds")
}

fn not_found() -> Response<Cow<'static, [u8]>> {
    Response::builder().status(StatusCode::NOT_FOUND).body(Cow::Borrowed(&b""[..])).expect("a static 404 always builds")
}

/// Pure protocol handler: request URI path in, response out. No I/O beyond the in-memory embedded
/// asset map.
pub fn handle(request: &Request<Vec<u8>>) -> Response<Cow<'static, [u8]>> {
    let Some(path) = normalize_path(request.uri().path()) else {
        return not_found();
    };

    if let Some(file) = Assets::get(&path) {
        return asset_response(StatusCode::OK, &path, file.data);
    }

    // SPA client-side routing: an extension-less path that isn't a known asset is a route the
    // React Router (or equivalent) owns, not a missing file -- serve the shell and let it resolve.
    if !has_extension(&path) {
        if let Some(index) = Assets::get("index.html") {
            return asset_response(StatusCode::OK, "index.html", index.data);
        }
    }

    not_found()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn get(path: &str) -> Response<Cow<'static, [u8]>> {
        let request = Request::builder().uri(format!("openfold://app{path}")).body(Vec::new()).unwrap();
        handle(&request)
    }

    #[test]
    fn serves_index_html_for_the_root_path() {
        let response = get("/");
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers().get("Content-Type").unwrap(), "text/html; charset=utf-8");
        assert!(!response.body().is_empty());
    }

    #[test]
    fn serves_index_html_for_an_unknown_extensionless_path_spa_fallback() {
        let response = get("/dashboard");
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers().get("Content-Type").unwrap(), "text/html; charset=utf-8");
    }

    #[test]
    fn serves_index_html_for_a_nested_unknown_extensionless_path() {
        let response = get("/training/opposition-rule");
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[test]
    fn returns_404_for_a_missing_asset_like_path() {
        let response = get("/assets/this-file-does-not-exist.js");
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn returns_404_for_a_missing_asset_with_an_unrecognized_extension() {
        let response = get("/assets/missing.wasm");
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn rejects_dot_dot_traversal() {
        let response = get("/../../../etc/passwd");
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn mime_type_for_html() {
        assert_eq!(mime_for("index.html"), "text/html; charset=utf-8");
    }

    #[test]
    fn mime_type_for_js() {
        assert_eq!(mime_for("assets/index-abc123.js"), "text/javascript; charset=utf-8");
    }

    #[test]
    fn mime_type_for_css() {
        assert_eq!(mime_for("assets/index-abc123.css"), "text/css; charset=utf-8");
    }

    #[test]
    fn mime_type_for_wasm() {
        assert_eq!(mime_for("module.wasm"), "application/wasm");
    }

    #[test]
    fn mime_type_for_svg() {
        assert_eq!(mime_for("icon.svg"), "image/svg+xml");
    }

    #[test]
    fn mime_type_for_woff2() {
        assert_eq!(mime_for("font.woff2"), "font/woff2");
    }

    #[test]
    fn unknown_extensions_fall_back_to_octet_stream() {
        assert_eq!(mime_for("data.bin"), "application/octet-stream");
    }

    #[test]
    fn index_html_is_never_cached_but_hashed_assets_are_cached_forever() {
        assert_eq!(cache_control_for("index.html"), "no-cache");
        assert_eq!(cache_control_for("assets/index-abc123.js"), "public, max-age=31536000, immutable");
    }

    #[test]
    fn a_real_embedded_asset_from_the_manifest_is_served_with_its_own_content() {
        // assets/*.js is produced by every Vite build (hashed filename varies) -- find whichever
        // one actually exists in this build's embedded set rather than hardcoding a hash.
        let js_path = Assets::iter().find(|p| p.ends_with(".js")).expect("a build always emits at least one JS asset");
        let response = get(&format!("/{js_path}"));
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers().get("Content-Type").unwrap(), "text/javascript; charset=utf-8");
        assert!(!response.body().is_empty());
    }
}
