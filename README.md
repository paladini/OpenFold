# OpenFold

**[v1.0.0](https://github.com/your-org/openfold/releases/tag/v1.0.0) — Offline-Only, Fully Local**

A free, open-source, cross-platform educational simulator for training Spatial Ability (Gv factor) — mental rotation and spatial visualization through procedurally generated cube net folding/unfolding exercises. Built for learners preparing for psychometric aptitude tests (Wonderlic, DAT, BMCT) and anyone who wants to train spatial reasoning.

Every problem is procedurally generated and mathematically verified — there are no static image banks, no finite item sets to memorize, and no network calls. All training data stays on your device. Works entirely offline after download.

## v1.0.0 Status

**Release-Ready — all 6 core features complete.**

- ✅ Procedural generation engine (11 nets, deterministic PRNG)
- ✅ 3D rendering & animation (Three.js)
- ✅ Playable rounds (config, timer, feedback)
- ✅ Telemetry & charts (IndexedDB, Recharts)
- ✅ Guided training (Opposition + Orientation Rules)
- ✅ Desktop shell (Windows, macOS, Linux)
- ✅ WCAG 2.1 AA accessibility (keyboard-only, reduced-motion)
- ✅ E2E testing (Playwright)
- ✅ Performance baselines (< 200ms generation, < 500ms submission)

**Known v1.0.0 Limitations:**
- Offline-only (no cloud sync, no user accounts)
- No i18n (English only; structure ready for translations)
- Deterministic difficulty tiers (not adaptive IRT)
- Cube net folding only (other Gv types deferred)
- Portable binaries only (no native installers yet)

See [CHANGELOG.md](CHANGELOG.md) for full details and [RELEASING.md](RELEASING.md) for release notes.

**Architecture:** Built per [TLC Spec-Driven](https://skills.rest/skill/tlc-spec-driven) methodology. See [`.specs/`](.specs) for the full technical specification: project vision, architecture, and per-feature specs/designs/task breakdowns.

## Monorepo layout

```
OpenFold/
├── .specs/            # TLC spec-driven documentation (start here)
├── packages/core/      # Pure TypeScript: net generation, fold mapping, distractor generation
├── packages/render/    # Three.js: 3D scene, fold animation, interaction
├── apps/web/           # React + Vite SPA: game loop, telemetry dashboard, tutorials
└── crates/desktop/     # Rust (wry + tao): native desktop wrapper
```

## Getting started

Requires Node.js >= 20 and [pnpm](https://pnpm.io) >= 10.

```bash
pnpm install
pnpm -w build
pnpm -w test
```

To run the web app in development:

```bash
pnpm --filter @openfold/web dev
```

## Tech stack

TypeScript (strict) · Three.js · React · Recharts · Dexie (IndexedDB) · Rust (wry + tao) for the desktop wrapper.

## License

MIT — see [LICENSE](LICENSE).
