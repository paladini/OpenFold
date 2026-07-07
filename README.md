# OpenFold

A free, open-source, cross-platform educational simulator for training Spatial Ability (Gv factor) — mental rotation and spatial visualization through procedurally generated cube net folding/unfolding exercises. Built for learners preparing for psychometric aptitude tests (Wonderlic, DAT, BMCT) and anyone who wants to train spatial reasoning.

Every problem is procedurally generated and mathematically verified — there are no static image banks, no finite item sets to memorize, and no network calls. All training data stays on your device.

## Status

Under active development, built per the [TLC Spec-Driven](https://skills.rest/skill/tlc-spec-driven) methodology. See [`.specs/`](.specs) for the full technical specification: project vision, architecture, and per-feature specs/designs/task breakdowns.

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
