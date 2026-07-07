# OpenFold — Project State

Persistent memory across sessions. Append-only where practical; prune superseded entries.

## Decisions

| ID | Date | Decision | Rationale |
| -- | ---- | -------- | --------- |
| D-01 | 2026-07-06 | UI framework: **React** (over Vue/Svelte) | Largest Three.js + charting ecosystem (Recharts integrates natively), largest OSS contributor pool. Confirmed by project owner. |
| D-02 | 2026-07-06 | Desktop wrapper: **Wry + tao directly**, not Dioxus, not Tauri | Frontend is a TS/React SPA; Dioxus is a Rust UI framework — adopting it would either duplicate the UI layer or force a Rust rewrite, contradicting the TS requirement. Wry is the webview library Tauri itself is built on, so we get the same footprint characteristics without the Tauri runtime/IPC/plugin machinery we don't need. Full comparative analysis: `.specs/features/desktop-shell/design.md`. |
| D-03 | 2026-07-06 | Persistence: **IndexedDB via Dexie**, behind a `StorageService` interface | Identical code path in browser and desktop (runs inside the webview), zero Rust IPC needed for v1, simplest local-first story. SQLite-over-IPC remains possible later behind the same interface (see Deferred DEF-01). Confirmed by project owner. |
| D-04 | 2026-07-06 | Domain math lives in **pure-TS `packages/core`** with no DOM/Three.js imports | Deterministic, unit-testable without WebGL; Three.js consumes core output. Three.js remains the sole math/rendering engine in the render layer per requirements. |
| D-05 | 2026-07-06 | Problems are stored as **seed + parameters**, never as geometry | Deterministic seeded PRNG makes any historical item regenerable (review mode) and keeps telemetry rows tiny. |
| D-06 | 2026-07-06 | Documentation depth: spec + design + **tasks for all six v1 features** up front | Project owner chose maximum rigor over milestone-lazy task generation; accept that late tasks may need revision once early code exists. |
| D-07 | 2026-07-06 | Difficulty is **deterministic tiers** in v1, not adaptive IRT | Adaptive calibration needs response data that doesn't exist yet; tiers keep generation reproducible. Revisit post-v1 (DEF-03). |

## Blockers

_None currently._

## Lessons

_None yet — project pre-implementation._

## Todos

- [ ] M0: initialize git repo + pnpm/cargo workspaces (first execution task, `procedural-engine/tasks.md` Phase 0)
- [ ] Choose final glyph/symbol set for face decorations before PROC implementation (constraint: must include rotationally-symmetric and orientation-sensitive tiers; see `procedural-engine/design.md` §Difficulty Model)
- [ ] Verify current wry/tao crate versions and WebView2 bootstrap strategy at M6 start (versions move fast; re-run knowledge verification chain then)

## Deferred ideas

| ID | Idea | Notes |
| -- | ---- | ----- |
| DEF-01 | SQLite backend in the Rust host via wry IPC | Behind existing `StorageService` interface; desktop-only; adds relational queries for heavy telemetry. Only if IndexedDB aggregation proves insufficient. |
| DEF-02 | Additional Gv item types: paper folding (punched holes), surface development, block counting | Engine architecture (seeded generator → renderer → round loop) is item-type agnostic by design. |
| DEF-03 | Adaptive difficulty via IRT / staircase procedures | Needs v1 response-latency corpus first. |
| DEF-04 | i18n (UI strings + tutorial content) | Structure tutorial content as data, not JSX, to keep this cheap. |
| DEF-05 | Spaced-repetition scheduling of weak configurations | Requires DEF-03-style modeling of per-configuration performance. |
| DEF-06 | Mobile (Capacitor or native) | Out of scope v1 per PROJECT.md. |

## Preferences

- Project owner communicates in English for all specs; academic/technical tone.
- Conventional Commits (`feat(core): …`) — one commit per task, defined in each tasks.md.
