# Guided Training Specification

## Problem Statement

Drill without strategy plateaus quickly: research on spatial-ability training shows the largest, most durable gains come from teaching explicit solution strategies alongside practice, not from repetition alone. OpenFold must therefore include an educational layer that teaches formal, generalizable heuristics for cube-net problems — with interactive 3D demonstrations rather than static text — and connects them to the learner's actual mistakes.

## Goals

- [ ] Interactive lessons for at least two formal heuristics — the Opposition Rule and the Orientation Rule — each demonstrated on live 3D geometry the learner can step through and orbit
- [ ] Every wrong answer in a round can show a computed explanation: which rule eliminates the chosen distractor, grounded in that specific problem's geometry
- [ ] All explanation content is generated from `packages/core` heuristics APIs — zero per-item authored content (scales to infinite procedural items)
- [ ] Lessons are completable keyboard-only and honor reduced motion

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| New geometry/rule computation | `packages/core` heuristics module (PROC-05) owns all rule math; this feature presents it |
| Additional heuristics beyond the two rules (edge-tracing, corner-counting) | Post-v1 content; architecture must make adding a lesson a content-only change |
| Lesson progress gamification (badges, streaks) | v1 tracks only completed/not-completed per lesson |
| Adaptive lesson recommendation | Requires DEF-03-style modeling |

---

## User Stories

### P1: Opposition Rule lesson ⭐ MVP

**User Story**: As a learner, I want an interactive lesson teaching that two net faces separated by exactly one face in a straight strip end up on opposite cube faces (and thus can never share an edge), so that I can eliminate distractors without full mental folding.

**Why P1**: The Opposition Rule is the highest-leverage published heuristic for this item class; it's the flagship of "Guided Training".

**Acceptance Criteria**:

1. WHEN the lesson opens THEN the system SHALL present a live 3D net with the rule's face pattern highlighted (the two faces + the one between, using the render layer's highlight API)
2. WHEN the learner advances a step THEN the fold animation SHALL progress to the state that step describes, with anchored callouts pointing at the involved faces/hinges
3. WHEN the demonstration fold completes THEN the two highlighted faces SHALL be visibly opposite, and the callout SHALL restate the rule formally
4. WHEN the learner reaches the practice step THEN the system SHALL present a mini-item ("which face is opposite face X?") on a fresh procedural net, scored immediately with the rule-based justification shown
5. WHEN the lesson's steps are navigated backward THEN each step SHALL restore its exact visual state (steps are pure functions of step index)

**Independent Test**: Complete the lesson keyboard-only; verify the practice step scores correctly on 3 different procedural nets.

---

### P1: Orientation Rule lesson ⭐ MVP

**User Story**: As a learner, I want an interactive lesson showing how a symbol's orientation transforms through each 90° fold (tracking a marked vector across hinges), so that I can verify symbol orientations on candidate cubes instead of guessing.

**Why P1**: Orientation errors are what the `symbol-rotation`/`symbol-mirror` distractors exploit — the hardest tier; this is the counter-strategy.

**Acceptance Criteria**:

1. WHEN the lesson opens THEN the system SHALL show a net with one orientation-sensitive symbol and a visible orientation marker (vector arrow) on that face
2. WHEN each hinge on the face's fold path rotates THEN the marker SHALL visibly transport with the face, and a callout SHALL state the per-fold orientation delta (from `core.orientationTrace`)
3. WHEN the fold completes THEN the callout SHALL compare initial vs. final orientation and state the net-to-cube delta
4. WHEN the practice step presents a folded cube and asks the symbol's final orientation THEN the system SHALL score the answer and replay the trace as justification

**Independent Test**: For 3 seeds, the lesson's displayed final orientation equals `core.foldNet` output for that face.

---

### P1: Rule-based answer explanations ⭐ MVP

**User Story**: As a learner, I want wrong answers in normal rounds explained by the violated rule ("You picked a cube where A and B share an edge — but they're separated by one face in the net, so they must be opposite"), so that every mistake becomes a lesson.

**Why P1**: This is the connection between training and testing — the product requirement "Tutoring System & Heuristics" applied in context.

**Acceptance Criteria**:

1. WHEN feedback is shown for a wrong answer THEN the system SHALL render an explanation in the `FeedbackSlot` (game-rounds design) derived from the chosen distractor's `kind` + `affectedFaces` via `core.explainDistractor`
2. WHEN the explanation references faces THEN those faces SHALL be highlighted simultaneously on the net and on the chosen cube (anchor + highlight APIs)
3. WHEN the distractor kind is `opposite-swap` or `adjacent-permutation` THEN the explanation SHALL cite the Opposition Rule; WHEN `symbol-rotation` or `symbol-mirror` THEN the Orientation Rule
4. WHEN the answer was correct or timed out THEN the slot SHALL show a compact rule reminder (correct) or the correct answer with a one-line strategy hint (timeout)

**Independent Test**: Force each of the four distractor kinds via fixtures; verify each yields the mapped rule, correct face highlights, and coherent text.

---

### P2: Lesson hub & completion tracking

**User Story**: As a learner, I want a Training section listing available lessons with completion state, so that guided content is discoverable and progress persists.

**Why P2**: Navigation/persistence polish around the P1 content.

**Acceptance Criteria**:

1. WHEN the Training section opens THEN lessons SHALL list with title, estimated duration, and completed badge
2. WHEN a lesson's final step is reached THEN completion SHALL persist (Dexie settings) and survive restart
3. WHEN a lesson is reopened THEN it SHALL offer resume-at-step or restart

---

## Edge Cases

- WHEN the current problem's net doesn't syntactically exhibit the Opposition Rule pattern for the explained pair (rule applies semantically via fold, not via the strip pattern) THEN the explanation SHALL fall back to the fold-based phrasing ("fold and check: A and B end up opposite") — never claim the strip pattern where it doesn't exist (uses the `syntactic` flag from `core.oppositePairs`)
- WHEN reduced motion is active THEN lesson steps SHALL use stepped fold poses (render layer's stepped mode) with no continuous animation
- WHEN a lesson is interrupted mid-step (navigation away) THEN the scene SHALL dispose cleanly and resume state SHALL point at the last completed step

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TUTR-01 | P1: Opposition Rule lesson | Design | Pending |
| TUTR-02 | P1: Orientation Rule lesson | Design | Pending |
| TUTR-03 | P1: Rule-based answer explanations | Design | Pending |
| TUTR-04 | P2: Lesson hub & completion tracking | Design | Pending |

**Coverage:** 4 total, 4 mapped to tasks (see tasks.md), 0 unmapped

---

## Success Criteria

- [ ] Both lessons completable keyboard-only, with reduced motion, in < 5 minutes each
- [ ] Explanation coverage: 100% of distractor kinds produce a rule-grounded explanation on 1,000 fuzzed wrong answers (no fallback-to-generic text except the documented syntactic-pattern edge case)
- [ ] Explanations quote only faces actually present in the problem (no hallucinated geometry — asserted against `distractorMeta`)
- [ ] Lesson content defined as data (step lists), verified by adding a dummy third lesson in tests without touching player code
