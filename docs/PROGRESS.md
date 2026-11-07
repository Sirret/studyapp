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
- **Tests:** unit 61 passed / 0 failed · sim none yet · e2e 8/8 · coverage: no engine code yet; `db` 84.6% lines, 100% branches; total 93.22% lines, 88.75% branches
- **Bundle:** shell 65.6 KB gzipped (budget 150)
- **Spec gaps resolved:** none; `spec-test-writer` was skipped for this phase at the user's request (see Decisions log).
- **Review:** round 1 CHANGES REQUIRED (4 should-fix, all fixed; the Android item below is open). Nits left: `@see` on exported types, `isDebugEnabled` naming, a few constants outside `defaults.ts`, tests that span several modules, §2 and §13 tables missing new entries, `simple-git-hooks || true`.
- **Done-when:** offline reopen and manifest checked in Chromium e2e; a deliberately failing test blocked a commit (checked by hand, then removed).
- **Decisions:** Kit 3 changes (`#lib`, `withPwa`), TS 6.0.x, Node 24 in CI, `preview` serves `build/`, regex lint boundaries. All in the Decisions log.
- **Known issues / next:** Not yet verified on a real Android phone (needs an HTTPS deploy, Phase 10, or a local tunnel). Local Node 23.10 is outside Vitest's supported range and npm 11.2 crashes on a fresh `npm install` (worked around with `npx npm@latest`); upgrading to Node 24 LTS fixes both. Service worker precaches every JS file, so diagram chunks must switch to runtime caching in Phase 6. Next: Phase 1.

### 2026-11-07 — Phase 1: Data layer
- **Built:** zod schemas for every entity (branded IDs, note payload union, event union, `kv` values), repositories with LWW writes and tombstones, device ID and `seq`, append-only `EventRepo`, `merge()`, `replay()` skeleton (derives `accuracy`; FSRS, criterion, status and fragile come in Phase 4), `ReplayService`.
- **Tests:** unit 164 passed / 0 failed · sim none yet · e2e 8/8 · coverage engine 100% lines, 96.7% branches; `db` 98.6% lines, 100% branches
- **Bundle:** shell 65.6 KB gzipped (budget 150); schemas and repos aren't used by a screen yet, so they aren't in it
- **Spec gaps resolved:** nine from `spec-test-writer`, all tie-breaks and scope; the ones that needed deciding are in the Decisions log.
- **Review:** no reviewer run; next one is at the end of Phase 5 (new workflow in CLAUDE.md). `merge` and `replay` tests came from `spec-test-writer`, and all 77 passed on the first implementation.
- **Decisions:** see the Decisions log. `DATA_MODEL.md` updated: `exercises` and `calibration` are partial records; `snapshot` has a concrete shape.
- **Known issues / next:** `kv.schemaVersion` isn't written yet. `tests/unit/engine/fixtures.ts` and `merge.test.ts` exceed 300 lines (lint doesn't apply limits to tests). `content-repos.ts` holds several small repositories rather than one file each. `summary.md` shows that `check` or `lint` failed but not their errors. Phase 0's Android install check is still open. Next: Phase 2.
