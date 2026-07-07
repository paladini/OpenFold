# OpenFold — Testing Contract

Greenfield testing strategy. This document drives the `Tests` and `Gate` fields of every task in every `tasks.md` (TLC test co-location rule: code and its required tests ship in the same task).

## Test Coverage Matrix

| Code layer | Location | Required test type | Framework | Parallel-safe |
| ---------- | -------- | ------------------ | --------- | ------------- |
| Domain logic (nets, fold mapping, distractors, heuristics, PRNG, difficulty) | `packages/core/src/**` | **unit** (mandatory; property-based where noted in design) | Vitest + fast-check | Yes |
| Render math/utilities (hinge trees, pose composition, layout) | `packages/render/src/**` (non-WebGL) | **unit** | Vitest (three imported headlessly — math classes need no GL context) | Yes |
| Scene/animation classes touching WebGLRenderer | `packages/render/src/**` (WebGL) | **smoke** (construct with mocked renderer; no pixel assertions) | Vitest + mock | Yes |
| React components & hooks | `apps/web/src/**` | **component** | Vitest + @testing-library/react + jsdom | Yes |
| Storage service (Dexie) | `apps/web/src/storage/**` | **unit** (against `fake-indexeddb`) | Vitest + fake-indexeddb | Yes |
| Rust desktop host | `crates/desktop/src/**` | **unit** (`cargo test`) for protocol/asset resolution; window launch is a manual check | cargo test | Yes |
| Full user flows (browser build) | `e2e/**` | **e2e** — **deferred to M7** by explicit decision; tasks before M7 must NOT claim e2e coverage | Playwright | No (serial) |

Coverage floor: `packages/core` ≥ 90% line coverage (it is the correctness-critical layer); other TS packages ≥ 70%. Enforced in CI from M1 onward.

## Gate Check Commands

| Gate | Command | When |
| ---- | ------- | ---- |
| **quick** | `pnpm --filter <package> test` (plus `cargo test -p openfold-desktop` for Rust tasks) | After every task touching one package |
| **full** | `pnpm -w typecheck && pnpm -w lint && pnpm -w test` | Tasks that cross package boundaries; end of each phase |
| **build** | `pnpm -w build` (web/packages) / `cargo build --release -p openfold-desktop` (Rust) | Integration tasks; end of each milestone |

Every task's **Done when** must cite the exact gate command and the expected passing test count (prevents silent test deletion).

## Parallelism Assessment

- All Vitest suites are isolated (no shared state, fake-indexeddb per test file) → `[P]` tasks may run concurrently.
- `cargo test` is independent of the TS toolchain → Rust tasks parallelize freely with TS tasks.
- Playwright e2e (M7) is serial against a single dev server → M7 e2e tasks are never `[P]`.

## Conventions

- Test files co-located: `foo.ts` → `foo.test.ts` in the same directory.
- Property-based tests (fast-check) are mandatory where a design doc marks an invariant **[PBT]** (e.g., "all 11 nets fold to a valid cube under every symmetry").
- No snapshot tests for 3D output; assert on mathematical state (quaternions, face assignments), not pixels.
- Deterministic seeds in every test that touches the PRNG; never `Math.random()` in `packages/core` (lint rule).
