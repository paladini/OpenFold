# 3D Rendering & Animation Tasks

**Design**: `.specs/features/rendering-3d/design.md`
**Status**: Approved

Milestone **M2**. Cross-feature prerequisite: `procedural-engine` T7 (types) and T9 (foldMapper, used as test oracle); the full core façade (T13) is needed only for T11/T12.

---

## Execution Plan

### Phase 1: Package + independent subsystems

```
T1 ──┬→ T2 [P] (SymbolAtlas)
     ├→ T6 [P] (RenderLoop)
     └→ T7 [P] (CameraRig)
```

### Phase 2: Builders (Parallel)

```
T2 ──┬→ T3 [P] (NetBuilder)
     └→ T4 [P] (CubeBuilder)
```

### Phase 3: Behavior (Parallel)

```
T3         ──→ T5 [P] (FoldAnimator)
T4, T7     ──→ T8 [P] (Picker)
T3, T4, T7 ──→ T9 [P] (AnchorTracker)
```

### Phase 4: Façade & verification

```
T5, T6, T8, T9 ──→ T10 (ProblemScene) ──┬→ T11 [P] (pose-equivalence suite)
                                        └→ T12 [P] (demo page)
```

---

## Task Breakdown

### T1: Scaffold packages/render

**What**: `@openfold/render` package wired to Vitest, three as dependency, `@openfold/core` as workspace dependency.
**Where**: `packages/render/` — `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`
**Depends on**: None (in-feature) · cross-feature: procedural-engine T2 pattern, T7 types published
**Reuses**: `tsconfig.base.json`; scaffold pattern from `packages/core`
**Requirement**: — (infra)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Package compiles importing `FoldProblem` from `@openfold/core`
- [ ] Placeholder test passes; CI picks the package up automatically
- [ ] Gate check passes: `pnpm --filter @openfold/render test`; 1 test passes

**Tests**: unit (harness proof)
**Gate**: quick
**Commit**: `chore(render): scaffold package`

---

### T2: Glyph table + SymbolAtlas [P]

**What**: 2D path definitions for the v1 glyph set (each tagged with its `SymbolSymmetry` class matching core) and the cached `CanvasTexture` atlas with UV-rotation helpers.
**Where**: `packages/render/src/glyphs.ts`, `packages/render/src/SymbolAtlas.ts` + tests
**Depends on**: T1
**Reuses**: `SymbolSymmetry` type from core
**Requirement**: REND-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Every glyphId used by core presets exists in the table; symmetry tags match core's (cross-package consistency test)
- [ ] `getUv` returns distinct regions per glyph; rotation permutes UV corners correctly (pure-math test)
- [ ] Atlas texture created lazily once and disposed cleanly
- [ ] Gate check passes: `pnpm --filter @openfold/render test`
- [ ] Test count: ≥ 5 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(render): glyph table and symbol atlas`

---

### T3: NetBuilder [P]

**What**: Build hinge-group hierarchy (`NetRig`) from `DecoratedNet` + `FoldPlan` per design §fold pose math.
**Where**: `packages/render/src/NetBuilder.ts` + test
**Depends on**: T2
**Reuses**: `FoldPlan` pivots verbatim; SymbolAtlas
**Requirement**: REND-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Hierarchy parent/child edges equal `FoldPlan.hinges` exactly (structural test)
- [ ] At all hinge angles 0: face world positions equal net grid cells (flat pose test)
- [ ] Face meshes carry correct glyph UVs incl. `symbolRotation`
- [ ] Gate check passes: `pnpm --filter @openfold/render test`
- [ ] Test count: ≥ 6 tests pass

**Tests**: unit (scene-graph math, no GL)
**Gate**: quick
**Commit**: `feat(render): net rig builder mirroring fold plan`

---

### T4: CubeBuilder [P]

**What**: Static decorated cube `Group` from a `CubeState` (used ×5 for alternatives, ×1 for folded reference).
**Where**: `packages/render/src/CubeBuilder.ts` + test
**Depends on**: T2
**Reuses**: SymbolAtlas
**Requirement**: REND-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Each of 6 materials/UVs matches the `CubeState` face entry (glyph + rotation), asserted per face
- [ ] Blank faces get the neutral material
- [ ] Gate check passes: `pnpm --filter @openfold/render test`
- [ ] Test count: ≥ 4 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(render): answer cube builder`

---

### T5: FoldAnimator [P]

**What**: Progress→hinge-angle mapping (simultaneous + stepped), tweening with easing, reduced-motion stepping, completion promise semantics.
**Where**: `packages/render/src/FoldAnimator.ts` + test
**Depends on**: T3
**Reuses**: `NetRig.hinges`
**Requirement**: REND-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `setProgress(1)` sets every hinge to ±90° exactly; `setProgress(0)` to 0 (deterministic scrub, spec REND-02 AC2)
- [ ] `playUnfold` from mid-progress reverses without jump (angle continuity test with fake timers)
- [ ] Reduced-motion mode emits ≤ 6 discrete poses
- [ ] Completion callback fires exactly once per play (incl. interrupted replays)
- [ ] Gate check passes: `pnpm --filter @openfold/render test`
- [ ] Test count: ≥ 7 tests pass

**Tests**: unit (fake timers)
**Gate**: quick
**Commit**: `feat(render): fold animator with scrub and reduced motion`

---

### T6: RenderLoop [P]

**What**: rAF loop with visibility suspend/resume and WebGL context-loss/restore recovery hooks.
**Where**: `packages/render/src/RenderLoop.ts` + test
**Depends on**: T1
**Reuses**: —
**Requirement**: REND-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Hidden document ⇒ no ticks; visible ⇒ resumes (jsdom visibility events + fake rAF)
- [ ] `webglcontextlost` pauses and prevents default; `webglcontextrestored` triggers the registered rebuild callback
- [ ] Gate check passes: `pnpm --filter @openfold/render test`
- [ ] Test count: ≥ 5 tests pass

**Tests**: smoke (mocked renderer/canvas)
**Gate**: quick
**Commit**: `feat(render): render loop with visibility and context-loss handling`

---

### T7: CameraRig [P]

**What**: OrbitControls wrapper with damping, polar clamps, zoom limits, `setEnabled`.
**Where**: `packages/render/src/CameraRig.ts` + test
**Depends on**: T1
**Reuses**: `three/examples/jsm/controls/OrbitControls` (design decision: do not reimplement)
**Requirement**: REND-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Config clamps applied (min/max distance, polar angle) — asserted on the controls instance
- [ ] `setEnabled(false)` blocks input handlers
- [ ] Gate check passes: `pnpm --filter @openfold/render test`
- [ ] Test count: ≥ 3 tests pass

**Tests**: smoke
**Gate**: quick
**Commit**: `feat(render): camera rig`

---

### T8: Picker [P]

**What**: Raycast hover/click selection over answer cubes + keyboard focus ring (`focusNext/Prev/activate`), highlight states, `setInteractive` gating.
**Where**: `packages/render/src/Picker.ts` + test
**Depends on**: T4, T7
**Reuses**: three Raycaster; CubeBuilder groups
**Requirement**: REND-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Synthetic ray through cube 3's position selects index 3 (pure raycast test, no GL)
- [ ] Keyboard cycle order is stable (0→4 wrap); `activate()` fires `onSelect` once
- [ ] Disabled state swallows both pointer and keyboard activation (spec REND-03 AC4)
- [ ] Gate check passes: `pnpm --filter @openfold/render test`
- [ ] Test count: ≥ 6 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(render): answer picker with keyboard support`

---

### T9: AnchorTracker [P]

**What**: `AnchorKey` grammar → world point resolution (face centers, hinge midpoints, cube faces), per-frame projection to CSS pixels with occlusion flag, subscription API, `highlight()`.
**Where**: `packages/render/src/AnchorTracker.ts` + test
**Depends on**: T3, T4, T7
**Reuses**: NetRig face meshes, CubeBuilder groups, camera from rig
**Requirement**: REND-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Known camera + known face ⇒ hand-computed CSS coordinates (projection test)
- [ ] Face behind the model reports `visible: false` (occlusion via raycast)
- [ ] Unknown key returns `null`, never throws
- [ ] `highlight` applies and clears outline material without mutating base materials
- [ ] Gate check passes: `pnpm --filter @openfold/render test`
- [ ] Test count: ≥ 6 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(render): anchor tracker and highlight api`

---

### T10: ProblemScene façade

**What**: Compose all subsystems; mount/dispose lifecycle (idempotent, strict-mode safe); layout (net + 5 answer cubes grid); `showFeedback`; `computeFoldedState()` oracle; pixel-ratio cap; `WebGlUnsupportedError`.
**Where**: `packages/render/src/ProblemScene.ts` + test; export from `src/index.ts`
**Depends on**: T5, T6, T8, T9
**Reuses**: every prior component
**Requirement**: REND-01, REND-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `computeFoldedState()` on a fixture equals `foldNet(fixture.net).cube` (the anti-divergence contract, spec REND-01 AC2)
- [ ] Double-mount supersedes cleanly; `dispose()` zeroes `renderer.info.memory` counters (mocked renderer assertion)
- [ ] Resize updates camera aspect + renderer size
- [ ] Gate check passes: `pnpm --filter @openfold/render test`
- [ ] Test count: ≥ 8 tests pass

**Tests**: unit + smoke
**Gate**: quick
**Commit**: `feat(render): ProblemScene facade`

---

### T11: Pose-equivalence verification suite [P]

**What**: 100 seeded problems (all tiers): assert `ProblemScene.computeFoldedState()` ≡ core `foldNet` output; assert zero per-frame allocations in the scrub path (allocation counter around `setProgress` loop).
**Where**: `packages/render/src/poseEquivalence.test.ts`
**Depends on**: T10 · cross-feature: procedural-engine T13
**Reuses**: `generateProblem` as fixture source; `foldNet` as oracle
**Requirement**: REND-01, REND-02 (verification depth)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] 100/100 seeds pose-equivalent, all difficulty tiers
- [ ] Scrub loop allocation assertion passes
- [ ] Gate check passes: `pnpm -w typecheck && pnpm -w lint && pnpm -w test`
- [ ] Test count: ≥ 3 suites / 100+ assertions pass

**Tests**: unit (verification harness — the deliverable IS tests)
**Gate**: full
**Commit**: `test(render): pose-equivalence suite against core oracle`

---

### T12: Interactive demo page [P]

**What**: Vite demo (`packages/render/demo/`) rendering a seeded problem with fold/unfold buttons, scrub slider, seed input, anchor-badge example — the manual-verification bench for M2's exit criterion and later tutorial development.
**Where**: `packages/render/demo/index.html`, `packages/render/demo/main.ts`
**Depends on**: T10 · cross-feature: procedural-engine T13
**Reuses**: full render API
**Requirement**: REND-01..04 (manual verification vehicle)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `pnpm --filter @openfold/render demo` serves the page; fold/unfold/scrub/orbit/select all work (manual check recorded in PR)
- [ ] A DOM badge tracks `face:0` through fold + orbit (spec REND-04 independent test)
- [ ] Gate check passes: `pnpm -w build` (demo excluded from prod bundles)

**Tests**: none (demo page — code layer is a dev tool; matrix requires none; manual checklist instead)
**Gate**: build
**Commit**: `feat(render): interactive demo page`

---

## Parallel Execution Map

```
Phase 1: T1 → { T2 [P], T6 [P], T7 [P] }
Phase 2: T2 → { T3 [P], T4 [P] }
Phase 3: { T5 [P] ← T3 } · { T8 [P] ← T4,T7 } · { T9 [P] ← T3,T4,T7 }
Phase 4: T10 ← T5,T6,T8,T9 → { T11 [P], T12 [P] }
```

All `[P]` groups touch disjoint files; Vitest parallel-safe per TESTING.md.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 package scaffold | ✅ Granular |
| T2 | 2 cohesive files (glyph data + atlas that renders it) | ✅ Granular (cohesive) |
| T3–T9 | 1 class + co-located test each | ✅ Granular |
| T10 | 1 façade class | ✅ Granular |
| T11 | 1 verification suite | ✅ Granular |
| T12 | 1 demo entry | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | start node | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T6 | T1 | T1 → T6 | ✅ Match |
| T7 | T1 | T1 → T7 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T2 | T2 → T4 | ✅ Match |
| T5 | T3 | T3 → T5 | ✅ Match |
| T8 | T4, T7 | T4,T7 → T8 | ✅ Match |
| T9 | T3, T4, T7 | T3,T4,T7 → T9 | ✅ Match |
| T10 | T5, T6, T8, T9 | T5,T6,T8,T9 → T10 | ✅ Match |
| T11 | T10 | T10 → T11 | ✅ Match |
| T12 | T10 | T10 → T12 | ✅ Match |

No `[P]` peers depend on each other. ✅

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | scaffold + harness | unit (harness proof) | unit | ✅ OK |
| T2–T5, T8, T9 | render math/utilities (non-WebGL) | unit | unit | ✅ OK |
| T6, T7 | WebGL-touching classes | smoke | smoke | ✅ OK |
| T10 | façade (mixed) | highest = unit + smoke | unit + smoke | ✅ OK |
| T11 | verification suite | unit | unit | ✅ OK |
| T12 | dev-only demo page | none in matrix (not an app/package layer) | none + manual checklist | ✅ OK |

No task defers its tests to another task. ✅
