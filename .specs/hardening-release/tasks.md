# M7: Hardening & Release — Task Breakdown

**Specification**: `spec.md` | **Design**: `design.md` | **Status**: Ready to execute

Milestone **M7** (final). Prerequisite: M6 complete (desktop shell, all features implemented).

---

## Execution Plan

```
Setup Phase (T0)
  └─ T0: Dependency setup + fixture scaffold

Parallel Streams (can start after T0):
  ├─ E2E Stream [P]
  │  ├─ T1: Playwright config + fixture
  │  ├─ T2: Round setup flow
  │  ├─ T3: Answer round flow
  │  ├─ T4: Review results flow
  │  └─ T5: Offline + persistence
  │
  ├─ A11y Stream [P]
  │  ├─ T6: axe-core integration
  │  ├─ T7: Keyboard navigation mapping
  │  └─ T8: Reduced-motion CSS
  │
  └─ Perf Stream [P]
     ├─ T9: Latency profiler + baselines
     └─ T10: Memory profiling + report

Release & Docs Phase (sequential after above streams)
  ├─ T11: RELEASING.md + checklist
  ├─ T12: CONTRIBUTING.md + docs update
  ├─ T13: Cross-platform binary validation
  └─ T14: v1.0.0 release tag + GitHub release
```

---

## Task Definitions

### Setup Phase

#### T0: Dependency Setup & Fixture Scaffold

**What**: Install Playwright + axe-core; create `e2e/`, `.a11y/`, `perf/` directories; write shared fixtures (problem bank, browser context, common assertions).

**Where**: 
- `package.json` (devDependencies)
- `e2e/` (new directory)
- `.a11y/` (new directory)
- `perf/` (new directory)
- `apps/web/src/__fixtures__/` (problem bank)

**Depends on**: None (in-feature)

**Reuses**: None

**Requirement**: — (setup/infra)

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] `pnpm install` adds `@playwright/test` ^1.50.0, `@axe-core/playwright` ^4.10.0
- [ ] `e2e/`, `.a11y/`, `perf/` directories exist with placeholder index files
- [ ] `e2e/fixtures.ts` exports: `createBrowserContext()`, `SEED_PROBLEMS` (10 seeded problems), `expectSuccess()`, `expectA11yPass()`
- [ ] `.github/workflows/ci.yml` updated with stub for e2e gate (passes 0 tests for now)
- [ ] `pnpm -w test` still passes (existing tests unaffected)

**Tests**: unit (existence proof)

**Gate**: quick — `ls e2e/ .a11y/ perf/` (structure exists); `pnpm install --dry-run` (deps resolve)

**Commit**: `chore(e2e): scaffold playwright + axe setup`

---

### E2E Stream

#### T1: Playwright Config & Fixture [P]

**What**: `playwright.config.ts` (base URL, screenshot/trace on failure, parallelism), `e2e/fixtures.ts` (problem bank, browser context helpers, custom assertions), CI wiring in `.github/workflows/ci.yml`.

**Where**:
- `playwright.config.ts` (root)
- `e2e/fixtures.ts`
- `e2e/config/constants.ts`, `e2e/config/problems.ts`
- `.github/workflows/ci.yml` (add e2e stage)

**Depends on**: T0

**Reuses**: `core` seeded generation (use 10 fixed seeds for reproducibility)

**Requirement**: HARD-01, design section "E2E Testing"

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] `playwright.config.ts` defines: baseURL, webServer (dev server auto-start), screenshot/trace on failure, 2 projects (chromium, firefox)
- [ ] `e2e/fixtures.ts` exports: `createProblemBank()` (10 seeded problems), `test` fixture with `page`, `context`, custom matchers
- [ ] `e2e/config/constants.ts` has selectors (`.cube-view`, `.answer-btn`, `.result-score`) and timeouts (30s default, 5s for instant UI)
- [ ] `.github/workflows/ci.yml` has `e2e` job: installs pnpm, starts dev server, runs playwright, uploads traces/artifacts on fail
- [ ] `pnpm exec playwright test e2e/` runs 0 tests (all placeholder) with no errors
- [ ] `pnpm -w test` still ≥ 45 pass (existing tests unaffected)

**Tests**: unit (config proof), integration (fixture round-trip)

**Gate**: quick — `pnpm exec playwright test e2e/ --list` (shows test structure); `pnpm run build && pnpm exec playwright test --headed --project=chromium e2e/config/ --max-failures=1` (single test, visual verify)

**Commit**: `test(e2e): playwright config + fixture scaffold`

---

#### T2: Round Setup Flow [P]

**What**: E2E test for launching the app, configuring a round (difficulty, problem count), and hitting Start. Verifies: UI loads, config form works, problem 1 renders correctly.

**Where**: `e2e/flows/round-setup.test.ts`

**Depends on**: T1

**Reuses**: `e2e/fixtures.ts`, `@openfold/core` generation (seeded)

**Requirement**: HARD-01 (round setup), design section "Key Flows"

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] Test suite: "Round Setup" with 3 cases:
  1. Load app → config form visible
  2. Config difficulty=expert, count=5 → values persist
  3. Click Start → problem 1 renders (net + 5 answer cubes visible)
- [ ] No hardcoded waits; use `waitForSelector` or `waitForFunction` with explicit conditions
- [ ] Takes < 10 s per test (parallelizable)
- [ ] `pnpm exec playwright test e2e/flows/round-setup.test.ts` passes on both chromium & firefox
- [ ] `pnpm -w test` still ≥ 45 pass

**Tests**: e2e (Playwright)

**Gate**: quick — `pnpm exec playwright test e2e/flows/round-setup.test.ts --headed --project=chromium` (visual verify)

**Commit**: `test(e2e): round setup flow`

---

#### T3: Answer Round Flow [P]

**What**: E2E test for completing a round: answer 3 problems, submit round, see results summary.

**Where**: `e2e/flows/answer-round.test.ts`

**Depends on**: T2

**Reuses**: `e2e/fixtures.ts`, problem bank

**Requirement**: HARD-01 (main game loop)

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] Test cases:
  1. Start round → answer problem 1 (click correct cube) → feedback visible (correct/incorrect message)
  2. Answer problems 2-3 → timer running (visible countdown)
  3. After 3 problems → results screen (accuracy %, time %, charts render)
- [ ] Correct answers verified deterministically (no pixel matching; check cube orientation via data attributes or console)
- [ ] Timing is captured (latency < 500 ms per submission)
- [ ] `pnpm exec playwright test e2e/flows/answer-round.test.ts` passes (all problems, ~30s total test time)
- [ ] Works on both chromium & firefox
- [ ] `pnpm -w test` still ≥ 45 pass

**Tests**: e2e (Playwright)

**Gate**: quick — `pnpm exec playwright test e2e/flows/answer-round.test.ts --headed` (watch round play out)

**Commit**: `test(e2e): answer round flow`

---

#### T4: Review Results & Dashboard [P]

**What**: E2E test for reviewing round results: accuracy chart, latency histogram, difficulty progression. Verifies data persisted to IndexedDB and charts render.

**Where**: `e2e/flows/review-results.test.ts`

**Depends on**: T3

**Reuses**: `e2e/fixtures.ts`

**Requirement**: HARD-01 (results review), design section "Key Flows"

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] Test cases:
  1. After round completes → results screen visible with accuracy %, time %, score
  2. Charts render (Recharts line charts, no errors)
  3. Check IndexedDB: round attempt record exists with all fields (seed, difficulty, responses, timestamp)
  4. Reload page → previous rounds show up in history; charts data consistent
- [ ] No pixel matching on charts; verify: element exists, no render errors in console, has data attributes
- [ ] `pnpm exec playwright test e2e/flows/review-results.test.ts` passes
- [ ] `pnpm -w test` still ≥ 45 pass

**Tests**: e2e (Playwright)

**Gate**: quick — `pnpm exec playwright test e2e/flows/review-results.test.ts` + check browser DevTools IndexedDB

**Commit**: `test(e2e): review results & dashboard flow`

---

#### T5: Offline & Data Persistence [P]

**What**: E2E tests for offline mode (web only) and data persistence across reloads. Verifies IndexedDB survives restart and offline rounds work without network.

**Where**: `e2e/flows/offline-persistence.test.ts`

**Depends on**: T4

**Reuses**: `e2e/fixtures.ts`, IndexedDB inspection helpers

**Requirement**: HARD-01 (offline requirement), PROJECT.md ("total offline capability")

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] Test cases:
  1. Enable offline mode (web) → complete round → verify no network requests (check Playwright network log)
  2. Reload page → round still in history (IndexedDB persisted)
  3. Reload again → charts show accumulated data (2 rounds)
  4. Desktop only: start app, verify IPC ping logged, close app, reopen → data-dir files exist, data-dir path matches expected per-OS path
- [ ] No network traffic during offline round (network.log is empty)
- [ ] Timing: page reload + data fetch < 2 s
- [ ] `pnpm exec playwright test e2e/flows/offline-persistence.test.ts` passes
- [ ] `pnpm -w test` still ≥ 45 pass

**Tests**: e2e (Playwright)

**Gate**: quick — `pnpm exec playwright test e2e/flows/offline-persistence.test.ts` + inspect Playwright network log

**Commit**: `test(e2e): offline + persistence flows`

---

### A11y Stream

#### T6: axe-Core Integration [P]

**What**: Add `axe-playwright` to e2e suite; create a11y audit flow in Playwright that scans every page state (setup, round, results) and fails on critical/serious violations.

**Where**: `e2e/a11y-audit.test.ts`, `.a11y/constants.ts` (axe rules config)

**Depends on**: T0

**Reuses**: Playwright fixtures, axe-core library

**Requirement**: HARD-02 (WCAG AA compliance), design section "A11y — Accessibility"

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] `e2e/a11y-audit.test.ts` test suite:
  1. Load app → run axe scan → assert zero critical violations
  2. Configure round → run axe scan → assert zero critical violations
  3. During round → run axe scan → assert zero critical violations
  4. After round → run axe scan → assert zero critical violations
- [ ] `.a11y/constants.ts` defines axe rule config (ignore known false positives, document reasoning)
- [ ] `pnpm exec playwright test e2e/a11y-audit.test.ts` passes all 4 scans
- [ ] Any violations are reported with: issue type, element, recommendation
- [ ] `pnpm -w test` still ≥ 45 pass

**Tests**: e2e (Playwright + axe-core)

**Gate**: quick — `pnpm exec playwright test e2e/a11y-audit.test.ts --headed` (watch axe violations if any)

**Commit**: `test(a11y): axe-core audit integration`

---

#### T7: Keyboard Navigation Mapping [P]

**What**: E2E test for keyboard-only interaction: Tab through all interactive elements, Enter/Space to confirm answers, Escape to cancel. Verify focus management (focus visible, tab order logical).

**Where**: `e2e/flows/keyboard-only.test.ts`, `.a11y/keyboard.constants.ts` (tab order expectations)

**Depends on**: T6

**Reuses**: Playwright fixtures, axe-core assertions

**Requirement**: HARD-02 (WCAG 2.1 AA, section 2.1.1)

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] Test cases:
  1. Load app → Tab through all buttons/form fields → focus rings visible (CSS `:focus-visible` applied)
  2. On config form: Tab to difficulty radio → arrow keys cycle options → Tab to count input → can edit → Tab to Start button → Enter launches round
  3. During round: Tab navigates to each answer cube → Enter selects it → feedback appears → Tab advances to next problem
  4. After round: Tab through result elements → focus visible on all
- [ ] Tab order matches logical reading order (left-to-right, top-to-bottom)
- [ ] No focus traps (Tab can always move forward; Shift+Tab always backward)
- [ ] Escape key closes any open modals/panels
- [ ] Full round completion via keyboard only
- [ ] `pnpm exec playwright test e2e/flows/keyboard-only.test.ts` passes
- [ ] `pnpm -w test` still ≥ 45 pass

**Tests**: e2e (Playwright, keyboard events)

**Gate**: quick — `pnpm exec playwright test e2e/flows/keyboard-only.test.ts --headed` (watch keyboard nav)

**Commit**: `test(a11y): keyboard-only navigation flow`

---

#### T8: Reduced-Motion CSS [P]

**What**: Add `@media (prefers-reduced-motion: reduce)` overrides in `globals.css` to disable animations for users with reduced-motion preference. Verify via CSS inspection + visual test.

**Where**: `apps/web/src/styles/globals.css`, `e2e/flows/reduced-motion.test.ts`

**Depends on**: T7

**Reuses**: Playwright fixtures

**Requirement**: HARD-02 (WCAG 2.1 AA, section 2.3.3)

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] CSS changes in `globals.css`:
  - `@media (prefers-reduced-motion: reduce) { animation: none !important; transition: none !important; }`
  - Fold animation: instant (no easing, no loop)
  - Fade-in/fade-out: instant (opacity 0 → 1 immediately)
  - No blinking cursor or pulsing elements
- [ ] E2E test in `reduced-motion.test.ts`:
  1. Set `prefers-reduced-motion: reduce` emulation in Playwright
  2. Play a round
  3. Verify: fold happens instantly (check animation duration = 0), no flashing, focus visible on keyboard nav
- [ ] No console errors; Recharts/Three.js respect the media query (or have fallback)
- [ ] `pnpm exec playwright test e2e/flows/reduced-motion.test.ts` passes
- [ ] `pnpm -w test` still ≥ 45 pass

**Tests**: e2e (Playwright, CSS media query), unit (CSS inspection)

**Gate**: quick — `pnpm exec playwright test e2e/flows/reduced-motion.test.ts --headed` + inspect DevTools computed styles

**Commit**: `a11y(web): reduced-motion CSS overrides`

---

### Performance Stream

#### T9: Latency Baselines & Profiler [P]

**What**: Measure and record latency for key operations: problem generation, render frame, answer submission. Create `perf/baselines.test.ts` with deterministic measurements; `perf/profiler.ts` with shared utilities.

**Where**: `perf/baselines.test.ts`, `perf/profiler.ts`

**Depends on**: T0

**Reuses**: `@openfold/core` seeded generation, Playwright performance API

**Requirement**: HARD-04 (performance validation), design section "Performance Validation"

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] `perf/profiler.ts` utilities:
  - `measureOperation(name, fn)` → records duration, logs result
  - `percentile(times[], p)` → returns p-th percentile
  - `recordBaseline(metric, value)` → appends to `perf/baselines.json`
- [ ] `perf/baselines.test.ts` test cases (each runs 100+ iterations):
  1. Problem generation (seed + parameters → net + 5 distractors) p50/p99 < 200 ms
  2. Render frame (draw → swap buffer) p50 < 20 ms (60 fps budget)
  3. Answer submission (click → feedback visible) p50 < 500 ms
  4. App cold start (load → "ready" message) p50 < 2 s
- [ ] All measurements use seeded PRNG (reproducible across runs)
- [ ] Baselines recorded to `perf/baselines.json` (git-tracked, compared in CI)
- [ ] `pnpm test perf/baselines.test.ts` passes all measurements within budget
- [ ] `pnpm -w test` still ≥ 45 pass (not including perf yet)

**Tests**: unit (performance, deterministic)

**Gate**: quick — `pnpm test perf/baselines.test.ts -- --reporter=verbose` (shows timings)

**Commit**: `perf(core): latency baseline measurements`

---

#### T10: Memory Profiling & Report [P]

**What**: Measure heap usage (idle, during round); create performance report (markdown + JSON); integrate into CI workflow.

**Where**: `perf/memory.test.ts`, `perf/report.ts`, `.github/workflows/perf.yml`

**Depends on**: T9

**Reuses**: Playwright/Node.js `navigator.memory` API, heap snapshots

**Requirement**: HARD-04 (performance validation)

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] `perf/memory.test.ts`:
  1. Idle memory (app loaded, no round active): snapshot heap, measure usedJSHeapSize
  2. After round: snapshot heap at peak (during fold animation + answer submission)
  3. Assert: idle < 50 MB, peak < 200 MB
- [ ] `perf/report.ts`:
  - Reads `perf/baselines.json`
  - Compares to baseline (flag > 10% regression)
  - Generates `perf-report-{timestamp}.json` (metric, measured, baseline, % diff, pass/fail)
  - Generates `PERF_REPORT.md` (markdown summary for GitHub release)
- [ ] `.github/workflows/perf.yml` (new CI job):
  - Runs after `web` and `desktop` jobs complete
  - Runs `pnpm test perf/`
  - Uploads `perf-report-*.json` and `PERF_REPORT.md` as artifacts
  - Comments on PR if regressions detected
- [ ] `pnpm test perf/memory.test.ts` passes (memory within budget)
- [ ] CI artifact workflow verified (dry-run or manual test)
- [ ] `pnpm -w test` still ≥ 45 pass

**Tests**: unit (performance, profiling)

**Gate**: quick — `pnpm test perf/` (all perf tests); `pnpm test perf/ -- --reporter=json > perf-results.json` (JSON output)

**Commit**: `perf(web): memory profiling + CI reporting`

---

### Release & Documentation Phase

#### T11: RELEASING.md & v1.0.0 Checklist [P]

**What**: Create `RELEASING.md` with v1.0.0 release checklist, automatable + manual steps. Document v1 gaps and v1.1+ roadmap. This becomes the single source of truth for shipping.

**Where**: `RELEASING.md`, `CHANGELOG.md` (update)

**Depends on**: T10 (all prior tasks complete)

**Reuses**: PROJECT.md, STATE.md, existing CI workflows

**Requirement**: HARD-03 (shipping), spec section "Release requirements"

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] `RELEASING.md` includes:
  - Pre-release automated checks (typecheck, lint, test, build, e2e, a11y, perf, desktop footprint)
  - Manual pre-flight: CHANGELOG update, license audit, security scan, docs review
  - Release steps: tag `v1.0.0`, CI runs, artifacts created
  - Post-release: GitHub release created, announce on community channels (if applicable)
  - Known v1 gaps (i18n, adaptive IRT, installers, cross-engine determinism) with v1.1+ plans
- [ ] `CHANGELOG.md`:
  - v1.0.0 highlights: 6 core features (procedural engine, 3D rendering, game rounds, telemetry, training, desktop shell)
  - Breaking changes: none (first release)
  - Known limitations: offline-only, no i18n, deterministic difficulty tiers
  - Thank you: contributors, dependencies
- [ ] No code changes (documentation only)
- [ ] `pnpm -w test` still ≥ 45 pass

**Tests**: — (documentation)

**Gate**: quick — `cat RELEASING.md | wc -l` (≥ 50 lines); `grep v1.0.0 CHANGELOG.md` (updated)

**Commit**: `docs: release instructions + v1.0.0 changelog`

---

#### T12: CONTRIBUTING.md & Docs Update [P]

**What**: Create `CONTRIBUTING.md` for future maintainers: dev setup, task workflow (TLC framework), CI/CD overview, testing contract. Update `README.md` with v1 scope, offline-only note, and links.

**Where**: `CONTRIBUTING.md`, `README.md` (update)

**Depends on**: T11

**Reuses**: `.specs/` documentation

**Requirement**: — (community/handoff)

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] `CONTRIBUTING.md`:
  - Dev setup: Node 20+, pnpm 10+, Rust stable
  - Running locally: `pnpm install && pnpm -w build && pnpm -w test`
  - Running the app: `pnpm --filter @openfold/web dev` (browser) or `cargo run -p openfold-desktop` (desktop)
  - Code style: TypeScript strict, Conventional Commits, ESLint
  - Testing contract: unit (vitest), e2e (playwright), a11y (axe-core)
  - TLC spec-driven workflow: features in `.specs/features/`, tasks in `tasks.md`, atomic commits per task
  - CI overview: `.github/workflows/` (ci.yml, release.yml, perf.yml)
  - Security: report via fnpaladini@gmail.com (or documented path)
- [ ] `README.md` updates:
  - Add section: "What is v1.0.0?" (scope, features)
  - Add section: "Known Limitations" (offline-only, no i18n, deterministic difficulty)
  - Update tech stack if needed
  - Link to `.specs/` for detailed architecture
- [ ] No functional changes
- [ ] `pnpm -w test` still ≥ 45 pass

**Tests**: — (documentation)

**Gate**: quick — `wc -l CONTRIBUTING.md README.md` (non-empty); `grep -i "offline\|v1.0.0" README.md` (key terms present)

**Commit**: `docs: contributing guide + readme v1.0.0`

---

#### T13: Cross-Platform Binary Validation [P]

**What**: Verify release.yml builds binaries for all 4 platforms (Windows-x64, macOS-x64/arm64, Linux-x64); measure binary sizes; test manual launch on Windows (CI only). Document any platform-specific issues.

**Where**: `scripts/validate-release.sh` (new), `.github/workflows/release.yml` (verify)

**Depends on**: T12

**Reuses**: existing release.yml, measure scripts

**Requirement**: HARD-03 (shipping binaries), design section "Release validation"

**Tools**: MCP: NONE | Skill: NONE

**Done when**:
- [ ] Create `scripts/validate-release.sh`:
  - Dry-run: `gh release create v1.0.0 --draft --generate-notes` (no actual upload)
  - Verify: All 4 platform artifact paths exist
  - Measure: Binary sizes and record in manifest
  - Checksum: SHA256 for each binary
  - Report: summary (pass/fail per platform)
- [ ] `.github/workflows/release.yml` verified (unchanged, just document):
  - On tag `v*`: build all platforms, package (zip/tar.gz), upload to GitHub release
  - Wait for: all platform builds complete (matrix strategy)
  - Post build: measure sizes, generate checksums
- [ ] Windows manual test (one-time, documented in RELEASING.md):
  - Launch release binary on Windows, verify window opens, check data-dir created
  - (Cannot automate without desktop GUI automation, already noted in STATE.md)
- [ ] Script test: `pnpm run validate-release -- --dry-run` passes without errors
- [ ] `pnpm -w test` still ≥ 45 pass

**Tests**: unit (validation script)

**Gate**: quick — `bash scripts/validate-release.sh --dry-run` (succeeds, reports structure)

**Commit**: `chore(release): binary validation script`

---

#### T14: v1.0.0 Release Tag & GitHub Release [P]

**What**: Create the actual v1.0.0 git tag; CI builds all artifacts; create GitHub release with artifacts, CHANGELOG snippet, and release notes.

**Where**: Git tag, GitHub release

**Depends on**: T13 (all validation complete)

**Reuses**: release.yml, CHANGELOG.md

**Requirement**: HARD-03 (v1.0.0 shipped)

**Tools**: GitHub CLI (`gh`), git

**Done when**:
- [ ] Pre-tag checklist (automated via T11-T13):
  - `pnpm -w test` green (≥ 45 pass)
  - `pnpm -w typecheck` green
  - `pnpm -w lint` green
  - `pnpm -w build` green
  - `cargo test -p openfold-desktop` green
  - `cargo build --release -p openfold-desktop` < 10 MB (all platforms in CI)
  - `pnpm exec playwright test e2e/` green (all flows pass > 95%)
  - `pnpm exec playwright test e2e/a11y-audit.test.ts` green (zero critical violations)
  - `pnpm test perf/` green (latency/memory within budget)
  - `scripts/validate-release.sh --dry-run` green
- [ ] Create tag: `git tag v1.0.0 -m "OpenFold v1.0.0: Procedural cube-net training simulator with guided tutorials, desktop shell, and cross-platform support."` (or shorter)
- [ ] Push tag: `git push origin v1.0.0` (CI release.yml triggers)
- [ ] CI waits for: all 4 platform builds complete (timeout 45 min)
- [ ] GitHub release created:
  - Title: "OpenFold v1.0.0"
  - Body: CHANGELOG.md v1.0.0 section + release notes (offline-only, v1 gaps, thank-you)
  - Artifacts: openfold-desktop-windows-x64.zip, openfold-desktop-macos-x64.tar.gz, openfold-desktop-macos-arm64.tar.gz, openfold-desktop-linux-x64.tar.gz
  - Checksums: SHA256 file included
  - Pre-release: false (it's the final v1)
- [ ] Verify on GitHub: release visible, all artifacts downloadable, no broken links
- [ ] Rollback plan documented (if needed): `git tag -d v1.0.0 && git push origin :v1.0.0`

**Tests**: integration (release workflow)

**Gate**: full — Verify GitHub release exists and all artifacts are downloadable

**Commit**: (tag only, no code commit for this task)

---

## Parallel Execution Recommendations

### For Solo Developer

1. **Days 1-2:** T0 (setup), T1-T2 (e2e skeleton + round setup)
2. **Day 2-3:** T6-T7 (a11y scans + keyboard), T9 (performance baselines in parallel)
3. **Day 3-4:** T3-T5 (e2e completeness), T8 (reduced-motion), T10 (memory profiling)
4. **Day 4-5:** T11-T14 (docs, release validation, ship v1.0.0)
5. **Total:** ~40-50 hours over 5 calendar days with context-switching

### For Team (3+ developers)

- **Dev A:** T0 + T1-T5 (E2E stream, ~12 hours)
- **Dev B:** T6-T8 (A11y stream, ~8 hours)
- **Dev C:** T9-T10 (Performance stream, ~6 hours)
- **All together:** T11-T14 (release & docs, ~8 hours)
- **Total:** ~34 hours wall-clock (3-4 calendar days, parallelized)

### Sequential Fallback (if parallel not possible)

Follow the execution plan order: T0 → {T1-T5, T6-T8, T9-T10 in any order} → T11-T14

---

## Gate Check Commands

Each task includes a `Gate` command; here's the full suite for M7:

```bash
# T0: Setup
ls e2e/ .a11y/ perf/ && pnpm install --dry-run

# T1: E2E Config
pnpm exec playwright test e2e/ --list

# T2-T5: E2E Flows (serial, each <10s)
pnpm exec playwright test e2e/flows/round-setup.test.ts --project=chromium --project=firefox
pnpm exec playwright test e2e/flows/answer-round.test.ts --project=chromium --project=firefox
pnpm exec playwright test e2e/flows/review-results.test.ts --project=chromium --project=firefox
pnpm exec playwright test e2e/flows/offline-persistence.test.ts --project=chromium --project=firefox

# T6-T8: A11y (serial, each <5s)
pnpm exec playwright test e2e/a11y-audit.test.ts
pnpm exec playwright test e2e/flows/keyboard-only.test.ts
pnpm exec playwright test e2e/flows/reduced-motion.test.ts

# T9-T10: Performance (serial)
pnpm test perf/baselines.test.ts -- --reporter=verbose
pnpm test perf/memory.test.ts -- --reporter=verbose

# T11-T12: Docs (manual inspection)
cat RELEASING.md CONTRIBUTING.md README.md | wc -l

# T13: Validation
bash scripts/validate-release.sh --dry-run

# T14: Release (manual tag)
git tag -l v1.0.0

# Full gate (all must pass)
pnpm -w typecheck && \
pnpm -w lint && \
pnpm -w test && \
pnpm -w build && \
cargo test -p openfold-desktop && \
cargo build --release -p openfold-desktop && \
pnpm exec playwright test e2e/ && \
pnpm test perf/ && \
bash scripts/validate-release.sh --dry-run
```

---

## Notes

- **Flaky test handling:** If Playwright tests fail intermittently (< 5% of runs), add explicit waits or re-run 3x to verify reproducibility before assuming it's a test bug.
- **Performance variance:** Baseline measurements may vary by ±10% on different hardware; record on CI and compare PR-to-PR, not absolute thresholds.
- **A11y false positives:** Document any known axe-core false positives (e.g., "canvas role on Three.js canvas") with reasoning to suppress the rule.
- **Cross-platform desktop testing:** Windows CI can verify binary builds/footprints; macOS/Linux manual verification (or dedicated CI runners) needed for full confidence.
- **Release rollback:** If v1.0.0 has a critical bug post-release, create v1.0.1 with a fix and re-tag. Do not delete v1.0.0 tag.
