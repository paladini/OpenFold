# Desktop Shell Specification

## Problem Statement

Test-prep users train in long, focused sessions and often on locked-down or offline machines; a browser tab competes for attention and can't be distributed as a simple installable artifact. OpenFold needs native desktop builds for Windows, macOS, and Linux that are dramatically lighter than Electron — an ultra-fast, low-RAM Rust wrapper around the existing SPA. Per product requirements the wrapper must NOT be Tauri; the candidates are Dioxus and direct use of Wry (analysis and decision in design.md: **Wry + tao**).

## Goals

- [ ] Single native binary per OS launches the full app with zero network access and zero external files (assets embedded)
- [ ] Footprint budgets (PROJECT.md): binary < 10 MB, host-process idle RAM < 50 MB (excluding system webview), cold start < 2 s
- [ ] Behavior parity: every feature that works in the browser build works identically in the shell (same bundle, same IndexedDB persistence)
- [ ] Reproducible packaging documented and scripted for all three OSes in CI

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Tauri, Electron | Excluded by product requirement / PROJECT.md constraints |
| Rust-side business logic or UI (Dioxus components) | Decision D-02: the SPA is the app; Rust is a translation layer only |
| SQLite IPC backend | DEF-01 — the IPC handler ships as a stub only |
| Auto-update mechanism | Post-v1; v1 distributes versioned artifacts |
| Code signing / notarization pipelines | Documented as manual release steps; automation post-v1 |
| Mobile wrappers | PROJECT.md exclusion |

---

## User Stories

### P1: Launch the app natively ⭐ MVP

**User Story**: As a learner, I want to download one file and launch OpenFold like a native app, so that training doesn't depend on a browser or a network.

**Why P1**: The entire feature's purpose.

**Acceptance Criteria**:

1. WHEN the binary runs THEN it SHALL open a native window (tao) hosting the system webview (wry) displaying the production SPA bundle
2. WHEN the app runs THEN all assets SHALL be served from memory via a custom protocol (e.g. `openfold://app/`) backed by `rust-embed` — zero filesystem reads for app assets, zero HTTP
3. WHEN the machine is fully offline THEN launch and every feature SHALL work identically
4. WHEN the window closes THEN the process SHALL exit cleanly (no orphaned processes)

**Independent Test**: Disable networking, run the binary, complete a round, check Task Manager for a single process tree.

---

### P1: Persistent local data in the shell ⭐ MVP

**User Story**: As a learner, I want my history to persist across app restarts in the desktop build, so that desktop training accumulates like browser training.

**Why P1**: Persistence parity is a hard product requirement (local-first).

**Acceptance Criteria**:

1. WHEN the webview uses IndexedDB THEN data SHALL persist across app restarts (webview data directory configured to a stable per-user location: `%LOCALAPPDATA%/OpenFold`, `~/Library/Application Support/OpenFold`, `~/.local/share/openfold`)
2. WHEN the custom protocol serves the app THEN its origin SHALL be stable across launches and versions (IndexedDB is origin-keyed; an unstable origin silently wipes history)
3. WHEN the app updates to a newer version THEN existing IndexedDB data SHALL remain readable (origin + data dir unchanged — verified by an upgrade simulation test)

**Independent Test**: Play a round, quit, relaunch — history shows the round. Repeat after replacing the binary with a rebuilt one.

---

### P1: Window ergonomics ⭐ MVP

**User Story**: As a learner, I want sane window behavior — remembered size/position, minimum size, proper icon and title — so the app feels native rather than wrapped.

**Why P1**: Cheap, and its absence reads as broken.

**Acceptance Criteria**:

1. WHEN the app starts first time THEN the window SHALL open at 1280×800 centered, minimum 960×640
2. WHEN the app restarts THEN it SHALL restore the last window size/position (clamped to visible monitors)
3. WHEN the OS is in dark mode THEN the window chrome SHALL follow (tao theme hint); the SPA already themes itself
4. WHEN the app is packaged THEN it SHALL carry the OpenFold icon and product metadata on all three OSes

**Independent Test**: Resize/move, quit, relaunch on a multi-monitor setup; disconnect the second monitor and relaunch (clamping).

---

### P2: IPC bridge stub

**User Story**: As a future maintainer, I want a versioned, typed IPC channel between the SPA and the Rust host (ping/version/platform only in v1), so that DEF-01 (SQLite) and OS integrations have a paved road.

**Why P2**: Architecture insurance; no v1 user feature needs it.

**Acceptance Criteria**:

1. WHEN the SPA calls `window.openfold.invoke('ping')` THEN the host SHALL respond `{ok: true, version, platform}` via wry's IPC handler
2. WHEN an unknown method is invoked THEN the host SHALL respond with a typed error envelope (never crash, never hang the promise)
3. WHEN the SPA runs in a plain browser THEN the bridge SHALL report `available: false` and the app SHALL behave identically (feature detection, no errors)

---

### P2: Packaged artifacts in CI

**User Story**: As a maintainer, I want CI to produce installable artifacts (MSI or portable exe, .dmg or .app zip, AppImage/deb) on tags, so releases are reproducible.

**Why P2**: Needed by M7 release, not by the M6 demo.

**Acceptance Criteria**:

1. WHEN a release tag builds THEN CI SHALL emit artifacts for Windows x64, macOS arm64+x64, Linux x64
2. WHEN the Windows build runs on a machine without WebView2 THEN the launcher SHALL detect it and direct the user to the Evergreen Bootstrapper (documented; auto-install post-v1)
3. WHEN artifacts are built THEN their sizes SHALL be recorded and the binary-size budget asserted (< 10 MB, webview excluded)

---

## Edge Cases

- WHEN the system webview is missing/broken (WebView2 absent, old WebKitGTK) THEN the shell SHALL show a native error dialog with actionable guidance instead of a blank window
- WHEN a second instance launches THEN it SHALL focus the existing window and exit (single-instance guard) — prevents two webviews racing one IndexedDB
- WHEN the webview crashes THEN the host SHALL offer reload-or-quit (native dialog), not a zombie window
- WHEN the app runs under Wayland vs X11 THEN window restore SHALL degrade gracefully where the protocol forbids absolute positioning

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| DESK-01 | P1: Launch natively (embedded assets, custom protocol) | Design | Pending |
| DESK-02 | P1: Persistent local data (stable origin + data dir) | Design | Pending |
| DESK-03 | P1: Window ergonomics | Design | Pending |
| DESK-04 | P2: IPC bridge stub | Design | Pending |
| DESK-05 | P2: Packaged artifacts in CI | Design | Pending |

**Coverage:** 5 total, 5 mapped to tasks (see tasks.md), 0 unmapped

---

## Success Criteria

- [ ] M6 exit criterion: offline launch + full round + persisted history on Win/macOS/Linux
- [ ] Budgets measured and green: binary < 10 MB, host idle RAM < 50 MB, cold start < 2 s (measurement method documented in design)
- [ ] Zero behavior diffs vs. browser build in a smoke checklist (rounds, dashboard, lessons, export)
- [ ] `cargo test` covers protocol resolution, MIME mapping, single-instance, and IPC envelope logic
