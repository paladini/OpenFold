# M7: Hardening & Release — Specification

**Milestone:** M7 (final) | **Type:** Cross-cutting hardening + shipping | **Status:** TBD (in planning)

## Overview

OpenFold is feature-complete as of M6 (all 6 core features live: procedural engine → rendering → game rounds → telemetry → training → desktop shell). M7 hardens the product for end-user release: validates correctness across browser engines and platforms, ensures accessibility compliance, proves performance budgets, and documents/automates the release process.

**Exit criterion (demoable):** v1.0.0 tagged with CI-built desktop artifacts (Windows/macOS/Linux); Playwright e2e suite green; WCAG 2.1 AA audit pass; performance budgets validated; no known regressions.

---

## Requirements

### HARD (Blocking release)

| ID | Requirement | Details |
|----|-------------|---------|
| **HARD-01** | Playwright e2e suite green | All user flows (round setup → answer → feedback → summary) pass on real Chrome + Firefox; serial run completes in < 5 min per platform |
| **HARD-02** | WCAG 2.1 AA compliance | axe-core audit pass (no critical/serious violations); keyboard-only play works; reduced-motion mode respected (no flashing, reduced animation) |
| **HARD-03** | Desktop binary v1.0.0 shipped | Release tag creates artifacts for Windows-x64, macOS-x64/arm64, Linux-x64; artifacts >100 MB must be justified |
| **HARD-04** | Cross-engine determinism verified (or gap documented) | Either: (a) golden-file test passes in WebView2/WKWebView/WebKitGTK, OR (b) STATE.md v1 gap explicitly recorded with path to fix in v1.1+ |

### SOFT (Nice-to-have, post-v1.0.0)

| ID | Requirement | Details |
|----|-------------|---------|
| **SOFT-01** | Performance profiling report | Latency p50/p99 per round size; memory allocation patterns; frame-drop analysis |
| **SOFT-02** | Installer packaging (Windows MSI, macOS .app + signing, Linux AppImage) | Currently v1 gap — portable zip/tar.gz only. Full installers require CI runner auth (signing keys) and testing on real OS |
| **SOFT-03** | Multi-language support (i18n roadmap) | Structure content as data (not JSX), document path to v1.1 i18n implementation |

---

## Scope

**In M7:**
- Playwright e2e test suite (full user flows: 3D rendering, round completion, data persistence, offline mode where applicable)
- axe-core integration + WCAG audit + keyboard/reduced-motion testing
- Performance baseline (latency, memory) against PROJECT.md budgets
- Release validation workflow (footprint, binary size, artifact integrity)
- Documentation: README updates, CONTRIBUTING.md, RELEASING.md
- Cross-engine determinism check (WebView2/WKWebView/WebKitGTK) — or honest v1 gap recording

**Out of M7:**
- Production observability (Sentry, analytics backends) — no external dependencies in v1
- User authentication / cloud sync
- Full installer packaging (MSI/app/AppImage) — v1 gap, documented
- i18n implementation — v1 gap, documented
- Performance optimization (latency reduction, memory trimming) — v1 baseline only

---

## Traceability

### From PROJECT.md Constraints

```
Technical: offline-first (no runtime network dependency)      → HARD-01 (offline roundtrip in e2e)
           TypeScript `strict` mandatory                     → existing (M0+)
           Three.js sole 3D/math engine                      → existing (M2+)
           desktop wrapper must not be Tauri/Electron        → existing (M6+)

Resources: solo-maintainer friendly                           → HARD-01 (serial e2e < 5 min)
           CI must gate all merges                            → HARD-01, HARD-02 (CI integration)
           every task independently verifiable                → all tasks below have gate commands

Licensing: permissive OSS (MIT)                               → existing
           all deps must be MIT/Apache-2.0                    → audit in release workflow
```

### From PROJECT.md Goals

```
Unlimited valid items                 → already proven in M1 unit tests
Measurable training signal            → already proven in M4 unit + integration tests
Explicit strategy instruction         → already proven in M5 unit + integration tests
Low footprint desktop                 → already measured in M6 CI; verify in HARD-03
Total offline capability              → HARD-01 (no network during e2e)
```

---

## Implementation Strategy

### Work Streams (can run in parallel after prerequisite setup)

```
┌─────────────────────────────────────────────────────────────┐
│ Setup Phase (prerequisite for all streams)                  │
│ · Create .specs/hardening-release/ structure                │
│ · Add Playwright + axe-core dependencies                    │
│ · Set up test fixtures (seeded problem bank)                │
└─────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┬─────────────────────┐
        ↓                     ↓                     ↓
   E2E Stream          A11y Stream          Performance Stream
   (Playwright)        (axe + keyboard)      (latency + memory)
   └────────────┬──────────────┬──────────────┬────────────┘
                ↓              ↓              ↓
           Gate checks (all must pass)
           · CI: pnpm test + cargo build + playwright + axe
           · Artifact build & measure
           · Cross-platform validation
                ↓
        Release & Documentation
        · v1.0.0 tag + GitHub release
        · README updates
        · CHANGELOG.md
```

### Feature Ownership

Each work stream is **independent** and can be implemented in parallel by different team members (or sequentially by one person):

1. **E2E Testing** (Playwright) — 6-8 tasks
   - Setup playwright config
   - Core flows: round setup, answer round, view results
   - Edge cases: offline toggle, IndexedDB persistence, desktop IPC
   
2. **Accessibility Audit** (WCAG + Keyboard) — 4-6 tasks
   - axe-core integration (component + e2e)
   - Keyboard navigation mapping (Tab order, enter to confirm)
   - Reduced-motion CSS + testing
   - Manual WCAG audit vs. accessibility checklist

3. **Performance Validation** — 3-4 tasks
   - Latency baseline (round generation, render frame, answer latency)
   - Memory profiling (heap snapshots, allocation tracking)
   - Footprint re-validation (binary size, bundle size)
   - Report generation (CI artifact with baseline metrics)

4. **Release & Documentation** — 3-5 tasks
   - Cross-platform build validation (Windows/macOS/Linux)
   - License compliance audit (deps only MIT/Apache-2.0)
   - v1.0.0 release checklist
   - RELEASING.md, CONTRIBUTING.md, CHANGELOG.md
   - GitHub release automation

---

## Acceptance Criteria (Gate)

✅ **All of the following must be true before v1.0.0 release:**

1. `pnpm -w test` — 100% pass, coverage ≥ thresholds (core ≥90%, others ≥70%)
2. `pnpm -w typecheck` — zero errors
3. `pnpm -w lint` — zero errors
4. `pnpm -w build` — succeeds
5. `cargo test -p openfold-desktop` — passes on Windows/macOS/Linux
6. `cargo build --release -p openfold-desktop` — binary < 10 MB (core) on all platforms
7. **E2E (Playwright):** Chrome + Firefox, all flows > 95% pass rate, no flaky tests over 3 runs
8. **A11y (axe-core):** zero critical + serious violations; keyboard-only round completion works; reduced-motion CSS verified
9. **Performance:** latency p50 < 500 ms (answer submission), memory < 200 MB during round (measured on commodity hardware)
10. **Cross-engine:** golden-file test passes on WebView2 (Windows CI) OR documented as v1 gap with v1.1+ plan
11. **Artifacts:** release.yml produces Win-x64, macOS-x64, macOS-arm64, Linux-x64 binaries; checksums recorded; README updated

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Playwright/axe-core bugs in e2e (flaky tests, false positives) | Medium | Blocks release | Early CI integration; 3-run golden run; document known issues |
| Three.js rendering differs across Chrome/Firefox/Safari (WebGL 2.0 variance) | Low | Release blocker | Visual regression testing in e2e; focus on deterministic state checks, not pixel matching |
| Keyboard navigation incomplete (missing ARIA) | Medium | A11y audit fail | Early audit with accessibility expert; use ARIA authoring practices guide |
| Desktop binary size bloat (>10 MB) | Low | Release blocker | Profile (rust-embed assets, wry link-time optimization); already in M6 CI |
| v1.0.0 tag created but artifacts don't upload | Low | Release blocker | Dry-run release.yml before tag push; manual verification on macOS/Linux CI |

---

## Dependencies & Sequencing

- **Blocking prerequisites (must finish first):** M6 (desktop shell) ✅ (done)
- **Internal dependencies (within M7):** Setup phase → 3 streams in parallel → gate checks → release
- **External blocking:** none (fully offline, no network dependencies)

---

## Success Metrics

1. **Correctness:** 100% Playwright e2e pass rate (including 3-run stability, no flaky retries)
2. **Accessibility:** WCAG 2.1 AA (zero critical violations), keyboard-only play fully functional
3. **Performance:** Measured latency p50 < 500 ms (PROJECT.md budget); memory < 200 MB
4. **Shipping:** v1.0.0 tag in git; GitHub release with all 4 binary artifacts; README documents limitations (offline-only, no cloud, v1 gaps)
5. **Code quality:** Zero known regressions vs. M1-M6 (all prior tests green)

---

## Effort Estimate

- **Setup phase:** 3-4 hours (dependencies, fixtures, CI wiring)
- **E2E stream:** 12-16 hours (8 major flows × 1.5-2h per flow including edge cases)
- **A11y stream:** 8-10 hours (axe setup, keyboard mapping, reduced-motion, manual audit)
- **Performance stream:** 6-8 hours (profiling, baselining, report)
- **Release stream:** 6-8 hours (checklist, automation, docs, validation)
- **Total:** ~40-50 hours (solo developer working ~5 days)

**Schedule:** Can compress to 2-3 calendar days with parallel stream execution (multiple developers or context-switching).

---

## Notes

- Cross-engine determinism (WebView2 vs. WKWebView vs. WebKitGTK) is listed as a "Not verified this session" item in STATE.md M6. The honest path is: either ship v1.0.0 with a verified cross-engine test, or document the gap and commit to v1.1 verification. **We recommend the latter** — a proper cross-engine golden run requires access to real macOS/Linux machines with the native webviews, which a Windows-only dev machine cannot easily automate.
- Installer packaging (Windows MSI, macOS .app, Linux AppImage) is deliberately v1 gap — each requires OS-specific tooling, code-signing infrastructure, and manual testing on the real OS. Portable zip/tar.gz meets the MVP requirement.
- i18n is a v1 gap but the architecture (tutorial content as data, not JSX) is ready for it.
