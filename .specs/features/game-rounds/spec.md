# Game Rounds Specification

## Problem Statement

The engine and renderer produce and display problems, but training requires structured sessions: users must configure difficulty, problem count, and time pressure (mirroring real psychometric test conditions), then move through a timed answer loop with immediate feedback and a final summary. This feature is the game loop that turns components into a trainer — and the first milestone with end-user value (M3).

## Goals

- [ ] Users can configure and complete a full round (config → N problems → summary) entirely offline in the browser build
- [ ] Time-limit behavior matches test conditions: hard per-item cutoffs, no pausing during an item
- [ ] Every attempt emits a complete, typed telemetry event (consumed by `telemetry-analytics`) — zero attempts lost, including timeouts and aborts
- [ ] Both question directions supported: fold (net → pick cube) and unfold (cube → pick net rendering)

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Persistence of attempts | `telemetry-analytics` owns storage; this feature emits events through its interface |
| Charts/history UI | `telemetry-analytics` |
| Tutorial/explanations content | `guided-training` plugs into the feedback phase via a defined slot |
| Global app shell (routing, theming, settings screens) | Cross-cutting `apps/web` scaffolding, handled in this feature's Phase 1 as infra (first web feature to land) |
| Adaptive difficulty between items | STATE.md D-07 |

---

## User Stories

### P1: Configure a round ⭐ MVP

**User Story**: As a learner, I want to choose difficulty preset, number of problems (5–50), and per-item time limit (10 s – 120 s, or unlimited) before starting, so that sessions match my training target.

**Why P1**: "Dynamic Rounds — user-parameterized sessions" is a core product requirement.

**Acceptance Criteria**:

1. WHEN the config screen opens THEN the system SHALL show difficulty (easy/medium/hard), problem count, time limit, and question mode (fold/unfold/mixed), pre-filled with the user's last-used values
2. WHEN the user submits a valid config THEN the system SHALL start a round with a fresh session id and a seed sequence derived from a session seed
3. WHEN a config value is out of range THEN the system SHALL disable start and show the constraint inline
4. WHEN the user has no prior config THEN defaults SHALL be medium / 10 problems / 30 s / fold

**Independent Test**: Configure, start, and verify the first problem matches the chosen difficulty (inspect `params` in dev tools event log).

---

### P1: Answer loop with timing ⭐ MVP

**User Story**: As a learner, I want to view each problem, answer within the time limit, and get immediate correctness feedback, so that training has the pacing of a real test.

**Why P1**: The core loop.

**Acceptance Criteria**:

1. WHEN a problem is presented in fold mode THEN the system SHALL show the flat net and 5 answer cubes; the response timer SHALL start only when the scene is fully mounted and visible
2. WHEN the user selects an alternative THEN the system SHALL lock input, record `responseMs`, show correct/incorrect feedback (with the correct alternative indicated), and enable "Next"
3. WHEN the time limit elapses without an answer THEN the system SHALL record a timeout attempt (`correct: false, timedOut: true`), show feedback, and proceed as after a wrong answer
4. WHEN the user presses keys 1–5 or uses Tab+Enter THEN selection SHALL work without a pointer (keyboard parity)
5. WHEN feedback is displayed THEN the fold animation SHALL be replayable (learner can watch the correct folding) without affecting recorded timing

**Independent Test**: Complete a 5-problem round using only the keyboard; verify 5 attempt events with plausible `responseMs`.

---

### P1: Round summary ⭐ MVP

**User Story**: As a learner, I want an end-of-round summary (accuracy, mean/median response time, per-item breakdown), so that each session ends with a signal.

**Why P1**: Closes the loop; M3 exit criterion.

**Acceptance Criteria**:

1. WHEN the last problem's feedback is dismissed THEN the system SHALL show: accuracy %, correct count, mean and median response ms, and a per-item list (item #, correct/incorrect/timeout, time)
2. WHEN the summary is shown THEN the system SHALL emit a session-completed event with the computed summary (for `telemetry-analytics`)
3. WHEN the user chooses "Retry same settings" THEN a new round SHALL start with a new session seed and the same config

**Independent Test**: Round of 3 with known outcomes (2 correct, 1 timeout) shows accuracy 66.7% and the correct per-item flags.

---

### P2: Unfold mode

**User Story**: As a learner, I want inverse items — shown an assembled cube, pick the net that folds into it — so that I train both directions of the transformation (spatial visualization vs. mental unfolding).

**Why P2**: Valuable and cheap on top of the engine (alternatives become nets), but fold mode alone is a viable MVP.

**Acceptance Criteria**:

1. WHEN mode is `unfold` THEN the system SHALL display the folded cube (orbitable) and 5 candidate flat nets, exactly one of which folds to it
2. WHEN mode is `mixed` THEN each item SHALL be fold or unfold with a seed-derived 50/50 draw
3. WHEN an unfold item is generated THEN the same validity guarantees apply (1 correct, 4 canonically-distinct distractor nets)

**Independent Test**: 10 unfold items: selecting the net that `foldNet`-matches the shown cube is always scored correct.

---

### P2: Round interruption handling

**User Story**: As a learner, I want to abort a round or survive an accidental reload without corrupting my stats, so that partial data stays honest.

**Why P2**: Data integrity for telemetry; not needed to demo the loop.

**Acceptance Criteria**:

1. WHEN the user aborts mid-round THEN attempts already made SHALL be preserved and the session SHALL be marked `aborted` with a partial summary
2. WHEN the page reloads mid-item THEN the system SHALL mark the in-flight session `aborted` on next launch (no phantom "in progress" sessions)
3. WHEN a round is aborted before any answer THEN the session record SHALL be discarded entirely

---

## Edge Cases

- WHEN the scene fails to mount (WebGL unavailable) THEN the round SHALL abort with the typed error surfaced and no attempt/session records written except a session marked `failed`
- WHEN `responseMs` would be < 300 ms THEN the attempt SHALL be flagged `suspect: true` (anticipation click; excluded from latency charts by default, still counted for accuracy)
- WHEN the time limit is "unlimited" THEN timeout logic SHALL be disabled and `timedOut` always false
- WHEN system clock jumps mid-item (NTP/sleep) THEN timing SHALL use `performance.now()` monotonic deltas, never wall-clock

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| GAME-01 | P1: Configure a round | Design | Pending |
| GAME-02 | P1: Answer loop with timing | Design | Pending |
| GAME-03 | P1: Round summary | Design | Pending |
| GAME-04 | P2: Unfold mode | Design | Pending |
| GAME-05 | P2: Interruption handling | Design | Pending |

**Coverage:** 5 total, 5 mapped to tasks (see tasks.md), 0 unmapped

---

## Success Criteria

- [ ] M3 exit criterion: a stranger can configure and finish a round in the browser build without instruction
- [ ] Keyboard-only completion of a full round
- [ ] 0 lost attempts across 100 simulated rounds incl. timeouts and aborts (integration test)
- [ ] Timer accuracy: recorded `responseMs` within ±50 ms of the test harness's own measurement
