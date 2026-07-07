# Game Rounds Tasks

**Design**: `.specs/features/game-rounds/design.md`
**Status**: Approved

Milestone **M3**. Cross-feature prerequisites: `procedural-engine` T13 (core façade), `rendering-3d` T10 (ProblemScene).

---

## Execution Plan

### Phase 1: Scaffold + independent units

```
T1 ──┬→ T2 [P] (TelemetrySink + InMemorySink)
     ├→ T3 [P] (itemTimer)
     └→ T6 [P] (useProblemScene hook)
T4 [P] (unfold generation, packages/core — independent of T1)
```

### Phase 2: The machine

```
T2, T3, T4 ──→ T5 (roundMachine)
```

### Phase 3: Screens (Parallel)

```
T5     ──→ T7 [P] (RoundConfigScreen)
T5, T6 ──→ T8 [P] (PlayScreen)
T5     ──→ T9 [P] (SummaryScreen)
```

### Phase 4: Integration

```
T7, T8, T9 ──→ T10 (app shell + boot reconciliation) ──→ T11 (round integration suite)
```

---

## Task Breakdown

### T1: Scaffold apps/web

**What**: Vite + React + TS strict app with Vitest + Testing Library + jsdom, theming baseline (CSS variables, dark default), wired into workspace CI.
**Where**: `apps/web/` — configs, `src/main.tsx`, `src/App.tsx` (placeholder)
**Depends on**: None (in-feature) · cross-feature: procedural-engine T1–T3 workspace
**Reuses**: `tsconfig.base.json`; scaffold pattern from packages
**Requirement**: — (infra)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `pnpm --filter @openfold/web dev` serves; placeholder renders
- [ ] Component test harness proof passes (1 test)
- [ ] Gate check passes: `pnpm --filter @openfold/web test`

**Tests**: component (harness proof)
**Gate**: quick
**Commit**: `chore(web): scaffold react app`

---

### T2: TelemetrySink interface + InMemorySink [P]

**What**: The sink contract (design §TelemetrySink) incl. pending-session methods, plus `InMemorySink` (tests/pre-M4) and `NoopSink`.
**Where**: `apps/web/src/telemetry/TelemetrySink.ts`, `InMemorySink.ts` + tests
**Depends on**: T1
**Reuses**: `SessionConfig`/`AttemptRecord`/`SessionSummary` types (defined here, shared with telemetry-analytics)
**Requirement**: GAME-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] InMemorySink round-trips open → record×N → close with correct outcome + summary
- [ ] Pending-session marker set on open, cleared on close (both outcomes)
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 6 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): telemetry sink contract and in-memory sink`

---

### T3: itemTimer [P]

**What**: Monotonic per-item timer: `start(limitMs|null, onTimeout)`, `stop() → {responseMs, suspect}`; injectable clock.
**Where**: `apps/web/src/round/itemTimer.ts` + test
**Depends on**: T1
**Reuses**: —
**Requirement**: GAME-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Fake-clock tests: timeout fires at limit; `stop` before limit cancels timeout; `responseMs` exact
- [ ] `suspect: true` iff responseMs < 300
- [ ] `limitMs: null` never times out
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 6 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): monotonic item timer`

---

### T4: generateUnfoldProblem (core) [P]

**What**: Inverse items in `packages/core`: given seed+params produce question cube + 5 candidate nets (1 correct, 4 whose folds are canonically distinct), reusing foldMapper/canonicalizer/distractor machinery per design §Unfold mode.
**Where**: `packages/core/src/unfold.ts` + test; export from core index
**Depends on**: None (in-feature) · cross-feature: procedural-engine T13
**Reuses**: `foldNet`, `canonicalizer`, `netGenerator`, `prng`
**Requirement**: GAME-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] **[PBT]** 1,000 seeds: exactly one candidate net folds to a cube rotation-equivalent to the question cube
- [ ] Deterministic per seed; candidate order seed-derived
- [ ] Gate check passes: `pnpm --filter @openfold/core test`
- [ ] Test count: ≥ 5 tests pass

**Tests**: unit (+PBT)
**Gate**: quick
**Commit**: `feat(core): unfold problem generation`

---

### T5: roundMachine

**What**: The full state machine per design diagram: config validation, seed derivation, item lifecycle, timeout/select race resolution, abort/failed paths, sink emission, summary computation.
**Where**: `apps/web/src/round/roundMachine.ts` + `roundMachine.test.ts`
**Depends on**: T2, T3, T4
**Reuses**: injected `generateProblem`/`generateUnfoldProblem`; InMemorySink in tests
**Requirement**: GAME-01, GAME-02, GAME-03, GAME-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Every transition in the design stateDiagram has a test (happy path + ABORT from each state + SCENE_ERROR)
- [ ] Exactly one attempt recorded per completed item; zero for in-flight aborted item; timeout races SELECT deterministically (first wins)
- [ ] Summary math correct on fixtures (accuracy, mean, median; suspect excluded from latency aggregates)
- [ ] Config validation ranges enforced (count 5–50, limit 10–120 s or null)
- [ ] Round reproducibility: same `sessionSeed` ⇒ same item seeds
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 20 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): round state machine`

---

### T6: useProblemScene hook [P]

**What**: React hook owning ProblemScene mount/dispose (strict-mode safe), surfacing `SCENE_READY`/`SCENE_ERROR` and selection callbacks.
**Where**: `apps/web/src/hooks/useProblemScene.ts` + test
**Depends on**: T1 · cross-feature: rendering-3d T10
**Reuses**: `ProblemScene` API; demo-page lifecycle patterns
**Requirement**: GAME-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Strict-mode double-invoke leaves exactly one live scene (mocked ProblemScene)
- [ ] Unmount disposes; error path surfaces typed error
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 4 tests pass

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): useProblemScene lifecycle hook`

---

### T7: RoundConfigScreen [P]

**What**: Config form (difficulty, count, limit, mode) with inline validation, last-used prefill (via sink settings), defaults per spec GAME-01 AC4.
**Where**: `apps/web/src/screens/RoundConfigScreen.tsx` + test
**Depends on**: T5
**Reuses**: machine's config validation (single source — form displays machine errors)
**Requirement**: GAME-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Out-of-range count disables start with inline message (Testing Library)
- [ ] Submit sends `START` with the exact config; prefill shown when settings exist
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 6 tests pass

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): round config screen`

---

### T8: PlayScreen [P]

**What**: Presents the current item (fold: net question + cube options; unfold: cube question + net options), timer display, keyboard shortcuts 1–5, feedback view with replay button and the `FeedbackSlot` render prop for M5.
**Where**: `apps/web/src/screens/PlayScreen.tsx` + test
**Depends on**: T5, T6
**Reuses**: `useProblemScene`, machine state, `ProblemScene.showFeedback/playFold`
**Requirement**: GAME-02, GAME-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `SCENE_READY` dispatched only after hook reports mounted (timer-start contract)
- [ ] Keys 1–5 select; input locked in feedback; replay does not alter recorded timing (machine untouched)
- [ ] Unfold items render inverse layout
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 8 tests pass

**Tests**: component (ProblemScene mocked)
**Gate**: quick
**Commit**: `feat(web): play screen`

---

### T9: SummaryScreen [P]

**What**: Accuracy, correct count, mean/median ms, per-item breakdown table, Retry (same settings, new seed) / New round actions.
**Where**: `apps/web/src/screens/SummaryScreen.tsx` + test
**Depends on**: T5
**Reuses**: machine summary (no recomputation in UI)
**Requirement**: GAME-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Fixture summary renders all stats; timeout rows flagged
- [ ] Retry dispatches with same config + fresh seed
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 5 tests pass

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): summary screen`

---

### T10: App shell + boot reconciliation

**What**: Wire machine + screens into `App.tsx` (view switching per machine state), boot-time pending-session reconciliation (mark stale sessions aborted), failed-state screen.
**Where**: `apps/web/src/App.tsx`, `src/main.tsx` (modify) + test
**Depends on**: T7, T8, T9
**Reuses**: sink `getPendingSession`
**Requirement**: GAME-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Full flow renders: config → play → summary → config (Testing Library, mocked scene)
- [ ] Boot with stale pending marker closes that session as `aborted` before UI shows
- [ ] Gate check passes: `pnpm -w typecheck && pnpm -w lint && pnpm -w test`
- [ ] Test count: ≥ 5 tests pass

**Tests**: component
**Gate**: full
**Commit**: `feat(web): app shell with crash recovery`

---

### T11: Round integration suite

**What**: 100 simulated rounds at machine level (random valid configs, scripted answers incl. timeouts/aborts) asserting zero lost attempts and timer accuracy ±50 ms with a controlled clock; keyboard-only full-round component test.
**Where**: `apps/web/src/round/roundIntegration.test.ts`
**Depends on**: T10
**Reuses**: InMemorySink, machine, real core generation
**Requirement**: GAME-02, GAME-03, GAME-05 (verification depth)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] 100/100 rounds: attempts recorded == items completed; summaries consistent with attempt logs
- [ ] Keyboard-only round passes (Tab/Enter/1–5 only)
- [ ] Gate check passes: `pnpm -w typecheck && pnpm -w lint && pnpm -w test`
- [ ] Test count: ≥ 4 suites pass

**Tests**: unit + component (verification harness)
**Gate**: full
**Commit**: `test(web): round integration suite`

---

## Parallel Execution Map

```
Phase 1: T1 → { T2 [P], T3 [P], T6 [P] } · T4 [P] (independent, packages/core)
Phase 2: T5 ← T2,T3,T4
Phase 3: { T7 [P] ← T5 } · { T8 [P] ← T5,T6 } · { T9 [P] ← T5 }
Phase 4: T10 ← T7,T8,T9 → T11
```

`[P]` tasks touch disjoint files; suites parallel-safe per TESTING.md.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 app scaffold | ✅ Granular |
| T2 | 1 interface + 2 trivial impls (cohesive contract) | ✅ Granular |
| T3, T4, T5, T6 | 1 module each | ✅ Granular |
| T7, T8, T9 | 1 screen component each | ✅ Granular |
| T10 | 1 shell wiring | ✅ Granular |
| T11 | 1 verification suite | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | start node | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | None (cross-feature only) | independent node | ✅ Match |
| T6 | T1 | T1 → T6 | ✅ Match |
| T5 | T2, T3, T4 | T2,T3,T4 → T5 | ✅ Match |
| T7 | T5 | T5 → T7 | ✅ Match |
| T8 | T5, T6 | T5,T6 → T8 | ✅ Match |
| T9 | T5 | T5 → T9 | ✅ Match |
| T10 | T7, T8, T9 | T7,T8,T9 → T10 | ✅ Match |
| T11 | T10 | T10 → T11 | ✅ Match |

No `[P]` peers depend on each other. ✅

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | app scaffold + harness | component (harness proof) | component | ✅ OK |
| T2, T3, T5 | web domain logic (non-component TS) | unit | unit | ✅ OK |
| T4 | `packages/core` domain logic | unit (+PBT) | unit (+PBT) | ✅ OK |
| T6–T10 | React components/hooks | component | component | ✅ OK |
| T11 | verification suite | unit/component | unit + component | ✅ OK |

No task defers its tests to another task. ✅
