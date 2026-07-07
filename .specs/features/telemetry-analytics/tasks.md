# Local Telemetry & Analytics Tasks

**Design**: `.specs/features/telemetry-analytics/design.md`
**Status**: Approved

Milestone **M4**. Cross-feature prerequisites: `game-rounds` T2 (sink contract + types), T6 (useProblemScene), T10 (app shell); `procedural-engine` T13 and `rendering-3d` T10 for review mode.

---

## Execution Plan

```
Phase 1:  T1 (db schema + rebuild)
Phase 2:  T1 → { T2 [P] (DexieSink), T3 [P] (queries), T7 [P] (exporter) }
Phase 3:  T3 → { T4 [P] (Dashboard), T5 [P] (History), T6 [P] (Review) }
Phase 4:  T2, T4, T5, T6, T7 → T8 (boot wiring + integration suite)
```

---

## Task Breakdown

### T1: Dexie schema + migration harness

**What**: `OpenFoldDB` (version-1 stores per design), `openDb` with default-profile bootstrap, `rebuildDailyStats`, migration test harness with frozen v0 fixture.
**Where**: `apps/web/src/storage/db.ts` + `db.test.ts` (+ `fixtures/exportV0.json`)
**Depends on**: None (in-feature) · cross-feature: game-rounds T2 types
**Reuses**: `SessionConfig`/`AttemptRecord`/`SessionSummary` types
**Requirement**: TELE-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Stores + indexes match design §Dexie schema exactly (introspection test on fake-indexeddb)
- [ ] First `openDb` creates the default profile; second run is idempotent
- [ ] `rebuildDailyStats` output equals hand-computed aggregates on a fixture (incl. suspect/timeout exclusion, per-difficulty keys)
- [ ] Migration harness runs and passes on the trivial v0→v1 case
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 8 tests pass

**Tests**: unit (fake-indexeddb)
**Gate**: quick
**Commit**: `feat(web): dexie schema and daily-stats rebuild`

---

### T2: DexieSink [P]

**What**: `TelemetrySink` implementation with transactional attempt+dailyStats writes, buffered retry, pending-session marker in `settings`; extract game-rounds sink tests into a parameterized contract suite and run it against both sinks.
**Where**: `apps/web/src/storage/DexieSink.ts` + test; `apps/web/src/telemetry/sinkContract.test.ts` (refactor)
**Depends on**: T1
**Reuses**: InMemorySink behavioral tests (game-rounds T2) as the shared contract
**Requirement**: TELE-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Contract suite green against InMemorySink AND DexieSink (identical expectations)
- [ ] Attempt insert + dailyStats upsert are atomic (induced mid-transaction failure leaves neither)
- [ ] Write failure buffers and retries on next write; warning emitted once
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 10 tests pass

**Tests**: unit (fake-indexeddb)
**Gate**: quick
**Commit**: `feat(web): dexie telemetry sink with shared contract suite`

---

### T3: Query/aggregation module [P]

**What**: `latencySeries`, `accuracyPerSession`, `difficultyProgression`, `sessionList` (paginated), `sessionDetail` — chart-ready outputs per design §Aggregation semantics.
**Where**: `apps/web/src/storage/queries.ts` + test
**Depends on**: T1
**Reuses**: aggregation constants module shared with DexieSink
**Requirement**: TELE-02, TELE-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Fixture DB (90 synthetic days): each query returns hand-verified series incl. range filters (7/30/90/all)
- [ ] Difficulty progression applies the ≥5-attempts/day rule with higher-tier tie-break
- [ ] Latency series reads only `dailyStats` (spy asserts no `attempts` table scan)
- [ ] Empty DB returns typed empty results (no nulls/NaN)
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 10 tests pass

**Tests**: unit (fake-indexeddb)
**Gate**: quick
**Commit**: `feat(web): telemetry query and aggregation module`

---

### T4: DashboardScreen [P]

**What**: Three Recharts charts per design §Chart mapping, range filter, empty state with CTA.
**Where**: `apps/web/src/screens/DashboardScreen.tsx` + test
**Depends on**: T3
**Reuses**: queries module (UI computes nothing)
**Requirement**: TELE-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] With fixture data: three charts render with expected series counts and axes (Testing Library + Recharts test ids)
- [ ] Range switch re-queries and updates all three consistently
- [ ] Empty DB shows CTA state, zero chart errors
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 7 tests pass

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): telemetry dashboard with recharts`

---

### T5: HistoryScreen [P]

**What**: Paginated newest-first session list (date, config summary, accuracy, outcome badge) with expandable per-attempt rows and Review action.
**Where**: `apps/web/src/screens/HistoryScreen.tsx` + test
**Depends on**: T3
**Reuses**: `sessionList`/`sessionDetail` queries
**Requirement**: TELE-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Aborted sessions show badge; zero-attempt sessions absent (per spec edge case)
- [ ] Expansion lazy-loads attempts; Review action emits `(seed, config, mode, chosenIndex)`
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 6 tests pass

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): session history screen`

---

### T6: ReviewScreen [P]

**What**: Read-only regenerated problem view: rebuild via `generateProblem`/`generateUnfoldProblem` from stored seed, mount ProblemScene non-interactive, highlight correct + chosen alternatives, fold replay button.
**Where**: `apps/web/src/screens/ReviewScreen.tsx` + test
**Depends on**: T3 · cross-feature: procedural-engine T13, game-rounds T4/T6, rendering-3d T10
**Reuses**: `useProblemScene`, `ProblemScene.showFeedback/setInteractive/playFold`
**Requirement**: TELE-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Regeneration determinism asserted: rebuilt problem deep-equals a stored golden fixture for the same seed
- [ ] Correct and chosen alternatives both indicated for a wrong-answer fixture (spec TELE-03 AC4)
- [ ] Scene mocked in component tests; interaction locked
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 5 tests pass

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): attempt review screen`

---

### T7: Export / import [P]

**What**: Versioned JSON envelope export; validating idempotent import (validate whole file first, merge by id, rebuild dailyStats, report counts).
**Where**: `apps/web/src/storage/exporter.ts` + test; export/import UI entry in settings area
**Depends on**: T1
**Reuses**: `rebuildDailyStats`
**Requirement**: TELE-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Export → wipe → import restores equivalent DB (deep comparison, aggregates rebuilt)
- [ ] Re-import of same file: 0 added, all skipped
- [ ] Invalid + newer-version files rejected before any write
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 8 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): history export and import`

---

### T8: Boot wiring + persistence integration suite

**What**: Swap InMemorySink → DexieSink at boot (with unavailable-IndexedDB fallback + notice), add Dashboard/History views to the shell, then the verification suite: 50 simulated restart cycles with zero data loss; 10k-attempt fixture p95 dashboard query < 500 ms.
**Where**: `apps/web/src/main.tsx`, `src/App.tsx` (modify); `apps/web/src/storage/persistence.integration.test.ts`
**Depends on**: T2, T4, T5, T6, T7
**Reuses**: everything above
**Requirement**: TELE-01, TELE-02 (verification depth)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Boot uses DexieSink; forced `openDb` failure falls back to InMemorySink with visible notice
- [ ] 50 restart cycles (close/reopen fake-indexeddb): sessions+attempts intact
- [ ] 10k-attempt fixture: aggregate queries p95 < 500 ms in CI
- [ ] Gate check passes: `pnpm -w typecheck && pnpm -w lint && pnpm -w test`
- [ ] Test count: ≥ 6 tests pass

**Tests**: unit + component (verification harness)
**Gate**: full
**Commit**: `feat(web): persistent telemetry wiring with integration suite`

---

## Parallel Execution Map

```
Phase 1: T1
Phase 2: T1 → { T2 [P], T3 [P], T7 [P] }
Phase 3: T3 → { T4 [P], T5 [P], T6 [P] }
Phase 4: T2,T4,T5,T6,T7 → T8
```

`[P]` tasks touch disjoint files; fake-indexeddb instances are per-test-file (TESTING.md parallel-safe).

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 schema module (+its rebuild function — cohesive) | ✅ Granular |
| T2 | 1 sink class + contract-suite refactor (cohesive: same contract) | ✅ Granular |
| T3, T7 | 1 module each | ✅ Granular |
| T4, T5, T6 | 1 screen each | ✅ Granular |
| T8 | 1 wiring change + 1 verification suite (cohesive integration deliverable) | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | start node | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T7 | T1 | T1 → T7 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T3 | T3 → T5 | ✅ Match |
| T6 | T3 | T3 → T6 | ✅ Match |
| T8 | T2, T4, T5, T6, T7 | T2,T4,T5,T6,T7 → T8 | ✅ Match |

No `[P]` peers depend on each other. ✅

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1, T2, T3, T7 | storage service (Dexie) | unit (fake-indexeddb) | unit | ✅ OK |
| T4, T5, T6 | React components | component | component | ✅ OK |
| T8 | wiring + verification suite | unit/component | unit + component | ✅ OK |

No task defers its tests to another task. ✅
