# Desktop Shell Tasks

**Design**: `.specs/features/desktop-shell/design.md`
**Status**: Approved

Milestone **M6**. Cross-feature prerequisite: a buildable `apps/web` bundle (game-rounds T10 or later). **Before T1: re-verify current wry/tao crate versions and API shapes via the knowledge-verification chain (STATE.md todo).**

---

## Execution Plan

```
Phase 1:  T1 (crate scaffold)
Phase 2:  T1 → { T2 [P] (config), T3 [P] (assets+protocol), T4 [P] (ipc) } · T5 [P] (bridge.ts — independent, apps/web)
Phase 3:  T2, T3, T4 → T6 (window + main composition)
Phase 4:  T5, T6 → T7 (CI + footprint budgets) → T8 (release artifacts + upgrade verification)
```

---

## Task Breakdown

### T1: Scaffold crates/desktop

**What**: `openfold-desktop` crate in the cargo workspace: wry/tao/rust-embed/serde/directories deps (versions verified per the pre-task note), minimal-binary release profile (`lto`, `opt-level='z'`, `strip`, `panic='abort'`), placeholder main.
**Where**: `crates/desktop/Cargo.toml`, `crates/desktop/src/main.rs`; root `Cargo.toml` (modify)
**Depends on**: None (in-feature)
**Reuses**: cargo workspace stub (procedural-engine T1)
**Requirement**: — (infra)

**Tools**: MCP: `context7` (crate API verification) · Skill: NONE

**Done when**:

- [ ] `cargo build -p openfold-desktop` and `cargo test -p openfold-desktop` (1 placeholder) pass
- [ ] Release profile settings in place
- [ ] Verified crate versions recorded in STATE.md (todo closed)

**Tests**: unit (harness proof)
**Gate**: quick — `cargo test -p openfold-desktop`
**Commit**: `chore(desktop): scaffold wry shell crate`

---

### T2: config module [P]

**What**: Per-OS data-dir resolution (spec DESK-02 AC1 paths), `WindowState` load/save (JSON), monitor clamping, corrupt-file fallback.
**Where**: `crates/desktop/src/config.rs` + unit tests
**Depends on**: T1
**Reuses**: `directories` crate
**Requirement**: DESK-02, DESK-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Data-dir path correct per OS (cfg-gated tests)
- [ ] Round-trip save/load; corrupt JSON falls back to defaults; clamp pulls off-screen rects into a synthetic monitor set
- [ ] Gate check passes: `cargo test -p openfold-desktop`
- [ ] Test count: ≥ 6 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(desktop): config and window-state persistence`

---

### T3: assets + protocol modules [P]

**What**: `rust-embed` of `apps/web/dist` (with a clear compile error when dist is missing), frozen origin constants (+ literal-asserting test), and the pure `handle(request)` protocol function: path normalization (reject `..`), MIME map, SPA index fallback, cache headers.
**Where**: `crates/desktop/src/assets.rs`, `crates/desktop/src/protocol.rs` + unit tests
**Depends on**: T1
**Reuses**: —
**Requirement**: DESK-01, DESK-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `handle` serves index.html for `/` and unknown extension-less paths; 404 for missing asset-like paths; correct MIME for html/js/css/wasm/svg/woff2
- [ ] `..` traversal rejected
- [ ] Origin-constants test asserts the frozen literals with the data-loss warning comment
- [ ] Gate check passes: `cargo test -p openfold-desktop`
- [ ] Test count: ≥ 10 tests pass

**Tests**: unit (pure function, no webview)
**Gate**: quick
**Commit**: `feat(desktop): embedded asset protocol handler`

---

### T4: ipc router [P]

**What**: Pure `route(raw: &str) -> String`: envelope parse, `ping` method (version/platform/protocolVersion), typed error envelopes for unknown methods and malformed JSON.
**Where**: `crates/desktop/src/ipc.rs` + unit tests
**Depends on**: T1
**Reuses**: serde_json
**Requirement**: DESK-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `ping` returns spec-shaped result with the caller's id
- [ ] Unknown method / malformed JSON → `ok:false` envelopes, never a panic (fuzz a few malformed inputs)
- [ ] Gate check passes: `cargo test -p openfold-desktop`
- [ ] Test count: ≥ 6 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(desktop): ipc envelope router`

---

### T5: bridge.ts (SPA side) [P]

**What**: Typed promise bridge over `window.ipc.postMessage`: id correlation, 5 s timeout, `__openfoldResolve` callback registry, `available: false` no-op in plain browsers.
**Where**: `apps/web/src/desktop/bridge.ts` + test
**Depends on**: None (in-feature; contract fixed by design §IPC envelope)
**Reuses**: envelope types (mirrored from design; a shared fixture file keeps TS and Rust tests aligned)
**Requirement**: DESK-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Browser (no `window.ipc`): `available === false`, `invoke` rejects with typed "unavailable"
- [ ] Mocked ipc: resolve/reject per envelope; timeout rejects after 5 s (fake timers)
- [ ] Shared envelope fixtures parse identically in the Rust test suite (fixture file referenced by both)
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 6 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): desktop ipc bridge with feature detection`

---

### T6: window + main composition

**What**: `window.rs` (create window per spec DESK-03: 1280×800 centered, min 960×640, icon, theme-follow, state restore w/ Wayland degradation) and `main.rs` (single-instance guard, event loop, webview with custom protocol + ipc handler + pinned data dir, missing-webview and crash dialogs, clean exit).
**Where**: `crates/desktop/src/window.rs`, `crates/desktop/src/main.rs` (rewrite) + unit tests for pure parts
**Depends on**: T2, T3, T4
**Reuses**: all Phase 2 modules
**Requirement**: DESK-01, DESK-02, DESK-03

**Tools**: MCP: `context7` (wry/tao API confirmation) · Skill: NONE

**Done when**:

- [ ] Manual checklist on the dev OS: offline launch, full round, quit/relaunch persistence, resize/position restore, second-instance focuses first (recorded in PR)
- [ ] Single-instance and state-restore decision logic unit-tested (pure parts extracted)
- [ ] Gate check passes: `cargo build --release -p openfold-desktop && cargo test -p openfold-desktop`
- [ ] Test count: ≥ 4 tests pass

**Tests**: unit (pure parts) + manual launch checklist (per TESTING.md desktop row)
**Gate**: build
**Commit**: `feat(desktop): shell composition with window ergonomics`

---

### T7: Rust CI + footprint budgets

**What**: CI matrix job (win/macos/linux): build web → build release binary → run `cargo test` → measure and assert budgets per design §Footprint measurement (binary < 10 MB; idle host RSS < 50 MB; cold start via ping-roundtrip < 2 s), sizes recorded as artifacts.
**Where**: `.github/workflows/ci.yml` (modify), `crates/desktop/scripts/measure.{ps1,sh}`
**Depends on**: T6 · cross-feature: T5 (ping roundtrip used by the cold-start probe)
**Reuses**: existing CI workflow
**Requirement**: DESK-05 (budgets half)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Three-OS matrix green with budget assertions passing
- [ ] Budget numbers visible in CI artifacts/logs
- [ ] Gate check passes: CI full run

**Tests**: none (CI config + measurement scripts; assertions run in CI)
**Gate**: build (CI)
**Commit**: `ci(desktop): three-os builds with footprint budget gates`

---

### T8: Release artifacts + upgrade verification

**What**: Tag-triggered artifact job (Windows portable exe + note on MSI, macOS .app zip for arm64/x64, Linux AppImage), WebView2-absent guidance path verified, and the IndexedDB upgrade simulation: build A writes → binary swapped for build B → data readable (scripted on the Windows runner); parity smoke checklist doc.
**Where**: `.github/workflows/release.yml`, `crates/desktop/scripts/upgrade-sim.ps1`, `docs/desktop-parity-checklist.md`
**Depends on**: T7
**Reuses**: CI build steps from T7
**Requirement**: DESK-02 (upgrade), DESK-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Tag build emits all artifacts with recorded sizes
- [ ] Upgrade simulation green (history survives binary replacement)
- [ ] Parity checklist committed and executed once (results in PR)
- [ ] Gate check passes: release workflow run on a test tag

**Tests**: none (release config + scripted verification; runs in CI)
**Gate**: build (CI)
**Commit**: `ci(desktop): release artifacts and upgrade simulation`

---

## Parallel Execution Map

```
Phase 1: T1
Phase 2: T1 → { T2 [P], T3 [P], T4 [P] } · T5 [P] (apps/web, independent)
Phase 3: T6 ← T2,T3,T4
Phase 4: T7 ← T6,T5 → T8
```

Rust and TS test suites are mutually independent (TESTING.md) — T5 parallelizes with T2–T4 freely.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 crate scaffold | ✅ Granular |
| T2, T4, T5 | 1 module each | ✅ Granular |
| T3 | 2 files, one serving pipeline (cohesive) | ✅ Granular |
| T6 | 2 files, one composition (cohesive: window is meaningless without main) | ✅ Granular |
| T7, T8 | 1 CI concern each | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | start node | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | None (in-feature) | independent node | ✅ Match |
| T6 | T2, T3, T4 | T2,T3,T4 → T6 | ✅ Match |
| T7 | T6 (+cross T5) | T6,T5 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |

No `[P]` peers interdepend. ✅

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | crate scaffold + harness | unit (harness proof) | unit | ✅ OK |
| T2, T3, T4 | Rust host modules | unit (`cargo test`) | unit | ✅ OK |
| T5 | web TS module | unit | unit | ✅ OK |
| T6 | Rust host (webview-touching) | unit for pure parts + manual launch check (matrix row) | unit + manual checklist | ✅ OK |
| T7, T8 | CI config + scripts | — (config; assertions execute in CI) | none | ✅ OK |

No task defers its tests to another task. ✅
