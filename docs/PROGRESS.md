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
- **Review:** no reviewer run; next one is a scoped pass at the end of Phase 4 (new workflow in CLAUDE.md). `merge` and `replay` tests came from `spec-test-writer`, and all 77 passed on the first implementation.
- **Decisions:** see the Decisions log. `DATA_MODEL.md` updated: `exercises` and `calibration` are partial records; `snapshot` has a concrete shape.
- **Known issues / next:** `kv.schemaVersion` isn't written yet. `tests/unit/engine/fixtures.ts` and `merge.test.ts` exceed 300 lines (lint doesn't apply limits to tests). `content-repos.ts` holds several small repositories rather than one file each. `summary.md` shows that `check` or `lint` failed but not their errors. Android install is now future work (Decisions log). Next: Phase 2.

### 2026-11-07 — Phase 2: Import
- **Built:** lexer and parser for every directive with line-numbered errors, zod AST, plan builder, zip reading (fflate), image resize to WebP with SHA-256 de-duplication, `ImportService`, `/import` screen (course picker, paste, file, camera and screenshot input, prompt copy button, preview with tap-to-jump errors, `[CHECK]` items, coverage, placement taps, commit). Also `engine/cardgen.ts`, ahead of Phase 3, because the golden tests compare exact cards. New `ContentStore.writeBatch` for all-or-nothing writes across tables.
- **Tests:** unit 322 passed / 0 failed · sim none yet · e2e 44/44 (phone and laptop) · coverage engine 98.8% lines, 94.7% branches; `import` 100% lines, 95.6% branches; `db` 98.7% lines, 100% branches
- **Bundle:** shell 69.7 KB gzipped (budget 150); zod, fflate and the repositories load only on `/import`
- **Done-when:** golden files in `tests/golden/import/` were hand-written from the spec first: sample text gives exact stored notes and cards, and malformed input gives exact line errors. The example in `CONCEPT` §14 also imports with no errors.
- **Spec gaps resolved:** `spec-test-writer` not used (not on the risky-logic list). Gaps found and decided, all in the Decisions log: `@keyterms` comes before its `@read`; `@deck` resets `@tag` and `@priority`; what a bad line drops; diagram `source:` syntax; concrete paths for examples and occlusion; `which:` and `layer:` variant names.
- **Review:** no reviewer run; next one is the scoped pass at the end of Phase 4.
- **Decisions:** see the Decisions log. `DATA_MODEL.md` updated with `notes.order` (file order was being lost to random IDs) and optional `chunks.check`.
- **Known issues / next:** Re-importing the same text adds its notes again; there's no de-duplication. Safari can't encode WebP, so attaching an image there reports an error (text import still works); not an issue on the priority browsers, and not tested in Safari or Firefox, since e2e runs Chromium only. `/import` has browser-default styling until Phase 5. The zip reader has no size limit (the user's own files, on their own device). Next: Phase 3 (`grading`, `distractors`, `rng`).

### 2026-11-07 — Phase 3: Cards & grading
- **Built:** `engine/rng.ts` (FNV-1a + mulberry32, `rngFor(cardId, sessionId, attempt)`, seeded shuffle); `engine/answers.ts` (the text answer, kind and sibling group of every card variant); `engine/grading.ts` (normalising, OSA distance, tolerance by length, collision guard, accept check); `engine/grading-shapes.ts` (hit test, sequence LIS feedback, edge-set diff); `engine/distractors.ts` (confusion counts, tiered distractors, first-letter bank). `cardgen` was already built in Phase 2. New config: `FUZZY_EDITS`, `FIRST_LETTER_LENGTH_DELTA`.
- **Tests:** unit 445 passed / 0 failed · sim none yet · e2e 44/44 · coverage engine 99.4% lines, 94.2% branches; total 96.93% lines, 93.6% branches
- **Bundle:** shell 69.7 KB gzipped (budget 150); nothing in the shell uses the new modules yet
- **Done-when:** unit tests cover every note type (`answers.test.ts`, `cardgen.test.ts`), fuzzy thresholds at 4/5 and 8/9 characters, the collision guard, the first-letter bank, the hit test and the edge-set diff. The 102 `spec-test-writer` tests all passed on the first implementation, with no test edits.
- **Spec gaps resolved:** ten from `spec-test-writer`, all small readings (punctuation-only words, colliding accepted strings, raw vs normalised option text, lowercase letter, empty inputs). Decided in the Decisions log; none needed a test change. Decisions made before the tests: answer per variant, answer kinds, sibling groups, tier order, normalising rules, grading order, LIS tie-break, edge rules, RNG.
- **Review:** no reviewer run; the scoped pass comes at the end of Phase 4.
- **Decisions:** see the Decisions log (Phase 3 rows).
- **Known issues / next:** `which:<r>` cards have no text answer yet; the Phase 5 `whichOne` exercise decides what they show. Typing a full fact definition (`fwd` cloze step) relies on the accept list, since fuzzy tolerance stops at 2 edits. The pre-commit hook runs `vitest --changed`, so untracked failing spec tests block unrelated commits during step 2 of the workflow. Next: Phase 4.
