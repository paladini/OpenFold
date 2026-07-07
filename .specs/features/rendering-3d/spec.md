# 3D Rendering & Animation Specification

## Problem Statement

The procedural engine emits purely mathematical descriptions (`DecoratedNet`, `FoldPlan`, `CubeState`). Learners need to *see* the net, watch it fold/unfold in 3D, and inspect five candidate cubes — the visual channel is where the spatial training happens. OpenFold needs a Three.js layer that renders these structures faithfully (any divergence from the core math would train users on wrong geometry) and animates the fold as a sequence of hinge rotations.

## Goals

- [ ] Render any `FoldProblem` — net, fold animation, and 5 answer cubes — with geometry provably matching `packages/core` output (folded scene pose equals `CubeState` in automated tests)
- [ ] Fold/unfold animation is smooth (60 fps target on integrated GPUs), scrubbable, and reversible
- [ ] Expose stable anchor points for HTML tutorial overlays (`guided-training` dependency)
- [ ] Degrade gracefully: WebGL context loss recovers without a reload; reduced-motion preference swaps animation for stepped snapshots

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Game/session logic, timers, scoring | `game-rounds` |
| Chart rendering | Recharts in `telemetry-analytics` (2D DOM, not Three.js) |
| Tutorial content & sequencing | `guided-training` consumes the anchor API defined here |
| Photorealism (PBR, shadows, post-processing) | Psychometric stimuli need clarity, not realism; flat/lambert materials only in v1 |
| React bindings (react-three-fiber) | `packages/render` is imperative Three.js behind a small class API; React mounts it in `apps/web` via a thin hook. Keeps render layer framework-agnostic and testable |

---

## User Stories

### P1: Render a fold problem scene ⭐ MVP

**User Story**: As the game UI, I want to mount a `ProblemScene` for a given `FoldProblem` into a canvas container and get the net + 5 alternatives displayed, so that a round can be presented.

**Why P1**: Nothing is playable without it.

**Acceptance Criteria**:

1. WHEN `ProblemScene.mount(container, problem)` is called THEN the system SHALL render the decorated 2D net (flat) and five isometric answer cubes with their symbols and orientations
2. WHEN the folded pose is reached (fold progress = 1) THEN each rendered face's world normal and symbol orientation SHALL equal the corresponding `CubeState` entry from `packages/core` (assertable without a GPU via scene-graph math)
3. WHEN the container resizes THEN the system SHALL adapt the renderer viewport and camera aspect without distortion
4. WHEN `dispose()` is called THEN the system SHALL release all GPU resources (geometries, materials, renderer) with zero leaked objects (verified via `renderer.info`)

**Independent Test**: Mount a fixture problem in the demo page; visually confirm layout; unit test asserts criterion 2 on scene-graph matrices with a mocked renderer.

---

### P1: Hinge fold/unfold animation ⭐ MVP

**User Story**: As a learner, I want to watch the net fold into the cube (and unfold back) driven by the exact hinge sequence from the `FoldPlan`, so that I can build a mental model of the transformation.

**Why P1**: The fold animation is the core didactic artifact and the requirement "folding/unfolding animations" from the product brief.

**Acceptance Criteria**:

1. WHEN `animator.playFold()` is invoked THEN hinges SHALL rotate from 0° to 90° in `FoldPlan` tree order (parents before children), with configurable easing and duration
2. WHEN `animator.setProgress(t)` is called with t ∈ [0,1] THEN the system SHALL show the corresponding intermediate pose deterministically (scrubbing)
3. WHEN `playUnfold()` is invoked from any progress THEN the animation SHALL reverse smoothly from the current pose
4. WHEN `prefers-reduced-motion` is set THEN `playFold()` SHALL jump through at most 6 discrete steps (one per hinge) instead of continuous animation
5. WHEN animation completes THEN a completion callback SHALL fire exactly once

**Independent Test**: Scrub a fixture from 0→1→0 in the demo page; unit test asserts pose at t=1 equals `foldNet` output and t=0 equals the flat net.

---

### P1: Camera & interaction ⭐ MVP

**User Story**: As a learner, I want to orbit/zoom the folding model and the answer cubes within sane limits, so that I can inspect spatial relations from multiple angles.

**Why P1**: Mental rotation practice requires viewpoint control; also required for accessibility of the stimuli.

**Acceptance Criteria**:

1. WHEN the user drags on the main viewport THEN the camera SHALL orbit around the model centroid with damping, clamped to prevent gimbal flip
2. WHEN the user scrolls/pinches THEN zoom SHALL clamp between configured min/max distances
3. WHEN an answer cube is hovered/focused THEN it SHALL highlight; WHEN clicked or activated via keyboard (Tab + Enter) THEN a selection callback SHALL fire with the alternative index
4. WHEN interaction is disabled (feedback phase) THEN pointer input SHALL not change selection state

**Independent Test**: Keyboard-only walkthrough selects each of the 5 alternatives in the demo page.

---

### P2: Tutorial overlay anchors

**User Story**: As the tutoring layer, I want to query screen-space positions for named scene features (face centers, hinge edges, symbols) each frame, so that HTML tooltips and diagrams can point at 3D geometry.

**Why P2**: Required by M5, not by the M3 MVP.

**Acceptance Criteria**:

1. WHEN `anchors.get('face:3')` (or `hinge:2-4`, `cube:1:face:+x`) is queried THEN the system SHALL return current CSS-pixel coordinates + visibility (occlusion/off-screen flag)
2. WHEN the camera or fold progress changes THEN anchor positions SHALL update the same frame (subscription API)
3. WHEN a face is highlighted via `highlight(faceIds, style)` THEN the system SHALL apply an outline/tint without altering geometry

**Independent Test**: Demo page pins a DOM badge to a face through a full fold + orbit; badge tracks with ≤ 1 frame lag.

---

### P2: Robust rendering lifecycle

**User Story**: As a user on a low-end machine, I want the app to survive WebGL context loss and tab backgrounding, so that a long training session never dies silently.

**Why P2**: Reliability polish; MVP demo can tolerate a reload.

**Acceptance Criteria**:

1. WHEN the WebGL context is lost THEN the system SHALL pause the loop, listen for restoration, and rebuild GPU resources from retained CPU-side state without user action
2. WHEN the tab is hidden THEN the render loop SHALL suspend (no rAF churn); WHEN visible again THEN it SHALL resume at the same fold progress
3. WHEN WebGL is unavailable entirely THEN the mount call SHALL reject with a typed error the UI can present

---

## Edge Cases

- WHEN a `FoldProblem` has blank faces (easy tier) THEN blank faces SHALL render with a neutral material and still participate in folding
- WHEN devicePixelRatio > 2 THEN the renderer SHALL cap at 2 to protect fill-rate on high-DPI laptops
- WHEN two rapid `mount` calls race (React strict-mode double-invoke) THEN the second SHALL cleanly supersede the first with no orphaned canvas or loop

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| REND-01 | P1: Render problem scene | Design | Pending |
| REND-02 | P1: Hinge fold/unfold animation | Design | Pending |
| REND-03 | P1: Camera & interaction | Design | Pending |
| REND-04 | P2: Tutorial overlay anchors | Design | Pending |
| REND-05 | P2: Rendering lifecycle robustness | Design | Pending |

**Coverage:** 5 total, 5 mapped to tasks (see tasks.md), 0 unmapped

---

## Success Criteria

- [ ] Automated pose-equivalence suite: for 100 seeded problems, folded scene pose == `CubeState` (zero divergence between math and visuals)
- [ ] 60 fps during fold animation on Intel integrated graphics (manual check, documented); no per-frame allocations in the animation loop (verified by heap profile)
- [ ] Keyboard-only round completion possible (with `game-rounds`)
- [ ] `dispose()` leaves `renderer.info.memory` at zero geometries/textures
