# Procedural Engine Specification

## Problem Statement

Spatial-ability test prep tools rely on finite, static item banks: learners exhaust them, memorize answers, and the measured skill stops being spatial visualization. OpenFold needs a generator that produces an effectively unlimited stream of cube-net problems — each with a 2D net, exactly one correct 3D cube, and four provably incorrect but plausible alternatives — with difficulty controlled parametrically and full determinism from a seed.

## Goals

- [ ] Generate valid fold problems for all 11 canonical hexomino cube nets, under all net symmetries, with zero invalid items (verified by property-based tests)
- [ ] Guarantee answer-set validity: exactly 1 of 5 alternatives matches the folded net; the other 4 are pairwise distinct and distinct from the answer under all 24 cube rotations
- [ ] Full determinism: identical seed + parameters ⇒ identical problem, on every platform
- [ ] Difficulty is a pure function of declared parameters (symbol tier, decorated-face count, distractor subtlety) — no hidden randomness in difficulty

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Rendering of any kind (Three.js, canvas, SVG) | Belongs to `rendering-3d`; core stays DOM-free |
| Non-hexomino solids (tetrahedra, octahedra) | v1 is cubes only (PROJECT.md scope) |
| Adaptive difficulty selection | Deterministic tiers in v1 (STATE.md D-07) |
| Tutorial/explanation content | `guided-training` consumes the heuristics API defined here |
| Persistence of problems | Problems are regenerated from seeds (`telemetry-analytics` stores seeds, STATE.md D-05) |

---

## User Stories

### P1: Generate a complete fold problem ⭐ MVP

**User Story**: As the game layer, I want to request a problem for `(seed, difficulty)` and receive a net, five 3D alternatives, and the correct index, so that I can present a valid exercise without any authored content.

**Why P1**: This is the entire raison d'être of the engine; every other feature consumes it.

**Acceptance Criteria**:

1. WHEN `generateProblem(seed, params)` is called THEN the system SHALL return a `FoldProblem` containing one 2D net layout, five `CubeState` alternatives, and `correctIndex ∈ [0,4]`
2. WHEN the returned net is folded by the reference fold-mapper THEN the resulting `CubeState` SHALL be rotation-equivalent to `alternatives[correctIndex]` and NOT rotation-equivalent to any other alternative
3. WHEN any two of the five alternatives are compared THEN the system SHALL guarantee they are not rotation-equivalent to each other
4. WHEN the same `(seed, params)` is passed twice — including across JS engines THEN the system SHALL return deeply-equal problems
5. WHEN `params.decoratedFaces < 3` or `> 6` THEN the system SHALL throw a typed `InvalidParamsError` (fewer than 3 decorated faces makes distractors trivially detectable or ambiguous)

**Independent Test**: A test harness calls `generateProblem` for 1,000 seeds × 3 difficulty tiers and asserts criteria 1–4 on every result.

---

### P1: Deterministic net generation across all 11 nets ⭐ MVP

**User Story**: As the generator, I want to sample uniformly from the 11 canonical hexomino cube nets and their planar symmetries, so that learners cannot pattern-match a single layout.

**Why P1**: Net variety is the primary source of item diversity.

**Acceptance Criteria**:

1. WHEN a net is sampled THEN the system SHALL return one of the 11 canonical nets, transformed by a sampled element of its planar symmetry group (rotations by 90° multiples and reflections)
2. WHEN 11,000 problems are generated with sequential seeds THEN each canonical net SHALL appear with frequency within ±20% of uniform (χ² sanity bound, not a strict uniformity proof)
3. WHEN a net is returned THEN the system SHALL include its face-adjacency graph (which cells share edges) and grid coordinates for each of the 6 faces

**Independent Test**: Unit test enumerates outputs over sequential seeds and validates each against the canonical net list under symmetry normalization.

---

### P1: Fold mapping (net → cube) ⭐ MVP

**User Story**: As the generator and the render layer, I want a pure function mapping a decorated 2D net to a fully-specified cube (which symbol on which face, in which in-plane orientation), so that correctness has a single mathematical source of truth.

**Why P1**: Both answer generation and 3D animation must agree on this mapping; it is the correctness kernel.

**Acceptance Criteria**:

1. WHEN `foldNet(net)` is called THEN the system SHALL return a `CubeState` assigning each of the 6 decorated faces to a distinct cube face (±X, ±Y, ±Z) with an in-plane orientation in {0°, 90°, 180°, 270°}
2. WHEN folding any of the 11 nets under any symmetry transform THEN the 6 face normals of the result SHALL be exactly the 6 axis directions (no overlaps, no gaps) **[PBT]**
3. WHEN a net is folded THEN the system SHALL also return the spanning tree and per-face hinge sequence used, so the render layer can replay the identical fold

**Independent Test**: Property-based test folds all 11 nets × 8 symmetries × random decorations and asserts a bijection between net faces and cube faces.

---

### P1: Distractor generation with rotation-group verification ⭐ MVP

**User Story**: As the generator, I want four incorrect alternatives produced by controlled perturbations of the correct cube, each verified non-equivalent under the cube's 24 rotations, so that no item ever has two defensible answers.

**Why P1**: A single ambiguous item destroys user trust in a testing tool.

**Acceptance Criteria**:

1. WHEN distractors are generated THEN each SHALL be produced by one of the typed perturbations: `opposite-swap` (violates Opposition Rule), `symbol-rotation` (rotate one symbol 90°/180°), `symbol-mirror`, `adjacent-permutation` (cycle 3 mutually-adjacent faces)
2. WHEN a candidate distractor is rotation-equivalent to the correct cube or to an already-accepted distractor THEN the system SHALL reject it and sample another perturbation deterministically
3. WHEN `canonicalize(cube)` is called THEN the system SHALL return a canonical form such that two cubes are rotation-equivalent iff their canonical forms are deeply equal **[PBT]**
4. WHEN difficulty is `hard` THEN at least 2 of 4 distractors SHALL be `symbol-rotation` or `symbol-mirror` perturbations (visually subtle); WHEN `easy` THEN at least 3 SHALL be `opposite-swap` or `adjacent-permutation` (structurally gross)
5. WHEN each distractor is returned THEN it SHALL carry its perturbation type and the affected faces, so `guided-training` can explain why it is wrong

**Independent Test**: 10,000-seed fuzz run asserts criteria 2–3; targeted unit tests assert 1, 4, 5.

---

### P2: Heuristics API (Opposition & Orientation rules)

**User Story**: As the tutoring layer, I want queryable rule facts about any net — which face pairs are opposite, and how a symbol's orientation transforms through the fold — so that explanations are computed, never authored per item.

**Why P2**: Not needed for a playable MVP round, but required by M5 and cheap to co-locate with the fold mapper.

**Acceptance Criteria**:

1. WHEN `oppositePairs(net)` is called THEN the system SHALL return the 3 face pairs that end up on opposite cube faces, each annotated with whether the Opposition Rule pattern (two faces separated by exactly one face in a straight strip of the net) syntactically applies to that pair
2. WHEN `orientationTrace(net, faceId)` is called THEN the system SHALL return the ordered list of hinge rotations applied to that face and the net-to-cube orientation delta of its symbol
3. WHEN a distractor of type `opposite-swap` is passed to `explainDistractor` THEN the system SHALL identify the violated rule and the witnessing face pair

**Independent Test**: For every net, `oppositePairs` output equals pairs derived independently from `foldNet` face normals (dot product = −1).

---

### P3: Difficulty presets and parameter validation

**User Story**: As the UI, I want named difficulty presets (`easy`, `medium`, `hard`) that expand to full parameter sets, plus validation for custom parameter combinations, so users get sane defaults with expert override.

**Why P3**: MVP can ship with hardcoded `medium`; presets are polish.

**Acceptance Criteria**:

1. WHEN a preset name is expanded THEN the system SHALL return a frozen, documented `GenerationParams` object
2. WHEN custom params are invalid (unknown symbol tier, decorated faces out of range) THEN the system SHALL throw `InvalidParamsError` with a machine-readable reason

---

## Edge Cases

- WHEN all 6 faces carry the same rotationally-symmetric symbol THEN the generator SHALL reject the decoration sample and redraw (such a cube is rotation-equivalent to every perturbation of itself — no valid distractors exist)
- WHEN a decoration sample makes a `symbol-rotation` distractor rotation-equivalent to the answer (fully symmetric symbol, e.g. a circle, rotated) THEN the canonicalizer SHALL detect it and the sampler SHALL fall back to another perturbation type
- WHEN the perturbation sampler exhausts 32 deterministic retries without 4 valid distractors THEN the system SHALL discard the decoration and redraw it (bounded, still deterministic; property test asserts this happens for < 0.1% of seeds at every tier)
- WHEN `seed` is not a finite 32-bit-coercible number THEN the system SHALL throw `InvalidParamsError`

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PROC-01 | P1: Generate complete fold problem | Design | Pending |
| PROC-02 | P1: Deterministic net generation | Design | Pending |
| PROC-03 | P1: Fold mapping | Design | Pending |
| PROC-04 | P1: Distractor generation + verification | Design | Pending |
| PROC-05 | P2: Heuristics API | Design | Pending |
| PROC-06 | P3: Difficulty presets & validation | Design | Pending |
| PROC-07 | Edge: symmetric-decoration rejection & bounded retries | Design | Pending |

**Coverage:** 7 total, 7 mapped to tasks (see tasks.md), 0 unmapped

---

## Success Criteria

- [ ] 10,000-seed fuzz across all tiers: 0 invalid problems (ambiguous answers, duplicate alternatives, malformed nets)
- [ ] Same seed on V8 (Node CI) and JavaScriptCore/WebKit (webview) produces byte-identical serialized problems
- [ ] `packages/core` coverage ≥ 90% (TESTING.md floor)
- [ ] `generateProblem` p95 latency < 5 ms on commodity hardware (generation must never cause a perceptible pause between round items)
