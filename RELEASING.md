# OpenFold Release Process

This document describes the release process for OpenFold v1.0.0 and beyond. All releases must pass the gate checks below before publishing.

## v1.0.0 Release Checklist

### Pre-Release (Automated Checks - Must Pass)

Run these commands locally and in CI to validate the release:

```bash
# TypeScript compilation
pnpm -w typecheck

# Linting
pnpm -w lint

# Unit + Integration Tests (core, render, web packages)
pnpm -w test

# Code coverage (core >= 90%, others >= 70%)
pnpm --filter @openfold/core test:coverage

# Build web bundle
pnpm -w build

# Desktop: compile and test all platforms
cargo test -p openfold-desktop
cargo build --release -p openfold-desktop

# E2E tests (Playwright, Chrome + Firefox)
pnpm exec playwright test e2e/

# Accessibility audit (axe-core)
pnpm exec playwright test e2e/a11y-audit.test.ts

# Performance baselines
pnpm test perf/

# Footprint validation (Windows/macOS/Linux)
# (Run in GitHub Actions CI on all platforms)
```

**Gate Status: All must show ✅ PASS**

### Pre-Release (Manual Checks - Must Complete)

These checks require human verification and cannot be automated:

- [ ] **CHANGELOG.md updated**
  - [ ] v1.0.0 section exists with highlights (6 features)
  - [ ] Known limitations documented (offline-only, no i18n, deterministic difficulty, no installers, cross-engine unverified)
  - [ ] No breaking changes noted (first release)
  - [ ] Contributors acknowledged

- [ ] **README.md reflects v1.0.0 scope**
  - [ ] "v1.0.0" or "Pre-release" clearly marked
  - [ ] "Offline-only" noted prominently
  - [ ] Feature list complete (6 core features)
  - [ ] Tech stack current
  - [ ] Getting started instructions accurate

- [ ] **License compliance**
  - [ ] `npm audit` (or `cargo audit`) shows no critical/high vulnerabilities
  - [ ] All dependencies are MIT or Apache-2.0
  - [ ] No GPL/AGPL dependencies
  - [ ] License file includes notices for bundled dependencies (if any)

- [ ] **Security review**
  - [ ] No hardcoded credentials or API keys
  - [ ] No path traversal vulnerabilities
  - [ ] No XSS vectors in React (no dangerouslySetInnerHTML)
  - [ ] No SQLite injection risks (N/A for v1, IndexedDB only)
  - [ ] CORS headers appropriate (if any external resources)

- [ ] **Desktop CI validation (one-time per OS)**
  - [ ] Windows: manual binary test (start app, verify window, check data-dir)
  - [ ] macOS: CI build succeeds (GitHub Actions matrix)
  - [ ] Linux: CI build succeeds (GitHub Actions matrix, xvfb-run verified)

- [ ] **Documentation accuracy**
  - [ ] CONTRIBUTING.md reflects actual dev setup
  - [ ] Architecture diagrams in .specs/ are current
  - [ ] Known v1 gaps documented in CHANGELOG + README

### Release Steps (Automated in CI)

Once all pre-release checks pass:

```bash
# 1. Create and push git tag
git tag -a v1.0.0 -m "OpenFold v1.0.0: Procedural cube-net training simulator"
git push origin v1.0.0

# 2. GitHub Actions `.github/workflows/release.yml` automatically:
#    - Detects tag push
#    - Builds all platforms (Win x64, macOS x64, macOS arm64, Linux x64)
#    - Creates release artifacts (zip/tar.gz)
#    - Records checksums (SHA256)
#    - Creates GitHub release (draft: no, pre-release: no)
```

### Post-Release (Verification)

After the GitHub release is created:

- [ ] **Download and verify one artifact per OS**
  - [ ] Windows: unzip, launch, verify window opens, check `%LOCALAPPDATA%\OpenFold` exists
  - [ ] macOS: untar, launch app binary, verify window opens
  - [ ] Linux: untar, run binary, verify window opens (headless CI only)

- [ ] **Verify release notes**
  - [ ] GitHub release page shows all 4 artifacts (Win-x64, macOS-x64, macOS-arm64, Linux-x64)
  - [ ] Checksums file present and matches artifacts
  - [ ] CHANGELOG excerpt is readable in release body
  - [ ] No typos or broken links

- [ ] **Announce release (if applicable)**
  - [ ] Update project website (if exists)
  - [ ] Post to community channels (if applicable)
  - [ ] Tag v1.0.0 commit in git history

## Release Rollback

If a critical bug is discovered post-release:

```bash
# Do NOT delete the v1.0.0 tag. Instead:

# 1. Create a fix and commit it to main
git commit -am "fix(critical): ..."

# 2. Create v1.0.1 tag
git tag -a v1.0.1 -m "OpenFold v1.0.1: Critical fix for ..."
git push origin v1.0.1

# CI will build and release v1.0.1 automatically
```

## Known v1.0.0 Limitations & v1.1+ Roadmap

These items are intentionally deferred from v1.0.0:

| Feature | v1.0.0 Status | v1.1+ Plan |
|---------|---------------|-----------|
| **Cross-engine determinism** | WebView2 (Windows) verified; WKWebView/WebKitGTK (macOS/Linux) manual-only | Implement CI testing on macOS/Linux webview runners |
| **Native installers** | Portable zip/tar.gz only | Windows MSI (cargo-wix), macOS .app bundle + code signing, Linux AppImage |
| **Internationalization (i18n)** | Structure ready; no translations | Crowdsource translations post-launch |
| **Adaptive difficulty** | Deterministic tiers only | Implement IRT after v1.0.0 usage data collected |
| **Cloud sync / Accounts** | Not implemented | Post-v1 if demand exists |
| **Non-cube Gv types** | Cube net folding only | Add paper folding, surface development, block counting |

## Versioning & Deprecation

- **v1.0.0:** MVP — 6 core features, offline-only, deterministic tiers, desktop (Win/macOS/Linux), browser
- **v1.1+:** Incremental improvements based on usage feedback
- **v2.0:** Major version for breaking changes (unlikely in near term)

## CI/CD Integration

The release process is fully automated via:

- **`.github/workflows/ci.yml`:** Runs on every push/PR (test, lint, build, e2e, perf)
- **`.github/workflows/release.yml`:** Runs only on git tag pushes matching `v*`
- **`.github/workflows/perf.yml`:** Records performance metrics (bonus, not blocking)

No manual steps required beyond the pre-release checks above. Push the tag, CI handles the rest.

## Support & Questions

For questions about releasing, check:
- `.specs/project/STATE.md` (decisions, blockers, lessons)
- `.specs/hardening-release/` (M7 detailed specs)
- `CONTRIBUTING.md` (developer workflow)
