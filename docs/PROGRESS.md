# Progress log

Append one entry per phase (and per session that changes the engine). Newest at the bottom.
Numbers come from `test-results/summary.md` after `npm run verify`.

## Template

### YYYY-MM-DD — Phase N: <name>
- **Built:** …
- **Tests:** unit X passed / Y failed · sim X/Y scenarios passed · e2e X/Y · coverage engine NN% lines, NN% branches
- **Bundle:** shell NN KB gzipped (budget 150)
- **Spec gaps resolved:** … (from spec-test-writer reports)
- **Review:** PASS after N rounds · nits left: …
- **Decisions:** … (also added to the Decisions log in BUILD_PLAN.md)
- **Known issues / next:** …

### 2026-11-07 — Phase 0: Setup
- **Built:** SvelteKit 3 + Svelte 5 + TS strict, adapter-static SPA, PWA (manifest, icons from `wolf.svg`, service worker with SPA fallback), Vitest with coverage and JUnit/JSON reports, Playwright at 360 × 740, Dexie schema v1, `defaults.ts`, ESLint with enforced import boundaries, Prettier, git hooks, CI workflow, `verify`, `test-summary`, `bundle-check`, `stub-check`, app logger with IndexedDB ring buffer and error capture.
- **Tests:** unit 47 passed / 0 failed · sim none yet · e2e 8/8 · coverage: no engine code yet; `db` 84.6% lines, 100% branches; total 93.29% lines, 88.15% branches
- **Bundle:** shell 65.6 KB gzipped (budget 150)
- **Spec gaps resolved:** none; `spec-test-writer` was skipped for this phase at the user's request (see Decisions log).
- **Review:** see the reviewer's verdict in the phase's pull request / next entry.
- **Done-when:** offline reopen and manifest checked in Chromium e2e; a deliberately failing test blocked a commit (checked by hand, then removed).
- **Decisions:** Kit 3 changes (`#lib`, `withPwa`), TS 6.0.x, Node 24 in CI, `preview` serves `build/`, regex lint boundaries. All in the Decisions log.
- **Known issues / next:** Not yet verified on a real Android phone (needs an HTTPS deploy, Phase 10, or a local tunnel). Local Node 23.10 is outside Vitest's supported range and npm 11.2 crashes on a fresh `npm install` (worked around with `npx npm@latest`); upgrading to Node 24 LTS fixes both. Next: Phase 1.
