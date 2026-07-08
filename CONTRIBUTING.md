# Contributing to OpenFold

Thank you for your interest in contributing to OpenFold! This document describes our development workflow, code style, and testing practices.

## Development Setup

### Prerequisites

- **Node.js** >= 20 (LTS recommended)
- **pnpm** >= 10.33.3 (package manager)
- **Rust** 1.70+ (for desktop builds)
  - Install via [rustup](https://rustup.rs/) — stable toolchain recommended
  - `cargo --version` should show `1.70.0` or later
- **Git** 2.37+

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/openfold.git
cd openfold

# Install dependencies
pnpm install

# Run full test suite
pnpm -w typecheck
pnpm -w lint
pnpm -w test

# Build web bundle + desktop binary
pnpm -w build
cargo build --release -p openfold-desktop

# Run web dev server
pnpm --filter @openfold/web dev
# Opens http://localhost:5173

# Run desktop binary (debug build)
cargo run -p openfold-desktop

# Run e2e tests (Playwright)
pnpm exec playwright test

# Run accessibility audit (axe-core)
pnpm exec playwright test e2e/a11y-audit.test.ts

# Run performance baselines
pnpm --filter @openfold/core test perf/
```

## Code Style & Standards

### TypeScript

- **strict mode** mandatory: `tsconfig.json` has `"strict": true`
- No `any` types unless unavoidable (with comment explaining why)
- Use explicit return types on public functions
- Prefer const over let; never use var

### Naming Conventions

- **Files:** kebab-case (`round-config.ts`, `play-screen.tsx`)
- **Types/Interfaces:** PascalCase (`RoundConfig`, `PlayScreenProps`)
- **Functions/Variables:** camelCase (`generateProblem`, `isCorrect`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_PROBLEMS`, `TIMEOUTS`)

### Comments

- Default: no comments (code should be self-documenting)
- Add comments only for the "why" that isn't obvious:
  - Why this approach over alternatives
  - Invariants or constraints
  - Workarounds for specific bugs/limitations

### React Components

- Use functional components only
- Prefer hooks over class components
- Use TypeScript for prop types (no PropTypes)
- Co-locate styles with components (inline or CSS-in-JS, not separate .css files)
- Maintain data-testid attributes for e2e testing

### Testing

- Unit tests co-located: `foo.ts` → `foo.test.ts` (same directory)
- Property-based tests for invariants (marked [PBT] in designs) using `fast-check`
- No snapshot tests for 3D output; assert on mathematical state instead
- Use deterministic seeds for all PRNG calls (never `Math.random()` in tests)

## Workflow & Git

### Branches

- Main branch: `main` (always releasable)
- Feature branches: `feat/feature-name`, `fix/bug-name`, `test/test-name`
- Pull requests against `main` only

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(scope): <subject>

<body>

Co-Authored-By: Your Name <you@example.com>
```

Types:
- `feat`: new feature
- `fix`: bug fix
- `test`: test additions or improvements
- `refactor`: code restructuring (no behavior change)
- `perf`: performance improvements
- `docs`: documentation
- `chore`: build/tooling/config (no src changes)
- `a11y`: accessibility fixes or improvements
- `ci`: CI/CD pipeline changes

Scopes (examples):
- `core`: packages/core
- `render`: packages/render
- `web`: apps/web
- `desktop`: crates/desktop
- `e2e`: Playwright tests
- `perf`: Performance tests

**One commit per task:** Each task in `.specs/features/*/tasks.md` becomes one atomic commit.

### Pull Requests

- Link to the relevant spec/task: "Closes #123" or "Implements TUTR-05"
- Describe what changed and why (copy the task's "What" + "Rationale")
- Verify CI passes (all gates in `.github/workflows/ci.yml`)
- Request review from maintainers

## Testing Contract

### Test Types & Locations

| Code Layer | Test Type | Framework | Location |
|-----------|-----------|-----------|----------|
| Core domain logic | **unit** (mandatory) | Vitest + fast-check | `packages/core/src/**/*.test.ts` |
| Render math/utilities | **unit** | Vitest | `packages/render/src/**/*.test.ts` |
| React components | **component** | Vitest + @testing-library/react | `apps/web/src/**/*.test.tsx` |
| Storage (Dexie) | **unit** (against fake-indexeddb) | Vitest | `apps/web/src/storage/**/*.test.ts` |
| Rust desktop host | **unit** | `cargo test` | `crates/desktop/src/**` |
| Full user flows | **e2e** (M7 onward) | Playwright | `e2e/**/*.test.ts` |
| Accessibility | **axe-core audit** (M7 onward) | axe-playwright | `e2e/a11y-audit.test.ts` |
| Performance | **baselines** | Vitest | `perf/**/*.test.ts` |

### Coverage Requirements

- **packages/core**: ≥ 90% line coverage (correctness-critical)
- **packages/render**: ≥ 70% line coverage
- **apps/web**: ≥ 70% line coverage
- **crates/desktop**: unit tests + manual verification

### Running Tests

```bash
# Unit + integration tests (all packages)
pnpm -w test

# Coverage report (core only)
pnpm --filter @openfold/core test:coverage

# E2E tests (Playwright, Chrome + Firefox)
pnpm exec playwright test

# E2E tests, headed mode (watch browser)
pnpm exec playwright test --headed

# Single test file
pnpm exec playwright test e2e/flows/round-setup.test.ts

# Performance tests
pnpm --filter @openfold/core test perf/

# Rust tests
cargo test -p openfold-desktop
```

## CI/CD Gates

Every PR must pass:

```bash
pnpm -w typecheck     # TypeScript compilation check
pnpm -w lint          # ESLint
pnpm -w test          # Unit + component tests (vitest)
pnpm -w build         # Web bundle build (Vite)
cargo test -p openfold-desktop          # Rust unit tests
cargo build --release -p openfold-desktop # Desktop release build
pnpm exec playwright test                 # E2E tests (Chrome + Firefox)
pnpm exec playwright test e2e/a11y-audit.test.ts  # Accessibility audit
```

## Architecture & Design

### Monorepo Layout

```
packages/core/      → Pure TypeScript domain logic (no DOM/Three.js)
packages/render/    → Three.js rendering layer
apps/web/           → React SPA (game loop, telemetry, training)
crates/desktop/     → Rust wry+tao native wrapper
.specs/             → TLC Spec-Driven docs (project, roadmap, features)
```

### Data Flow

```
Seed + Parameters
  ↓ (packages/core)
Deterministic Problem (net + distractors)
  ↓ (packages/render)
Three.js Scene + Animation
  ↓ (apps/web React)
Game Loop (config → play → results → telemetry)
  ↓ (IndexedDB via Dexie)
Local Persistence (offline-first)
  ↓ (crates/desktop)
Native Binary (Win/macOS/Linux)
```

### Key Design Decisions

See `.specs/project/STATE.md` for:
- D-01: React over Vue/Svelte
- D-02: Wry+tao over Tauri/Electron
- D-03: IndexedDB over SQLite (v1)
- D-04: Pure TS core (no DOM/Three.js)
- D-05: Seeds, not geometry (reproducibility)
- D-06: Spec-driven full docs up front
- D-07: Deterministic tiers, not adaptive IRT (v1)

## TLC Spec-Driven Workflow

All features follow the TLC Spec-Driven methodology:

```
SPECIFY → DESIGN → TASKS → EXECUTE
```

### Working on a Feature

1. **Understand the spec** (`.specs/features/*/spec.md`)
   - Requirements (what must the feature do?)
   - Acceptance criteria (gate check)
   - Traceability (REQ-01, REQ-02, etc.)

2. **Review the design** (`.specs/features/*/design.md`)
   - Architecture (components, data structures)
   - Integration points (how does it fit?)
   - Risks and mitigations

3. **Execute tasks** (`.specs/features/*/tasks.md`)
   - Each task has: What, Where, Depends on, Tests, Gate
   - Implement task atomically (one commit)
   - Run gate check before committing
   - Move to next task only after gate passes

### Adding a New Feature

```bash
# 1. Create .specs/features/your-feature/
mkdir -p .specs/features/your-feature

# 2. Write spec.md (requirements, acceptance criteria)
# 3. Write design.md (architecture, components)
# 4. Write tasks.md (atomic task breakdown with gates)
# 5. For each task:
#    - Implement code
#    - Write tests alongside code
#    - Run: pnpm -w typecheck && pnpm -w lint && pnpm -w test
#    - Create one commit per task
# 6. Update .specs/project/STATE.md (new decisions/blockers)
# 7. Open PR with link to feature spec
```

## Documentation

### Keep Updated

- `README.md`: Project overview, quick start, tech stack, scope
- `CONTRIBUTING.md` (this file): Developer workflow
- `RELEASING.md`: Release process checklist
- `CHANGELOG.md`: Version history
- `.specs/`: Detailed technical specs (read before implementing)

### Writing Docs

- Clear and concise (readers skim)
- Code examples over prose where helpful
- Links to related files/sections
- Emphasize "why", not just "what"

## Security

### Reporting Vulnerabilities

⚠️ **Do not open public GitHub issues for security vulnerabilities.**

Email: [fnpaladini@gmail.com](mailto:fnpaladini@gmail.com)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Dependency Updates

- Run `npm audit` (TypeScript) and `cargo audit` (Rust) regularly
- Update critical/high vulnerabilities immediately
- Minor/low updates in batch every quarter
- Document breaking changes in CHANGELOG

## Performance & Budgets

Refer to `PROJECT.md` for target budgets:

- **Cold start:** < 2s (desktop binary load-to-ready)
- **Problem generation:** < 200ms p50
- **Answer submission:** < 500ms
- **Render frame:** 60fps (16.7ms target)
- **Idle RAM:** < 50 MB
- **Binary footprint:** < 10 MB (core)

Profile with:
- Desktop: `perf/baselines.test.ts`, `crates/desktop/scripts/measure.sh`
- Web: Playwright performance timing, Chrome DevTools

## Questions & Support

- **Architecture questions:** Check `.specs/` folder first
- **Implementation blockers:** Check `.specs/project/STATE.md` (decisions, lessons)
- **Testing questions:** See TESTING.md and this file's Testing Contract section
- **General discussion:** Open a GitHub Discussion (if available)

## License

By contributing, you agree your changes are licensed under the MIT License (see LICENSE).

---

**Happy coding! 🚀**
