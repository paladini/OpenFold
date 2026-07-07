# Procedural Engine Tasks

**Design**: `.specs/features/procedural-engine/design.md`
**Status**: Approved

Covers Milestones **M0** (Phase 0, repo scaffolding — hosted here because the engine is the first code to land) and **M1**.

---

## Execution Plan

### Phase 0: Scaffolding (Sequential) — M0

```
T1 → T2 → T3
```

### Phase 1: Foundations (Parallel after T3)

```
        ┌→ T4 [P]  (prng)
T2 ─────┼→ T5 [P]  (intMath)
        ├→ T6 [P]  (netCatalog)
        └→ T7 [P]  (types + params)
```

### Phase 2: Core algorithms (Parallel)

```
T4, T6, T7 ──→ T8 [P]  (netGenerator)
T5, T6, T7 ──→ T9 [P]  (foldMapper)
T5, T7     ──→ T10 [P] (canonicalizer)
```

### Phase 3: Derived generators (Parallel)

```
T4, T7, T10 ──→ T11 [P] (distractors)
T7, T9      ──→ T12 [P] (heuristics)
```

### Phase 4: Façade & verification (Sequential)

```
T8, T9, T11 ──→ T13 (generateProblem façade)
T12, T13    ──→ T14 (fuzz harness + coverage gate)
```

---

## Task Breakdown

### T1: Initialize monorepo workspaces

**What**: Git repo + pnpm workspace + cargo workspace skeleton with root configs.
**Where**: `/` — `package.json`, `pnpm-workspace.yaml`, `Cargo.toml` (workspace stub), `tsconfig.base.json` (`strict: true`), `.gitignore`, `LICENSE` (MIT), `README.md` stub.
**Depends on**: None
**Reuses**: —
**Requirement**: — (M0 infra)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `git init` done; first commit contains only scaffolding
- [ ] `pnpm install` succeeds; workspace globs cover `packages/*`, `apps/*`
- [ ] `tsconfig.base.json` has `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled

**Tests**: none (no code layer created — config only)
**Gate**: build (`pnpm install` exits 0)
**Commit**: `chore: scaffold monorepo workspaces`

---

### T2: Scaffold packages/core

**What**: Empty-but-compiling `@openfold/core` package wired to Vitest, ESLint (incl. `no-restricted-globals` ban on `Math.random`), and coverage config.
**Where**: `packages/core/` — `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts` (placeholder export).
**Depends on**: T1
**Reuses**: `tsconfig.base.json` from T1
**Requirement**: — (M0 infra)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `pnpm --filter @openfold/core test` runs (1 placeholder test passes)
- [ ] `pnpm --filter @openfold/core typecheck` and `lint` pass
- [ ] Lint fails on `Math.random` usage (verified by a temporary fixture)

**Tests**: unit (placeholder proves harness works)
**Gate**: quick — `pnpm --filter @openfold/core test`; 1 test passes
**Commit**: `chore(core): scaffold package with vitest and lint rules`

---

### T3: CI pipeline

**What**: GitHub Actions workflow running typecheck, lint, test, build on push/PR.
**Where**: `.github/workflows/ci.yml`
**Depends on**: T2
**Reuses**: gate commands from `.specs/codebase/TESTING.md`
**Requirement**: — (M0 infra)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Workflow runs `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build`
- [ ] Green run on the scaffold commit

**Tests**: none (config only)
**Gate**: full (executed by CI itself)
**Commit**: `ci: add typecheck/lint/test/build workflow`

---

### T4: prng module [P]

**What**: mulberry32 `createRng` with `next/int/pick/fork` per design §prng.
**Where**: `packages/core/src/prng.ts` + `prng.test.ts`
**Depends on**: T2
**Reuses**: —
**Requirement**: PROC-01 (determinism substrate)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Known-answer test: fixed seed produces documented first 8 outputs (guards against algorithm drift)
- [ ] `fork(label)` streams are independent: consuming one does not shift the other
- [ ] `int(n)` is bias-bounded and range-correct for n up to 2^16 (PBT)
- [ ] Gate check passes: `pnpm --filter @openfold/core test`
- [ ] Test count: ≥ 6 tests pass (no silent deletions)

**Tests**: unit (+PBT)
**Gate**: quick
**Commit**: `feat(core): seeded prng with forked sub-streams`

---

### T5: intMath module [P]

**What**: Integer vec3/mat3 ops, the 24 cube rotation matrices, screw-motion compose/apply per design §intMath.
**Where**: `packages/core/src/intMath.ts` + `intMath.test.ts`
**Depends on**: T2
**Reuses**: —
**Requirement**: PROC-03, PROC-04 (math substrate)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `ROTATIONS_24` has 24 distinct matrices, all with determinant +1, closed under multiplication (group axioms tested)
- [ ] Screw composition matches applying motions sequentially on sample points (PBT over random ±90° hinge sequences)
- [ ] Gate check passes: `pnpm --filter @openfold/core test`
- [ ] Test count: ≥ 8 tests pass

**Tests**: unit (+PBT)
**Gate**: quick
**Commit**: `feat(core): exact integer math and cube rotation group`

---

### T6: netCatalog module [P]

**What**: Static data for the 11 canonical hexomino cube nets (cells, adjacency, symmetry order) + `normalizeNet`.
**Where**: `packages/core/src/netCatalog.ts` + `netCatalog.test.ts`
**Depends on**: T2
**Reuses**: —
**Requirement**: PROC-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Test brute-force enumerates all hexominoes, filters cube-foldable ones, and asserts the catalog equals that set under D₄ normalization (exactly 11)
- [ ] Every catalog entry's adjacency graph is connected with correct edge set
- [ ] Gate check passes: `pnpm --filter @openfold/core test`
- [ ] Test count: ≥ 4 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): canonical cube net catalog with machine-checked completeness`

---

### T7: Shared types + params/presets [P]

**What**: Public domain types (`DecoratedNet`, `CubeState`, `FoldPlan`, `FoldProblem`, `Distractor`) and `expandPreset`/validation with `InvalidParamsError` per design §Data Models and §params.
**Where**: `packages/core/src/types.ts`, `packages/core/src/params.ts` + `params.test.ts`
**Depends on**: T2
**Reuses**: —
**Requirement**: PROC-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Three presets expand to frozen objects matching design §Difficulty Model table
- [ ] Invalid decorated-face counts (<3, >6), unknown tiers, non-finite seeds throw `InvalidParamsError` with machine-readable `reason`
- [ ] Gate check passes: `pnpm --filter @openfold/core test`
- [ ] Test count: ≥ 7 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): domain types, difficulty presets, param validation`

---

### T8: netGenerator module [P]

**What**: `generateNet(rng, params)` — sample catalog net, apply sampled D₄ symmetry, decorate faces per symbol tier; reject degenerate all-symmetric decorations.
**Where**: `packages/core/src/netGenerator.ts` + `netGenerator.test.ts`
**Depends on**: T4, T6, T7
**Reuses**: `prng.fork('net')`, `netCatalog`, `params`
**Requirement**: PROC-02, PROC-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] 11,000 sequential seeds: each canonical net frequency within ±20% of uniform (spec PROC-02 AC2)
- [ ] Output nets always validate against catalog under normalization (PBT)
- [ ] Degenerate decoration (all faces same 4-fold glyph) is provably redrawn (targeted seed fixture)
- [ ] Gate check passes: `pnpm --filter @openfold/core test`
- [ ] Test count: ≥ 6 tests pass

**Tests**: unit (+PBT)
**Gate**: quick
**Commit**: `feat(core): net sampling with symmetry transforms and decoration`

---

### T9: foldMapper module [P]

**What**: `foldNet(net)` — BFS spanning tree, screw-motion composition, `CubeState` + `FoldPlan` extraction, exactly per design §mathematical strategy steps 1–4.
**Where**: `packages/core/src/foldMapper.ts` + `foldMapper.test.ts`
**Depends on**: T5, T6, T7
**Reuses**: `intMath` screw motions, `netCatalog` adjacency
**Requirement**: PROC-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] **[PBT]** All 11 nets × 8 symmetries × random decorations: folded face normals are exactly the 6 axis directions, bijectively (spec PROC-03 AC2)
- [ ] Hand-computed fixture: the cross-shaped net with known decorations folds to the expected `CubeState` (worked example documented in the test)
- [ ] `FoldPlan` replay (re-applying hinges) reproduces the same `CubeState`
- [ ] Gate check passes: `pnpm --filter @openfold/core test`
- [ ] Test count: ≥ 8 tests pass

**Tests**: unit (+PBT)
**Gate**: quick
**Commit**: `feat(core): spanning-tree fold mapper (net to cube)`

---

### T10: canonicalizer module [P]

**What**: `canonicalize`/`areEquivalent` under the 24-rotation group, symbol-symmetry aware, per design step 5.
**Where**: `packages/core/src/canonicalizer.ts` + `canonicalizer.test.ts`
**Depends on**: T5, T7
**Reuses**: `intMath.ROTATIONS_24`
**Requirement**: PROC-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] **[PBT]** For random cubes and random rotations r: `canonicalize(cube) === canonicalize(rotate(cube, r))`
- [ ] **[PBT]** Non-equivalent fixtures (single symbol rotated on an asymmetric glyph) canonicalize differently
- [ ] 2-fold symbol rotated 180° compares equal; rotated 90° compares different
- [ ] Gate check passes: `pnpm --filter @openfold/core test`
- [ ] Test count: ≥ 7 tests pass

**Tests**: unit (+PBT)
**Gate**: quick
**Commit**: `feat(core): rotation-group canonicalizer with symbol symmetry`

---

### T11: distractors module [P]

**What**: Four typed perturbations + deterministic rejection sampling with 32-retry bound and redraw signal, per design step 6.
**Where**: `packages/core/src/distractors.ts` + `distractors.test.ts`
**Depends on**: T4, T7, T10
**Reuses**: `canonicalizer.areEquivalent`, `prng.fork('distractors')`
**Requirement**: PROC-04, PROC-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Each perturbation kind produces the documented structural change (unit fixture per kind)
- [ ] **[PBT]** Returned sets: 4 distractors, pairwise non-equivalent, none equivalent to the answer
- [ ] Difficulty mix respected: hard ⇒ ≥2 subtle; easy ⇒ ≥3 structural (spec PROC-04 AC4)
- [ ] Retry exhaustion path returns the typed redraw signal (forced via a fully-symmetric fixture)
- [ ] Every distractor carries `kind` + `affectedFaces` (spec PROC-04 AC5)
- [ ] Gate check passes: `pnpm --filter @openfold/core test`
- [ ] Test count: ≥ 10 tests pass

**Tests**: unit (+PBT)
**Gate**: quick
**Commit**: `feat(core): verified distractor generation`

---

### T12: heuristics module [P]

**What**: `oppositePairs`, `orientationTrace`, `explainDistractor` per design §heuristics (consumed by guided-training).
**Where**: `packages/core/src/heuristics.ts` + `heuristics.test.ts`
**Depends on**: T7, T9
**Reuses**: `foldMapper` output (no geometry re-derivation)
**Requirement**: PROC-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] **[PBT]** For every net: `oppositePairs` equals pairs whose folded normals are antipodal
- [ ] Opposition-Rule syntactic annotation correct on straight-strip fixtures (positive and negative cases)
- [ ] `orientationTrace` hinge list replays to the face's final orientation
- [ ] `explainDistractor('opposite-swap')` names the violated rule + witnessing pair
- [ ] Gate check passes: `pnpm --filter @openfold/core test`
- [ ] Test count: ≥ 8 tests pass

**Tests**: unit (+PBT)
**Gate**: quick
**Commit**: `feat(core): heuristics api (opposition and orientation rules)`

---

### T13: generateProblem façade

**What**: Public `generateProblem(seed, paramsOrPreset)` orchestrating net → fold → distractors → shuffled alternatives with `correctIndex`; redraw loop (max 8) on distractor exhaustion.
**Where**: `packages/core/src/index.ts` + `index.test.ts`
**Depends on**: T8, T9, T11
**Reuses**: all Phase 1–3 modules
**Requirement**: PROC-01, PROC-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Returns `FoldProblem` satisfying spec PROC-01 AC1–AC3 on fixtures
- [ ] Determinism: same `(seed, params)` twice ⇒ deep-equal results
- [ ] Alternative order is seed-derived (correct answer not positionally biased over 1,000 seeds)
- [ ] Gate check passes: `pnpm --filter @openfold/core test`
- [ ] Test count: ≥ 8 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): generateProblem facade`

---

### T14: Fuzz harness + coverage gate

**What**: 10,000-seed × 3-tier fuzz suite asserting global invariants (valid answer sets, no ambiguity, latency budget), serialized-determinism golden file (cross-engine check), and CI coverage threshold (core ≥ 90%).
**Where**: `packages/core/src/fuzz.test.ts`, `vitest.config.ts` (coverage thresholds), `.github/workflows/ci.yml` (update)
**Depends on**: T12, T13
**Reuses**: full public API; TESTING.md gate commands
**Requirement**: PROC-01, PROC-04 (verification depth)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Fuzz run green: 0 invalid problems in 30,000 generations; redraw rate < 0.1%
- [ ] Golden-file test: serialized problems for 32 reference seeds match committed fixtures (regenerating on a different engine must match — verified once manually in a WebKit runtime and recorded here)
- [ ] `generateProblem` p95 < 5 ms in the fuzz run
- [ ] CI fails below 90% line coverage on `packages/core`
- [ ] Gate check passes: `pnpm -w typecheck && pnpm -w lint && pnpm -w test`
- [ ] Test count: full suite ≥ 80 tests pass

**Tests**: unit (fuzz/integration harness — this task's deliverable IS tests + CI config)
**Gate**: full
**Commit**: `test(core): fuzz harness, determinism golden files, coverage gate`

---

## Parallel Execution Map

```
Phase 0 (Sequential):   T1 → T2 → T3
Phase 1 (Parallel):     T2 done → T4 [P] · T5 [P] · T6 [P] · T7 [P]
Phase 2 (Parallel):     → T8 [P] (needs T4,T6,T7)
                        → T9 [P] (needs T5,T6,T7)
                        → T10 [P] (needs T5,T7)
Phase 3 (Parallel):     → T11 [P] (needs T4,T7,T10)
                        → T12 [P] (needs T7,T9)
Phase 4 (Sequential):   T13 (needs T8,T9,T11) → T14 (needs T12,T13)
```

All `[P]` tasks touch disjoint files and Vitest suites are parallel-safe (TESTING.md) → no shared mutable state.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | workspace config set (cohesive) | ✅ Granular |
| T2 | 1 package scaffold | ✅ Granular |
| T3 | 1 CI workflow file | ✅ Granular |
| T4–T12 | 1 module + its co-located tests each | ✅ Granular |
| T13 | 1 façade function | ✅ Granular |
| T14 | 1 test harness + threshold config (cohesive verification deliverable) | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | start node | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T2 | T2 → T4 | ✅ Match |
| T5 | T2 | T2 → T5 | ✅ Match |
| T6 | T2 | T2 → T6 | ✅ Match |
| T7 | T2 | T2 → T7 | ✅ Match |
| T8 | T4, T6, T7 | T4,T6,T7 → T8 | ✅ Match |
| T9 | T5, T6, T7 | T5,T6,T7 → T9 | ✅ Match |
| T10 | T5, T7 | T5,T7 → T10 | ✅ Match |
| T11 | T4, T7, T10 | T4,T7,T10 → T11 | ✅ Match |
| T12 | T7, T9 | T7,T9 → T12 | ✅ Match |
| T13 | T8, T9, T11 | T8,T9,T11 → T13 | ✅ Match |
| T14 | T12, T13 | T12,T13 → T14 | ✅ Match |

No task in a parallel group depends on a peer in the same group. ✅

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | config only | — | none | ✅ OK |
| T2 | package scaffold + harness | unit (harness proof) | unit | ✅ OK |
| T3 | CI config only | — | none | ✅ OK |
| T4–T13 | `packages/core/src/**` (domain logic) | unit (+PBT where design marks) | unit (+PBT) | ✅ OK |
| T14 | test harness + CI thresholds | unit | unit | ✅ OK |

No task defers its tests to another task. ✅
