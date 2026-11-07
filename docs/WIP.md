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
- [ ] Step 1 interfaces: `exercise-spec.ts`, `exercise-check.ts` (stubs), `currentStep` in `exercise-kinds.ts` (done + tested). Commit.
- [ ] Step 2: `spec-test-writer` on `exercise-spec`, `exercise-check` and the replay re-judge (brief below). Resolve SPEC-GAPs.
- [ ] Step 3: implement until the agent's tests pass.
- [ ] Services: `SessionService` self-rated/pretest logging; `StudyService` (+ `study-wiring.ts`); tests written directly.
- [ ] Layer 1–3: tokens (base, semantic), themes light/dark (+ auto-night), `tokens.ts` mirror, contrast unit test, fonts (Nunito, Caveat) self-hosted.
- [ ] Layer 4–5: primitives (Button, Card, Chip, Input, Toggle, Checkbox, Icon) + motifs (Paw, Snowflake, Moon).
- [ ] Layer 6: components (OptionButton, ProgressStrip, ProgressDots, PhaseLabel, ReadinessRing, StatusBadge, StickyNote, FeedbackPanel, Sheet, EmptyState, SpeechBubble, Banner, RoundSummary, ExerciseCard, WordBank, Yuki + states).
- [ ] Layer 7: delight (PawPress, CheckDraw/SnowBurst, SnowFlurry, PawStamp, CountUp, PawWalk, PawLoader, haptics).
- [ ] Layer 8: layout (Screen, Stack, Grid, TopBar, BottomNav, SafeArea).
- [ ] Layer 9: exercises (one component per shape, dispatcher `Exercise.svelte`).
- [ ] Screens: `/study/[sessionId]`, start from a course (Today), restyle `/import`, `/dev/ui` (dev only), `/dev/session` harness for e2e with forced kinds.
- [ ] Stylelint + `npm run lint` wiring; boundary lint for `src/lib/exercises`.
- [ ] e2e: session with each kind (reduced motion on/off), `/dev/ui` screenshots light/dark at 360.
- [ ] Verify, HANDOFF, PROGRESS, delete WIP.

## Agent brief: spec-test-writer (step 2)

Owns only: `tests/unit/engine/exercise-spec.test.ts`, `tests/unit/engine/exercise-check.test.ts`, `tests/unit/engine/replay-accept.test.ts` (and a fixtures file `tests/unit/engine/exercise-fixtures.ts` if needed).

> Write tests from the spec, before implementation, for `src/lib/engine/exercise-spec.ts` (`exerciseKindFor`, `promptFor`, `buildExercise`) and `src/lib/engine/exercise-check.ts` (`checkResponse`). Their signatures and types are in those files (bodies throw `not implemented`). Read ONLY: BUILD_PLAN §5 and §5.1, §6.10, §6.11, §6.4 (the contrastive-feedback bullet), DATA_MODEL §4.2–§4.3, and the Decisions log rows whose text starts "Phase 5" plus the rows about `cardAnswer`, answer kinds, distractor tiers and first-letter banks. Existing helpers they build on (read signatures only): `cardAnswer`/`answerEntries` (engine/answers.ts), `pickDistractors`/`firstLetterBank` (engine/distractors.ts), `gradeTyped`/`normalizeAnswer` (engine/grading.ts), `gradeSequence` (engine/grading-shapes.ts), `rngFor`/`createRng` (engine/rng.ts), `currentKind`/`currentStep` (engine/exercise-kinds.ts). Config names: `MC_OPTIONS`, `BANK_SIZE`, `PARSONS_EXTRAS`, `MATCHING_PAIRS`, `ITEM_ROWS_SHOWN`, `BLURT_TITLE_CHARS`. Test behaviour, not exact shuffles: assert sets, that `correctIndex`/`pairs`/`bucketOf`/`correctOrder` point at the right texts, determinism for the same seed, and every fallback in the §5.1 table (the spec's `kind` must be the fallback kind). Cover every non-diagram kind and every non-diagram note type, and `checkResponse` for every shape (correct, wrong, contrast and `chosenFromCardId` on a sibling pick, typed collision, marks, placed parsons extra, self-rated returns correct). Also write `tests/unit/engine/replay-accept.test.ts` for the Decisions-log row "Phase 5: I was right": `replay` treats a review event as correct when an `acceptAdded` event has `reviewEventId` equal to its id, whatever order they arrive in; an `acceptAdded` without `reviewEventId` changes nothing; use the existing replay fixtures in `tests/unit/engine/fixtures.ts`/`replay.test.ts` style. Run the tests: they must fail only on `not implemented` (or, for replay, on the missing behaviour). Report: tests written per function, and every SPEC-GAP (an ambiguity you had to resolve) with the reading you chose.

## Decided but not yet in the docs

(none)
