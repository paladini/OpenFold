# Local Telemetry & Analytics Specification

## Problem Statement

Training without measurement is guessing: learners preparing for timed psychometric tests need to know whether accuracy and response latency are actually improving, and at which difficulty. OpenFold must record every attempt locally (offline, private by construction — data never leaves the device), and turn that history into charts: response time trends, accuracy per round, and difficulty progression over time.

## Goals

- [ ] 100% of round events (sessions, attempts) persist across restarts in both browser and desktop builds, with zero network calls
- [ ] Dashboard renders three historical charts — mean response time over time, accuracy per session, difficulty progression — from any amount of history (0 to years) in < 500 ms for 10k attempts
- [ ] Users can export their full history to a JSON file and re-import it (device migration, backup)
- [ ] Any historical attempt can be replayed: stored `(seed, params, mode)` regenerates the identical problem (STATE.md D-05)

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Cloud sync / accounts | PROJECT.md exclusion |
| SQLite backend | Deferred DEF-01; Dexie/IndexedDB is the v1 store (D-03) behind the same sink interface |
| Cross-profile comparison UI | v1 supports profiles minimally (single default profile auto-created); multi-profile UI is post-v1 |
| Psychometric norm-referencing (percentiles vs. population) | No population data; out of scope for a local-first tool |
| Attempt-level ML/IRT modeling | DEF-03 |

---

## User Stories

### P1: Persist rounds and attempts ⭐ MVP

**User Story**: As a learner, I want every round I play recorded automatically, so that my history is complete without any manual action.

**Why P1**: Foundation of the whole feature; implements the `TelemetrySink` contract that `game-rounds` already emits into.

**Acceptance Criteria**:

1. WHEN a round opens/records/closes through `TelemetrySink` THEN the system SHALL persist sessions and attempts to IndexedDB via Dexie, matching the schema in design.md
2. WHEN the app restarts THEN all previously completed sessions and attempts SHALL be readable
3. WHEN a write fails (quota exceeded, private browsing) THEN the system SHALL surface a non-blocking warning and keep the round playable (buffer + retry per game-rounds design)
4. WHEN the schema version increases in a future release THEN Dexie upgrade hooks SHALL migrate existing data losslessly (v1 ships the version-1 schema plus the upgrade scaffolding and a migration test harness)

**Independent Test**: Play a round, hard-reload, verify the session and its attempts appear in the history list.

---

### P1: History dashboard with charts ⭐ MVP

**User Story**: As a learner, I want charts of my mean response time, accuracy per session, and difficulty progression over time, so that I can see whether training works.

**Why P1**: The product requirement "plot telemetry data and historical progression" — the visible value of this feature.

**Acceptance Criteria**:

1. WHEN the dashboard opens THEN the system SHALL render: (a) line chart of mean response time per session over calendar time, split by difficulty; (b) bar/line chart of accuracy per session (chronological); (c) step/scatter chart of difficulty tier over time (highest tier played per day)
2. WHEN a time-range filter (7d / 30d / 90d / all) is applied THEN all charts SHALL update consistently
3. WHEN there is no data THEN the dashboard SHALL show an empty state with a call-to-action to start a round (never a broken chart)
4. WHEN attempts are flagged `suspect` or `timedOut` THEN they SHALL be excluded from latency aggregates but included in accuracy (with timeouts counting as incorrect), matching game-rounds semantics
5. WHEN 10,000 attempts exist THEN dashboard first paint SHALL take < 500 ms (aggregation via `dailyStats`, not raw scans)

**Independent Test**: Seed the DB with a synthetic 90-day history fixture; verify all three charts render expected shapes and the range filter works.

---

### P2: Session history list & review

**User Story**: As a learner, I want to browse past sessions and re-view any item I got wrong (regenerated from its seed, with the correct fold animation), so that I can learn from mistakes.

**Why P2**: High learning value, builds directly on D-05 regeneration, but dashboard is the MVP signal.

**Acceptance Criteria**:

1. WHEN the history list opens THEN sessions SHALL list newest-first with date, config summary, accuracy, and outcome badge (completed/aborted)
2. WHEN a session is expanded THEN its attempts SHALL list with per-item correctness, time, and a "Review" action
3. WHEN "Review" is chosen THEN the system SHALL regenerate the problem from `(seed, params, mode)` and present it read-only with the correct answer highlighted and fold animation available
4. WHEN a reviewed item was answered wrong THEN the learner's chosen alternative SHALL also be indicated

**Independent Test**: Answer an item wrong, open review, confirm the regenerated problem is visually identical and both alternatives are marked.

---

### P2: Export / import

**User Story**: As a privacy-conscious learner, I want to export my complete history to a file and import it elsewhere, so that I own my data and can migrate devices.

**Why P2**: Data ownership promise of a local-first tool; not needed for the M4 demo.

**Acceptance Criteria**:

1. WHEN export is triggered THEN the system SHALL produce a single JSON file (versioned envelope) containing profiles, sessions, attempts, and settings
2. WHEN a valid export file is imported THEN the system SHALL merge by id (idempotent re-import; no duplicates) and report counts (added/skipped)
3. WHEN an invalid or newer-version file is imported THEN the system SHALL reject with a typed message and change nothing

---

## Edge Cases

- WHEN IndexedDB is unavailable entirely (rare hardened browsers) THEN the app SHALL run with the in-memory sink and show a persistent "history disabled" notice
- WHEN two tabs run simultaneously THEN Dexie transactions SHALL keep writes consistent; the dashboard reads committed data only (last-writer-wins is acceptable; no locking UI)
- WHEN the system date moves backwards (timezone/DST) THEN `dailyStats` keys SHALL derive from local calendar dates at write time; aggregates never rewrite history
- WHEN an aborted session has zero attempts THEN it SHALL NOT appear in history (discarded per game-rounds GAME-05 AC3)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TELE-01 | P1: Persist rounds and attempts | Design | Pending |
| TELE-02 | P1: History dashboard with charts | Design | Pending |
| TELE-03 | P2: Session history list & review | Design | Pending |
| TELE-04 | P2: Export / import | Design | Pending |

**Coverage:** 4 total, 4 mapped to tasks (see tasks.md), 0 unmapped

---

## Success Criteria

- [ ] Zero data loss across 50 simulated app restarts mid-history (integration test on fake-indexeddb)
- [ ] Dashboard p95 first paint < 500 ms with a 10k-attempt fixture
- [ ] Export → wipe → import round-trip restores byte-equivalent history
- [ ] Review mode regenerates problems byte-identical to originals (determinism check against stored seeds)
