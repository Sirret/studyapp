# WIP — Phase 5: Design system & exercises UI

Live checkpoint (CLAUDE.md rule 21). Delete in the commit that finishes Phase 5, after HANDOFF.md absorbs what Phase 6 needs.

## Task and where the spec lives

User's request (2026-11-07): merge the design addendum (done, `65bc10f`), then do Phase 5 following the CLAUDE.md workflow, **building the layers in order (tokens → themes → primitives → components → delight → layout → exercises) and adding each piece to `/dev/ui` as you go**.

Spec: `BUILD_PLAN` §3.3, §5, **§5.1 (new: exercise specs)**, §9, §10 row 5; `DESIGN` in full (esp. §3, §5, §7, §11–13); `CONCEPT` §4–6. Decisions log rows marked "Phase 5".

Done when (§10): contrast test passes in both themes; `/dev/ui` shows every component and Yuki state; Playwright completes a session on a mobile viewport using each exercise kind (non-diagram kinds; diagram kinds are Phase 6), with reduced motion on and off. Plus DESIGN §13.4 visual regression screenshots of `/dev/ui`.

No reviewer this phase (Decisions log: reviewer only at the end of Phases 7–9).

## Architecture decided (see Decisions log rows "Phase 5")

- `engine/exercise-spec.ts` builds an `ExerciseSpec` (discriminated on `shape`) from the current card; `engine/exercise-check.ts` grades an `ExerciseResponse`. UI can't import the engine, so `services/study-service.ts` (`StudyService`) builds the spec for the current item, grades, logs through `SessionService`, and re-exports the types for UI.
- `SessionService.answer` logs `selfRated` events for self-rated kinds and `pretest` events for `pretest`, applying them to the queue as `none` weight.
- "I was right": `acceptAdded` with `reviewEventId` re-judges that review as correct in replay; `note.accept[variant]` grows via `NoteRepo`.
- Styling: Svelte scoped styles + CSS custom properties; layers per DESIGN §13.2. Stylelint guards raw values.
- Visual regression: `toHaveScreenshot` locally; `ignoreSnapshots` on CI until Linux baselines exist.

## Checklist

- [x] Docs: addendum merged, haptics setting (`65bc10f`). Icons side task (`ff41e1e`).
- [x] BUILD_PLAN §5.1 written; config values added (`PARSONS_EXTRAS`, `MATCHING_PAIRS`, `ITEM_ROWS_SHOWN`, `BLURT_TITLE_CHARS`, `PRACTICE_SESSION_CARDS`).
- [x] Step 1 interfaces (`908b7e7`).
- [x] Step 2: agent wrote 219 tests (`exercise-spec.test.ts` 165, `exercise-check.test.ts` 45, `replay-accept.test.ts` 9, helper `exercise-fixtures.ts`); all fail only on not-implemented. 13 SPEC-GAPs settled in the Decisions log (only change: new `TypeSpec.otherPrompts`). UNCOMMITTED: the pre-commit hook runs these failing tests, so commit them with the implementation.
- [x] Step 3: engine implemented, all agent tests pass unchanged (`639c373`).
- [ ] Services: `SessionService` self-rated/pretest logging; `StudyService` (+ `study-wiring.ts`); tests written directly.
- [x] Layer 1–3: tokens (base, semantic), themes light/dark (+ auto-night), `tokens.ts` mirror, contrast unit test, fonts (Nunito, Caveat) self-hosted.
- [x] Layer 4–5: primitives (Button, Card, Chip, Input, Toggle, Checkbox, Icon) + motifs (Paw, Snowflake, Moon).
- [x] /dev/ui skeleton: `src/routes/dev/ui` (404 unless __DEV_ROUTES__), sections in `src/lib/ui/styleguide/` (GuideSection renders light+dark panes, data-guide-section ids). Tokens + Primitives sections done. Screenshot helper: scratchpad shot.mjs (copy into repo root to run; serve with `node scripts/serve-build.ts --port 4173` after `npm run build:test`).
- [x] Layer 6 components + Yuki (components/yuki/: Yuki.svelte, YukiProps.svelte, yuki.ts YUKI_STATES) and their /dev/ui sections. Extra components: TapChip, Slot (tap-to-place), PhaseInterstitial (timer PHASE_INTERSTITIAL_MS), SessionSummary (figure/footer snippets for count-up and paw walk). Deferred: ExamCountdown (Phase 8 Today), Segmented/Slider (Settings screen). Was: components (OptionButton, ProgressStrip, ProgressDots, PhaseLabel, ReadinessRing, StatusBadge, StickyNote, FeedbackPanel, Sheet, EmptyState, SpeechBubble, Banner, RoundSummary, ExerciseCard, WordBank, Yuki + states).
- [x] Layer 7 delight: delight.ts (effectOn(effect, companion), hapticTick), SnowBurst, SnowFlurry, PawStamp, CountUp, PawWalk, PawLoader, PawPressLayer; DelightGuide in /dev/ui.
- [ ] Layer 8 (NEXT): layout (Screen, Stack, Grid, TopBar, BottomNav, SafeArea).
- [ ] Layer 9: exercises (one component per shape, dispatcher `Exercise.svelte`).
- [ ] Screens: `/study/[sessionId]`, start from a course (Today), restyle `/import`, `/dev/ui` (dev only), `/dev/session` harness for e2e with forced kinds.
- [ ] Stylelint + `npm run lint` wiring; boundary lint for `src/lib/exercises`.
- [ ] e2e: session with each kind (reduced motion on/off), `/dev/ui` screenshots light/dark at 360.
- [ ] Verify, HANDOFF, PROGRESS, delete WIP.

## Agent brief: spec-test-writer (step 2)

Owns only: `tests/unit/engine/exercise-spec.test.ts`, `tests/unit/engine/exercise-check.test.ts`, `tests/unit/engine/replay-accept.test.ts` (and a fixtures file `tests/unit/engine/exercise-fixtures.ts` if needed).

> Write tests from the spec, before implementation, for `src/lib/engine/exercise-spec.ts` (`exerciseKindFor`, `promptFor`, `buildExercise`) and `src/lib/engine/exercise-check.ts` (`checkResponse`). Their signatures and types are in those files (bodies throw `not implemented`). Read ONLY: BUILD_PLAN §5 and §5.1, §6.10, §6.11, §6.4 (the contrastive-feedback bullet), DATA_MODEL §4.2–§4.3, and the Decisions log rows whose text starts "Phase 5" plus the rows about `cardAnswer`, answer kinds, distractor tiers and first-letter banks. Existing helpers they build on (read signatures only): `cardAnswer`/`answerEntries` (engine/answers.ts), `pickDistractors`/`firstLetterBank` (engine/distractors.ts), `gradeTyped`/`normalizeAnswer` (engine/grading.ts), `gradeSequence` (engine/grading-shapes.ts), `rngFor`/`createRng` (engine/rng.ts), `currentKind`/`currentStep` (engine/exercise-kinds.ts). Config names: `MC_OPTIONS`, `BANK_SIZE`, `PARSONS_EXTRAS`, `MATCHING_PAIRS`, `ITEM_ROWS_SHOWN`, `BLURT_TITLE_CHARS`. Test behaviour, not exact shuffles: assert sets, that `correctIndex`/`pairs`/`bucketOf`/`correctOrder` point at the right texts, determinism for the same seed, and every fallback in the §5.1 table (the spec's `kind` must be the fallback kind). Cover every non-diagram kind and every non-diagram note type, and `checkResponse` for every shape (correct, wrong, contrast and `chosenFromCardId` on a sibling pick, typed collision, marks, placed parsons extra, self-rated returns correct). Also write `tests/unit/engine/replay-accept.test.ts` for the Decisions-log row "Phase 5: I was right": `replay` treats a review event as correct when an `acceptAdded` event has `reviewEventId` equal to its id, whatever order they arrive in; an `acceptAdded` without `reviewEventId` changes nothing; use the existing replay fixtures in `tests/unit/engine/fixtures.ts`/`replay.test.ts` style. Run the tests: they must fail only on `not implemented` (or, for replay, on the missing behaviour). Report: tests written per function, and every SPEC-GAP (an ambiguity you had to resolve) with the reading you chose.

## Decided but not yet in the docs

- Dev routes: `__DEV_ROUTES__` (vite define) is true unless mode is production; `build:test` (`vite build --mode test`) is what verify and e2e use; deploy uses `build`. Gate `/dev/*` pages with it (404 otherwise).
- Effects follow `data-companion` on <html> (set by `ui/layout/AppRoot.svelte`); pressables carry `data-paw`; one `delight/PawPressLayer` draws paws.
- Display prefs: `services/preferences.svelte.ts` ($state, lazily loads settings via `preferences-wiring.ts` so zod stays out of the shell); theme hint in localStorage; inline script in app.html.
- Components may read semantic tokens and the `--space-*`/`--size-px-*` scales; never `--palette-*`, `--ms-*`, `--curve-*`, `--radius-*`, `--layer-*`. Stylelint to enforce.
- Arrange/sort/pair exercises: tap-to-select then tap-target (works by touch, mouse, keyboard); pointer drag gestures deferred to Phase 10 polish.
- Contrast-adjusted light shades already written into DESIGN §3.1.
