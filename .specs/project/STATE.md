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

- Rotation-only vs. full affine transforms matter: applying a `ScrewMotion`'s translation to a direction vector (face normal/up vector) instead of just its rotation component produces nonsense (a non-unit vector). A property test in `heuristics.test.ts` caught this immediately — direction vectors must only ever go through `apply(matrix, v)`, never `applyScrew`.
- A pure 3-cycle of one cube corner (3 mutually-adjacent faces) is mathematically identical to a genuine 120° rotation of the whole cube whenever the opposite corner looks unchanged under that same rotation (e.g. blank, or uniformly 4-fold-symmetric) — discovered via real `DistractorExhaustionError`s in testing, not a hypothetical. This makes random-sampling from a small perturbation candidate space fragile; `distractors.ts` now enumerates every candidate exhaustively instead (candidate spaces are small and bounded: ≤3, ≤16, or a handful per face).
- 4-fold (fully rotation-symmetric) glyphs carry zero orientation information, so a fully-blank opposite face pair hands the cube a "free" hidden rotation symmetry. `netGenerator.generateNet` now verifies (via an actual fold) that no opposite pair is fully blank when `symbolTier === 'distinct'`, redrawing if so.
- When validating a generation pipeline empirically, prefer a throwaway scratch script (`node` one-off, or a scratch `.test.ts` deleted before commit) to hand-deriving 3D rotation matrix products — manual matrix arithmetic is error-prone (caught one sign-slip mistake this way) and the actual implementation is the authoritative source of truth once its own invariants are independently verified.
- core's per-face rotation-label convention (`cubeGeometry.ts`'s `findRotate90`) is NOT a single consistent geometric handedness (e.g. "always right-hand-rule about the normal") — it's whichever order-4 rotation happens to be discovered first in a BFS over the 24-element rotation group, per face. When `packages/render`'s `poseExtraction.ts` needed to independently read a rotation label back out of a rendered scene graph, deriving it from a clean cross-product formula (`normal × reference`) was wrong for half the faces. Fix: empirically probe against ~150 core-generated fixtures per face (tally which sign convention matches), then hardcode the resulting tangent-vector table (`ROTATION_TANGENT` in `poseExtraction.ts`) rather than re-deriving it geometrically. Same "trust the tests over the derivation" lesson as above, but here the derivation was actively misleading rather than just error-prone.

## Todos

- [x] M0: initialize git repo + pnpm/cargo workspaces (first execution task, `procedural-engine/tasks.md` Phase 0) — done 2026-07-07
- [x] Choose final glyph/symbol set for face decorations before PROC implementation — done: `netGenerator.ts` GLYPH_LIBRARY (6 asymmetric, 4 2-fold, 8 4-fold)
- [ ] Verify current wry/tao crate versions and WebView2 bootstrap strategy at M6 start (versions move fast; re-run knowledge verification chain then)
- [ ] Cross-engine determinism check: `fuzz.test.ts`'s golden-file test only verifies byte-identical output on V8/Node (Vitest). True cross-engine verification (JavaScriptCore/WebKit, used by the desktop shell's webview on macOS) needs a one-time manual run inside an actual WebView2/WKWebView/WebKitGTK context at M6 — do this before relying on the determinism claim across platforms.

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
