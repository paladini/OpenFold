# Changelog

All notable changes to OpenFold are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-07-07

### Added (Initial Release)

#### Core Features
- **Procedural Engine (M1):** Unlimited cube-net folding problems generated deterministically from seeds; 11 hexomino nets, spanning-tree fold mapping, 24-rotation distractor canonicalization, zero hand-authored items
- **3D Rendering & Animation (M2):** Three.js scene with hierarchical fold animation, interactive orbit camera, 3D answer option cubes, visual feedback on selection
- **Game Rounds (M3):** Configurable difficulty tiers (easy/medium/hard/expert), problem count (5-50), per-item time limits, round summary with accuracy/latency metrics
- **Telemetry & Analytics (M4):** Local IndexedDB persistence (Dexie), per-attempt recording (response time, correctness, difficulty), historical charts (Recharts), JSON export/import
- **Guided Training (M5):** Interactive tutorials for Opposition Rule and Orientation Rule with 3D demonstrations, rule-based explanations for wrong answers, two core heuristics
- **Desktop Shell (M6):** Native executables for Windows, macOS (x64/arm64), and Linux using Rust (wry + tao webview), custom protocol asset serving, cross-platform binary < 10 MB (core), idle RAM < 50 MB, data persistence to platform-specific data dirs

#### Platform Support
- Web/browser: React SPA, runs offline (localhost after first load), Vite build tooling
- Desktop: Windows (MSVC), macOS (both Intel and Apple Silicon), Linux (GNU)
- Testing: Vitest (unit), Playwright (e2e), axe-core (accessibility), cargo test (Rust host)

#### Accessibility (WCAG 2.1 AA)
- Keyboard-only navigation (Tab, Enter, Escape, 1-5 numeric keys for answers)
- Focus indicators (visible outlines on all interactive elements)
- Reduced-motion support (@media prefers-reduced-motion: animations disabled)
- axe-core audit pass (zero critical/serious violations)

#### Performance
- Problem generation < 200ms p50 (deterministic seeded PRNG)
- Answer submission < 500ms (client-side validation)
- Cold start < 2s (desktop binary, SPA bundle embedded)
- Memory budget: idle < 50 MB, peak < 200 MB
- Binary footprint: desktop host ~1.6 MB (Windows), embedded SPA + resources

#### Developer Experience
- TLC Spec-Driven documentation (.specs/ folder with project vision, roadmap, feature specs, designs, task breakdowns)
- Comprehensive task framework with gate checks and atomic commits
- CI/CD: GitHub Actions (typecheck, lint, test, build, e2e, performance, desktop multiplatform)
- Code style: TypeScript strict mode, ESLint, Conventional Commits

### Known Limitations (v1.0.0)

#### Deferred to v1.1+
- **Native installers:** Portable zip/tar.gz only; Windows MSI, macOS .app with code signing, Linux AppImage deferred
- **Cross-engine determinism:** WebView2 (Windows) verified; WKWebView/WebKitGTK (macOS/Linux) manual verification only (requires real macOS/Linux dev machines)
- **Internationalization:** Architecture ready (content as data, not JSX), but no translations included; framework ready for crowdsourced v1.1+ translations
- **Adaptive difficulty:** Deterministic tiers only in v1; adaptive IRT requires usage data from v1 deployments
- **Non-cube Gv types:** Cube net folding only; paper folding, surface development, block counting deferred

#### Out of Scope (Post-v1)
- User accounts, cloud sync, or any network features (offline-first design)
- Multiplayer, leaderboards
- Mobile builds (iOS/Android via Capacitor)
- Alternative 3D engines (Three.js is sole math engine per spec)

### Technical Debt & Future Improvements

- Optional SQLite backend (currently IndexedDB only) for heavier telemetry queries
- Installer packaging for all platforms
- Performance profiling dashboard (baseline metrics collected, tooling ready for v1.1)
- Spaced-repetition scheduling of weak problem configurations
- Advanced analytics (correlation between difficulty tiers and individual learning curves)

### Dependencies

#### Production
- **TypeScript** 5.x (strict mode)
- **React** 18+, **ReactDOM** 18+
- **Three.js** (3D math, rendering, animation)
- **Vite** (web bundler)
- **Dexie** 4.x (IndexedDB abstraction)
- **Recharts** (telemetry charts)
- **Rust** 1.70+ with **wry** 0.55+, **tao** 0.35+ (desktop)

#### Development
- **Vitest** (unit + integration tests)
- **Playwright** 1.61+ (e2e)
- **axe-playwright** 2.2+ (accessibility audit)
- **ESLint** 9+, **@typescript-eslint** 8+
- **Cargo** + **rustup** (Rust build)

All dependencies are **MIT or Apache-2.0** licensed.

### Contributors

- Fernando Paladini (project owner, architecture, implementation)
- Claude Code (implementation assistance, testing automation)

### License

MIT © 2026

---

## Format Notes

### Unreleased (Planned)

Upcoming work tracked in `.specs/project/STATE.md` and `.specs/` feature folders. Each feature milestone (M1-M7) has its own spec/design/tasks.

### How to Read

- **Added**: New features, capabilities
- **Changed**: Modifications to existing features
- **Deprecated**: Features marked for removal in a future version
- **Removed**: Deleted features
- **Fixed**: Bug fixes
- **Security**: Security-related fixes

### Versioning

Starting v1.0.0, this project follows Semantic Versioning:
- **MAJOR** version for incompatible API changes (problem generation seed changes, storage schema breaking changes)
- **MINOR** version for new features (new problem types, new heuristics, new UI screens)
- **PATCH** version for bug fixes, performance improvements, accessibility enhancements

---

## Previous Versions

N/A (v1.0.0 is the first release)
