//! Pure JSON envelope router for the SPA <-> Rust IPC bridge (spec DESK-04). `route` never panics
//! and never blocks -- malformed input or an unknown method always yields a typed `ok:false`
//! envelope, so the promise on the TypeScript side settles (reject) instead of hanging forever.

use serde::Deserialize;
use serde_json::{json, Value};

/// Bumped whenever a new IPC method is added or an existing one's shape changes -- gates future
/// methods (e.g. DEF-01's SQLite bridge) the same way api versioning gates any wire protocol.
pub const PROTOCOL_VERSION: u32 = 1;

#[derive(Deserialize)]
struct IpcRequest {
    id: String,
    method: String,
}

fn current_platform() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

fn ok_envelope(id: &str, result: Value) -> String {
    json!({ "id": id, "ok": true, "result": result }).to_string()
}

fn err_envelope(id: &str, code: &str, message: &str) -> String {
    json!({ "id": id, "ok": false, "error": { "code": code, "message": message } }).to_string()
}

/// `id: "unknown"` is used only when the request itself couldn't be parsed (no caller id to
/// correlate back to). A well-formed request whose id is preserved even for an unknown method --
/// so the caller's pending promise always resolves, never hangs on the 5s bridge.ts timeout
/// unless the request truly never arrived.
pub fn route(raw: &str) -> String {
    let request: IpcRequest = match serde_json::from_str(raw) {
        Ok(r) => r,
        Err(_) => return err_envelope("unknown", "malformed_request", "request body is not a valid IPC envelope"),
    };

    match request.method.as_str() {
        "ping" => ok_envelope(
            &request.id,
            json!({
                "version": env!("CARGO_PKG_VERSION"),
                "platform": current_platform(),
                "protocolVersion": PROTOCOL_VERSION,
            }),
        ),
        other => err_envelope(&request.id, "unknown_method", &format!("no such method: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(response: &str) -> Value {
        serde_json::from_str(response).expect("route() must always return valid JSON")
    }

    #[test]
    fn ping_returns_a_spec_shaped_result_with_the_callers_id() {
        let response = parse(&route(r#"{"id":"req-1","method":"ping"}"#));
        assert_eq!(response["id"], "req-1");
        assert_eq!(response["ok"], true);
        assert_eq!(response["result"]["protocolVersion"], 1);
        assert!(response["result"]["version"].is_string());
        assert!(response["result"]["platform"].is_string());
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn ping_reports_the_actual_host_platform() {
        let response = parse(&route(r#"{"id":"1","method":"ping"}"#));
        assert_eq!(response["result"]["platform"], "windows");
    }

    #[test]
    fn ping_carries_params_through_without_requiring_them() {
        let response = parse(&route(r#"{"id":"1","method":"ping","params":{"anything":true}}"#));
        assert_eq!(response["ok"], true);
    }

    #[test]
    fn an_unknown_method_returns_a_typed_error_preserving_the_callers_id() {
        let response = parse(&route(r#"{"id":"req-2","method":"sqliteQuery"}"#));
        assert_eq!(response["id"], "req-2");
        assert_eq!(response["ok"], false);
        assert_eq!(response["error"]["code"], "unknown_method");
        assert!(response["error"]["message"].as_str().unwrap().contains("sqliteQuery"));
    }

    #[test]
    fn malformed_json_returns_a_typed_error_instead_of_panicking() {
        let response = parse(&route("{ this is not json"));
        assert_eq!(response["ok"], false);
        assert_eq!(response["error"]["code"], "malformed_request");
    }

    #[test]
    fn an_empty_string_returns_a_typed_error_instead_of_panicking() {
        let response = parse(&route(""));
        assert_eq!(response["ok"], false);
    }

    #[test]
    fn valid_json_with_the_wrong_shape_returns_a_typed_error_instead_of_panicking() {
        for input in ["[1,2,3]", "null", "\"just a string\"", "42", r#"{"method":"ping"}"#, r#"{"id":"1"}"#] {
            let response = parse(&route(input));
            assert_eq!(response["ok"], false, "expected ok:false for input: {input}");
        }
    }

    #[test]
    fn protocol_version_is_exactly_one() {
        let response = parse(&route(r#"{"id":"1","method":"ping"}"#));
        assert_eq!(response["result"]["protocolVersion"], 1);
        assert_eq!(PROTOCOL_VERSION, 1);
    }
}
