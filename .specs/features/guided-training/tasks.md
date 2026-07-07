# Guided Training Tasks

**Design**: `.specs/features/guided-training/design.md`
**Status**: Approved

Milestone **M5**. Cross-feature prerequisites: `procedural-engine` T12 (heuristics), `rendering-3d` T9/T10 (anchors, highlight, stepped mode), `game-rounds` T6/T8 (hook, FeedbackSlot), `telemetry-analytics` T1 (settings table).

---

## Execution Plan

```
Phase 1:  T1 [P] (CalloutLayer) · T5 [P] (explanationText)
Phase 2:  T1 → T2 (LessonPlayer) · T1, T5 → T6 [P] (ExplanationPanel)
Phase 3:  T2 → { T3 [P] (Opposition lesson), T4 [P] (Orientation lesson) }
Phase 4:  T2, T3, T4 → T7 (TrainingHub) → T8 (verification suite, also needs T6)
```

---

## Task Breakdown

### T1: CalloutLayer [P]

**What**: DOM tooltip/badge layer subscribed to `AnchorTracker`; occlusion auto-hide; quadrant-based arrow placement.
**Where**: `apps/web/src/training/CalloutLayer.tsx` + test
**Depends on**: None (in-feature) · cross-feature: rendering-3d T9
**Reuses**: AnchorTracker subscription API
**Requirement**: TUTR-01, TUTR-02 (presentation substrate)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Callout renders at mocked anchor coordinates; updates on subscription tick
- [ ] `visible: false` anchors hide their callout
- [ ] Unmount unsubscribes (no leaked subscriptions)
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 5 tests pass

**Tests**: component (mocked AnchorTracker)
**Gate**: quick
**Commit**: `feat(web): anchored callout layer`

---

### T2: LessonScript types + LessonPlayer

**What**: The step model (design §Lesson step model) and the interpreter: scene lifecycle, step application (pose/highlights/callouts), backward-safe navigation (pure re-application), keyboard nav, practice scoring flow, completion emission.
**Where**: `apps/web/src/training/lessonTypes.ts`, `apps/web/src/training/LessonPlayer.tsx` + tests
**Depends on**: T1 · cross-feature: game-rounds T6, rendering-3d T10
**Reuses**: `useProblemScene`, `ProblemScene.setProgress/highlight`, CalloutLayer
**Requirement**: TUTR-01, TUTR-02 (runtime)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Dummy 3-step script: forward/backward navigation restores exact declared state each time (spec TUTR-01 AC5)
- [ ] Practice step: answer → score → justification view → advance
- [ ] Keyboard ←/→ navigation; scene disposed on unmount
- [ ] `onComplete` fires exactly once at final step
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 9 tests pass

**Tests**: component (mocked scene)
**Gate**: quick
**Commit**: `feat(web): data-driven lesson player`

---

### T3: Opposition Rule lesson content [P]

**What**: `LessonScript` implementing spec TUTR-01: procedural net with a straight-strip pair, highlight pattern, stepped fold demo, formal statement, practice question via `oppositePairs`.
**Where**: `apps/web/src/training/lessons/oppositionRule.lesson.ts` + test
**Depends on**: T2
**Reuses**: `core.generateNet`, `core.oppositePairs`; LessonScript types
**Requirement**: TUTR-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `makeProblem` always yields a net containing a syntactic strip pattern (constrained sampling, seeded test over 100 rng states)
- [ ] Practice question's correct answer matches `oppositePairs` for 3 pinned seeds
- [ ] Step declarations reference only anchors/faces present in the generated net
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 5 tests pass

**Tests**: unit (content is data + pure functions)
**Gate**: quick
**Commit**: `feat(web): opposition rule lesson`

---

### T4: Orientation Rule lesson content [P]

**What**: `LessonScript` implementing spec TUTR-02: orientation-sensitive symbol + vector marker, per-hinge transport callouts from `orientationTrace`, final-delta comparison, practice question.
**Where**: `apps/web/src/training/lessons/orientationRule.lesson.ts` + test
**Depends on**: T2
**Reuses**: `core.orientationTrace`, `core.foldNet`; LessonScript types
**Requirement**: TUTR-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Displayed final orientation equals `foldNet` output for the marked face on 3 pinned seeds (spec independent test)
- [ ] One callout per hinge on the face's fold path, each citing the correct per-fold delta
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 5 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): orientation rule lesson`

---

### T5: explanationText mapping [P]

**What**: `buildExplanation` implementing the design mapping table: distractor kind → rule citation, interpolated geometry-grounded copy, highlight/anchor targets; syntactic-flag fallback phrasing; correct/timeout variants.
**Where**: `apps/web/src/training/explanationText.ts` + test
**Depends on**: None (in-feature) · cross-feature: procedural-engine T12/T13
**Reuses**: `core.explainDistractor`, `FoldProblem.distractorMeta`
**Requirement**: TUTR-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Fixture per distractor kind: mapped rule, copy mentions only faces in `affectedFaces`/witness pair, highlights match
- [ ] Non-syntactic opposition pair uses fold-based phrasing (never claims the strip pattern — spec edge case)
- [ ] Correct and timeout outcomes produce their variants
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 8 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): rule-based explanation builder`

---

### T6: ExplanationPanel + FeedbackSlot integration [P]

**What**: Render `Explanation` in game-rounds' `FeedbackSlot`: text + simultaneous net/cube highlighting via scene API, callout anchors via CalloutLayer; wire into PlayScreen's slot.
**Where**: `apps/web/src/training/ExplanationPanel.tsx` + test; `apps/web/src/screens/PlayScreen.tsx` (modify: pass panel into slot)
**Depends on**: T1, T5
**Reuses**: FeedbackSlot render prop (game-rounds T8), `ProblemScene.highlight`
**Requirement**: TUTR-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Wrong-answer feedback renders headline/body + applies highlights on mount, clears on unmount (mocked scene spies)
- [ ] Round flow untouched: existing game-rounds tests still green (slot is additive)
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 5 tests pass

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): explanation panel in round feedback`

---

### T7: TrainingHubScreen + completion persistence

**What**: Lesson registry, hub list (title, duration, completed badge), resume/restart, completion + last-step persistence in Dexie settings; add view to app shell.
**Where**: `apps/web/src/screens/TrainingHubScreen.tsx` + test; `apps/web/src/App.tsx` (modify)
**Depends on**: T2, T3, T4 · cross-feature: telemetry-analytics T1
**Reuses**: settings table; shell view pattern
**Requirement**: TUTR-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Completion persists across simulated restart (fake-indexeddb)
- [ ] Reopen offers resume-at-step vs. restart; corrupt row resets gracefully
- [ ] Gate check passes: `pnpm --filter @openfold/web test`
- [ ] Test count: ≥ 6 tests pass

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): training hub with lesson progress`

---

### T8: Tutoring verification suite

**What**: (a) Explanation fuzz: 1,000 seeded wrong answers across kinds/tiers — every explanation rule-grounded, zero hallucinated face references (validated against `distractorMeta`); (b) keyboard-only + reduced-motion completion test for both lessons; (c) dummy-third-lesson test proving content-only extensibility.
**Where**: `apps/web/src/training/tutoring.integration.test.ts`
**Depends on**: T6, T7
**Reuses**: full stack above
**Requirement**: TUTR-01..04 (verification depth)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] 1,000/1,000 explanations pass grounding assertions; documented edge-case fallback rate reported
- [ ] Both lessons completable via keyboard events only, reduced-motion active
- [ ] Dummy lesson registered in test runs end-to-end with zero player changes
- [ ] Gate check passes: `pnpm -w typecheck && pnpm -w lint && pnpm -w test`
- [ ] Test count: ≥ 5 suites pass

**Tests**: unit + component (verification harness)
**Gate**: full
**Commit**: `test(web): tutoring verification suite`

---

## Parallel Execution Map

```
Phase 1: T1 [P] · T5 [P]           (disjoint files, no interdependency)
Phase 2: T2 ← T1 · T6 [P] ← T1,T5  (T2 and T6 disjoint; both need T1)
Phase 3: T3 [P] ← T2 · T4 [P] ← T2
Phase 4: T7 ← T2,T3,T4 → T8 ← T6,T7
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 component | ✅ Granular |
| T2 | types + interpreter (cohesive: interpreter is meaningless without its step types) | ✅ Granular |
| T3, T4 | 1 lesson data file each | ✅ Granular |
| T5 | 1 mapping module | ✅ Granular |
| T6 | 1 component + 1 slot wiring line (cohesive) | ✅ Granular |
| T7 | 1 screen + shell entry (cohesive) | ✅ Granular |
| T8 | 1 verification suite | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | start node | ✅ Match |
| T5 | None | start node | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T6 | T1, T5 | T1,T5 → T6 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T2 | T2 → T4 | ✅ Match |
| T7 | T2, T3, T4 | T2,T3,T4 → T7 | ✅ Match |
| T8 | T6, T7 | T6,T7 → T8 | ✅ Match |

T2 and T6 share phase 2 but T6 does not depend on T2 (and vice versa). No `[P]` peers interdepend. ✅

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1, T2, T6, T7 | React components/hooks | component | component | ✅ OK |
| T3, T4, T5 | web domain logic (data + pure functions) | unit | unit | ✅ OK |
| T8 | verification suite | unit/component | unit + component | ✅ OK |

No task defers its tests to another task. ✅
