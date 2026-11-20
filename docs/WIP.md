# WIP — Phase 8.6: Learn & Practice

## Context
Phase 8.6 gives each course its own Learn / Practice / Exam prep flows (spec: SESSION_NOTES §C, §D, §J, §K; PROMPTS §6–§7; DESIGN §7–§10; BUILD_PLAN §10 row 8.6, §5.1 rows ideaUnit/listN, §6.3). Step 0 (this plan) is done and approved; Q1–Q18 are answered (section "Decisions" below, also in the BUILD_PLAN Decisions log as rows "Phase 8.6 Qn").

## Checkpoint log
| date | phase | step | model | done | files | next | commit |
|---|---|---|---|---|---|---|---|
| 2026-11-16 | 8.6 | 0 plan | Opus | WIP plan; Q1–Q18 answered into the Decisions log; SESSION_NOTES §I point | 3 | Step 1 (interface + data) | 97e8a91 |
| 2026-11-16 | 8.6 | 1 interface | Opus | Mode `practice`, 5 kinds, Settings sounds/music, kv `studyScope`, DATA_MODEL; stubs: idea-unit, list-grading, hint, scope, learn-flow, practice, exercise-build-list, exercise-check-units; IdeaUnitSpec/ListSpec; verdict `verdictKind`/`weight` | 20 | Step 2: launch spec-test-writer with the brief in "Agents" | f90ccd0 |
| 2026-11-16 | 8.6 | 2 spec tests | Opus + Sonnet agent | 204 spec tests (10 files); 11 SPEC-GAPs into the Decisions log | 2 (+10 untracked tests) | Step 3: replay/criterion/FSRS hinted + practice rules, matching weight (make `replay-hinted.test.ts` green) | NOT COMMITTED (user, 2026-11-16): docs staged, tests untracked; commit everything together once the spec tests pass (the hook runs all untracked tests, so no commit can land before that) |
| 2026-11-16 | 8.6 | 3 replay/criterion/FSRS | Opus | `isRated`/`isCounting` (hinted never counts, opens the session's FSRS review rated Hard via `ratingFor(..., hinted)`); replay + criterionHistory skip practice; matching = recognition (`WEIGHT_OF_KIND`); 2 old tests moved from matching to hotspot; 2 Decisions log rows. replay-hinted 24/24, all 1889 + sim 12 green | 7 (+replay-hinted test) | Step 4: idea-unit, list kinds, hint (make `idea-unit`, `list-grading`, `hint`, `exercise-build-list` tests green) | NOT COMMITTED (same reason as step 2: the other 9 untracked spec-test files still fail, so the hook blocks any commit) |
| 2026-11-20 | 8.6 | 4 idea-unit/list/hint | Opus | `idea-unit`, `list-grading`, `hint`, `exercise-build-list`, `exercise-check-units` implemented (96 spec tests green); cardgen: list facts on `listPath`, key-word facts `fwd` = `mc → ideaUnit`; `refreshCardPaths` + kv `cardPathsVersion` + `CARD_PATHS_VERSION` (DATA_MODEL rows), wired via `ensureCardPaths()` from Home; `path-refresh.test.ts` (IDs, events, FSRS unchanged); 4 Decisions log rows. 1991 unit + sim green, check 0 errors | 14 (+2 tests) | Step 5: learn-flow, scope, practice + count rounds (make `scope`, `learn-flow*`, `practice` tests green; launch spec-test-writer for `round-count.test.ts`) | NOT COMMITTED (same reason as steps 2–3: the 5 step-5 spec files still fail, so the hook blocks any commit) |
| 2026-11-20 | 8.6 | 5 learn-flow/scope/practice/count rounds | Opus + Sonnet agent | `scope`, `practice`, `learn-flow` implemented (84 spec tests); count rounds (`SessionSnapshot.roundBy`, DATA_MODEL §3.7; `round-count.test.ts` 31 tests by agent); 2 Decisions log rows; steps 2–5 committed together; 2106 tests green | ~45 | Step 6: services (split study-service and course-plan-service first) | 99480ab |
| 2026-11-20 | 8.6 | 6 services | Opus | Split study/course-plan services; hint + `hinted`/verdict weight/kind through StudyService (queue `hinted`); ScopeService + scoped Exam prep/planner data; PracticeService (deck, quick quiz, summary; `queueWeight`); LearnService (topics, flow screens, startStep, look-back); wiring; 2135 tests green | ~30 | Step 7: components (IdeaUnitExercise, ListExercise, HintLink, MeetTerms, Reader, FlashcardDeck, ScopePicker, disabled ModeDoor, /dev/ui snapshots) | 1307bb3, 63ffe03 |
| 2026-11-20 | 8.6 | 7 components | Opus | IdeaUnitExercise, ListExercise (+ dispatch, choose `remove` hint, TapChip `revealed`), HintLink, MeetTerms, Reader (container-query columns), FlashcardDeck, ScopePicker, disabled ModeDoor (+ 2×2 row); 5 pure helpers + 17 unit tests; `/dev/ui` Study flow section; `visual.spec.ts` snapshots (9 sections). 2152 unit green, layout 14/14, visual 10/10 twice | 31 | Step 8: screens (course page pick-then-mode, `/course/[id]/learn`, `/course/[id]/exam`; wire HintLink + `checkMeta` into the study page) | 58d4168 |
| 2026-11-20 | 8.6 | 8 screens (Learn, scope, Exam prep) | Opus | Course page pick-then-mode (ScopeSheet, 4 doors, TopicList), `/course/[id]/exam`, `/course/[id]/learn` (LearnStep, AddedReview, learn-nav), HintLink + Check meta + `unit=learn` on the study page; Home sample-seed race fixed; e2e learn 2/2, scope 2/2, layout 16/16, modes/planner/cards/session/course-map green; 2157 unit green | 35 | Step 9: `/course/[id]/practice` (flashcards + quick quiz) and point the Practice door at it | 6e9dce7 |
| 2026-11-20 | 8.6 | 9 Practice screen | Opus | `/course/[id]/practice`: menu, flashcard deck (PracticeDeck: "Still learning" cards go round again, nothing logged), quick quiz on `/study?unit=learn` back to `?quiz=<id>` summary (QuizResult: right first time + misses); Practice door opens it (card count, no dot; `review` door action removed); e2e `practice.spec.ts` (deck logs nothing, quiz reviews `practice`/uncredited, scheduling fields unchanged) + layout test; practice/learn/scope/course-map/modes 10/10, layout 18/18, 2157 unit green | 9 | Step 10: Settings, Shelf, Welcome/Home | ca5d072 |

## What already exists (reuse; don't rebuild)
- **Event fields:** `ReviewEvent.hinted` and `verdictKind: 'exact'|'fuzzy'|'ideaUnit'|'listN'` are in `db/schemas/event.ts:43-46` and DATA_MODEL. Nothing reads them yet. The spec is BUILD_PLAN §5.1 rows `ideaUnit`/`listN` and §6.3 (a hinted answer never counts toward the criterion; a hinted correct is rated Hard).
- **Key words and lists:** the parser stores `payload.keyWords` and `payload.list: true` (`import/key-words.ts`, `build-drafts.ts`). `cardgen.factCards` already makes **no reverse card** for a list fact (D4/D5 FIX done). `note-edit.ts` edits keyWords. No exercise builder reads keyWords yet.
- **Exercises already built:** `matching` (`buildMatching`, `MATCHING_PAIRS = 4`, weight currently `none`), `sequence`/`parsons` (arrange), compare `cell:r:c` typed fill, fact `rev` typed definition → term, `flip` (`SelfRateExercise`), `multiSelect`/`oddOneOut` for compare notes only, `whichOne`, `fadeStep`. Exercise components are in `src/lib/exercises/` and are dispatched by `spec.shape`.
- **Hints:** only the first letter (`TypeSpec.letter`, `firstLetterType`). `Flashcard.svelte` has a local first-3-words hint (style guide only).
- **Learn today:** the acquisition engine (`engine/acquisition.ts`: `topicUnits` one unit per section, `unitSteps` pretrain → pretest → read → quiz, `unitCost`), `course-learn.ts`, `CoursePlanService.learnUnit/startLearnStep/finishQuiz`, and the route `/learn/[courseId]/[unitKey]` (step per `?step=N`, runs `/study` sessions, answers logged `credited: false` with mode `acquisition`, which triggers the next-day handoff in replay).
- **Data for the reader:** `Topic.summary`, `Chunk.title/text/words/tip/source/added/priority` (`db/schemas/course.ts`). `Course.map` holds bigpicture, habit, topics/sections, links, cheat, missing and next, shown by `CourseMapPanel`. No key-term or trap fields on chunks.
- **Sessions and rounds:** `SessionService`/`StudyService` (`startCourse` accepts `cardIds`, the only narrowing hook), rounds in `engine/round.ts` (`ROUND_WORKING_SET 8`, `ROUND_MAX_ANSWERS 40`, `ROUND_MAX_MINUTES 8`), `PRACTICE_SESSION_CARDS = 20`.
- **UI already built (reskin):** Hero, SectionHeading, ModeDoor/ModeDoorRow, Stamp, TrapAside, KeyTerm, PawTrail, PawRing, ReadinessMeter, Flashcard, CardFly, ChecklistRow, Toggle, Sheet, EmptyState, Yuki (5 states), Screen/TopBar/BottomNav/Sidebar. Course-page doors are shortcuts (`ui/course-map/doors.ts`).
- **Home:** a "Welcome." hero with "Import your first lecture". The sample course is seeded silently on the first run (`services/sample-course.ts`, kv `sampleCourseSeeded`).
- **Settings:** `SettingsSchema` (kv) has theme, companion, companionName, haptics and more, but no sound or music fields. There is no `/settings` or `/courses` route. Shelf = `/#shelf`.
- **Manual creation:** only the course-name form on `/import`. `NoteEditor.svelte` and `note-edit.ts` edit existing notes of every type except diagram and occlusion.
- **Missing entirely:** scope selection, a Practice mode (`ModeSchema` is `acquisition|cram|longterm|onenight`), any audio code, look-back, summary or tip display, and ideaUnit/listN builders and grading.
- **Size watch:** `study-service.ts` (352 lines) and `course-plan-service.ts` (325) must be split before anything is added to them.

## Steps (each ends at a checkpoint: commit, WIP row, CHECKPOINT line, stop)
Test tiers follow CLAUDE.md rule 13: unit tests on every commit; at component steps, `layout.spec.ts` plus snapshots; at screen steps, the changed screens' e2e specs (after `npm run build:test`); full `verify` only in step 12.

**1. Interface + data (checkpoint a). DONE** (stubs and signatures as committed; read the JSDoc of each stub, it is the spec the tests target). All stored-field changes go in one commit (rule 19):
- `ModeSchema` gains `practice` (per Q4).
- `ExerciseKindSchema` gains `ideaUnit`, `listAll`, `listN`, `listPick`, `listNot` (per Q9).
- `SettingsSchema` gains `sounds`, `music` (Q11; `music` defaults off, its toggle stays hidden until Phase 10).
- New kv `studyScope` (Q12).
- DATA_MODEL rows for all of the above. No Dexie index change, so no migration.

Engine stubs (`throw new Error('not implemented')`):
- `engine/scope.ts`: `inScope`, `scopeCards`
- `engine/idea-unit.ts`: `matchKeyWords`, `gradeIdeaUnit`
- `engine/list-grading.ts`: `gradeListAll`, `gradeListN`, `listRequired`
- `engine/hint.ts`: `microHint`
- `engine/learn-flow.ts`: `topicFlow` (summary → per section [meet terms → read+tip → questions → look-back] → mixed quiz → added section → summary), `pickLookBack`, `sectionQuestions`
- `engine/practice.ts`: `practiceDeck`, `quickQuizKinds`
- Exercise spec types for the new kinds.

Config is added to `defaults.ts` (`LEARN_SECTION_QUESTIONS`, `LOOKBACK_MIN_DISTANCE`, `LEARN_ROUND_CARDS`, `MEET_TERMS_MAX`, `LIST_N_SHARE`, `HINT_WORDS`, `HINT_LETTERS`). About 14 files.

**2. Spec tests (checkpoint b). DONE** — 204 tests in 10 files (learn-flow split into `learn-flow`, `learn-flow-topic`, `learn-flow-lookback`). Stub tests fail with "not implemented"; `replay-hinted` has 16 real failures (matching weight, hinted criterion, hinted = Hard, practice skipped) and 8 passing guards. 11 SPEC-GAPs accepted as the agent read them → Decisions log rows "Phase 8.6 SPEC-GAP (…)". **The 10 test files are untracked on purpose** (the pre-commit `vitest --changed` blocks failing tests; CLAUDE.md trap): commit `replay-hinted.test.ts` with step 3, the rest with steps 4–5 as each module turns green. Do not delete them. `spec-test-writer` (Sonnet) writes tests for:
- the grading modules (idea-unit, list, hint) against BUILD_PLAN §5.1, SESSION_NOTES D3/D4/J
- `learn-flow` + `pickLookBack` against §C and PROMPTS §6 rows @summary/@section/@tip
- the replay/criterion hinted + practice rules against §6.3 and §J
- `scope`

I resolve SPEC-GAPs into the Decisions log. Settings and scope schema tests I write directly.

**3. Engine: replay/criterion/FSRS (checkpoint c). DONE (uncommitted).** `hinted` never counts and a hinted correct is rated Hard (`criterion.ts`, `criterion-history.ts`, `replay-card.ts`, `fsrs.ts ratingFor`). Practice events are skipped by replay (Q4). Matching weight changes per Q5. Spec tests turn green. A sim rerun confirms no plan drift.

**4. Engine: idea-unit, list kinds, hint (checkpoint c). DONE (uncommitted).**
- Builders: new `exercise-build-list.ts`, idea-unit in `exercise-build-text.ts`.
- `checkResponse` sets `verdictKind`.
- `cardgen`: path for list facts and for facts with key words.
- One-time path refresh of stored cards through `planCardRegen`, so IDs are kept (rule 7).
- Distractors for list pick/NOT come from other lists' items in the course.
- **Required test (user):** import a course, log reviews, run the path refresh, then check that card IDs, every review event and FSRS state are unchanged (`tests/unit/services/path-refresh.test.ts`).

**5. Engine: learn-flow, scope, practice + count rounds (checkpoint c). DONE.**
- DONE: `scope.ts`, `practice.ts`, `learn-flow.ts` implemented; their 84 spec tests green. Decisions row "SPEC-GAP (quick quiz skips warm-up kinds)".
- DONE: count-round interface: `RoundBySchema`, `SessionSnapshot.roundBy?` (DATA_MODEL §3.7 row), `PlanInput.roundBy?`, JSDoc of `planSession`/`checkRoundEnd`/`startRound`; Decisions row "step 5: count rounds". Behaviour not implemented yet.
- DONE: spec-test-writer wrote `round-count.test.ts` (31 tests; no SPEC-GAPs; its 6 readings match the Decisions row and are accepted). Count rounds implemented (`roundWorkingSet` in `round.ts`, used by `planSession`/`startRound`). 2106 tests green.
- DONE: steps 2–5 committed together (see Checkpoint log).
- `round.ts`/`session.ts` get a `roundBy: 'count'` option (no minutes, `LEARN_ROUND_CARDS ≈ 20`) for Learn and Practice.
- `spec-test-writer` adds tests for the round option, because the session engine is a risky module.

**6. Services (checkpoint c).**
- Split `study-service.ts` and `course-plan-service.ts` first.
- `ScopeService` (kv `studyScope`).
- `LearnService` (topic flow, section steps, look-back picks, logs per Q3).
- `PracticeService` (flashcard deck + quick quiz, mode `practice`, flip not logged).
- `hinted` through `StudyService.submit`.
- Exam prep: `loadCourseData`/`CoursePlanService` filter by scope (Q12).
- Unit tests written directly (plumbing).
- Step-6 plan (2026-11-20), in order, each item ticked when done:
  - [x] 6a split (as built): `study-answer.ts` (creditedIn, missedTypedIn, selfRatedOf, Shown, answerOf), `study-item.ts` (cardExercise), `study-plan-types.ts` (StartOptions, PlannedCard, PlannedSession + roundBy; re-exported from study-service); `course-plan-parts.ts` (Loaded, cramView, reviewPlan, stepViews). Pure moves.
  - [x] 6b hinted + verdict into events: `StudyService.hint(id)` → `microHint` (rng `rngFor(cardId, sessionId, attempt)`), one per attempt; `AnswerInput` gains `hinted`, `weight`, `verdictKind`; event weight = `verdict.weight ?? weightOf(kind)`. Engine: `QueueAnswer.hinted` (a hinted correct neither adds nor resets the count and skips the first-ever reduction), with queue unit tests. `credited` false for `acquisition` and `practice`. `PlannedSession.roundBy` → `StartSessionInput.roundBy` → `planSession`. Tests: `tests/unit/engine/queue-hinted.test.ts`, `tests/unit/services/study-hint.test.ts` (shared stack in `tests/unit/services/study-fixtures.ts`).
  - [x] 6c scope: `ScopeService` (get/set/clear/summary/tree) on kv `studyScope`; `loadCourseData(…, scope?)` filters notes/cards/chunks/topics (`course-scope.ts`); CoursePlanService and PlannerService pass the course's scope.
  - [x] 6d `PracticeService` (as built): `deck` (flip specs of in-scope cards), `nextPass`, `startQuiz` (mode `practice`, `roundBy: 'count'`, kinds from `quickQuiz`, required 1), `quizSummary(sessionId)` (asked, right, missed via `missesToRetry`). No `retryMisses`: see the decision below.
  - [x] 6e `LearnService` (`learn-service.ts`, `learn-material.ts`, `learn-types.ts`; screens carry `session: true|false`): `topics`, `flow(courseId, topicId)` (step views with summary/terms/reader data), `startStep(courseId, topicId, index)` (questions, meetTerms matching check, lookBack via `pickLookBack`, mixedQuiz; mode `acquisition`, `credited: false`, `roundBy: 'count'`, plannedMinutes 0).
  - [x] 6f wiring done (`study-wiring.ts`: scopeService, learnService, practiceService; `MicroHint` re-exported from study-types); full `npm run test` 2135 green.

**7. Components (component checkpoint).** All built with tokens only, each added to `/dev/ui` in both themes:
- `IdeaUnitExercise` (type, then tick key words, pre-ticked)
- `ListExercise` (type all / N of M typed / tap-pick with "Check · N picked" meta and "LIST CARD" stamp / select all / which is NOT)
- a `HintLink` on every exercise
- `MeetTerms` (3–4 term cards + matching check)
- `Reader` (KeyTerm underlines from section terms, tip aside, 3-column desktop at ≥1024)
- `FlashcardDeck` (CardFly, Still learning / Know it, keyboard Space/←/→/H, desktop deck panel)
- `ScopePicker` (ChecklistRow topics → sections, "Study all" default)
- ModeDoor disabled variant (Play + "Coming soon · Phase 11" stamp)
- `/dev/ui` visual-regression snapshots (the item deferred from the reskin).

Tests: unit + `layout.spec.ts` + snapshots.
- Step-7 plan (2026-11-20), each ticked when done:
  - [x] 7a pure helpers + 17 unit tests (`tests/unit/ui/phase86-ui-helpers.test.ts`): `services/exercise-helpers.ts` `preTickedKeyWords` (UI can't import the engine), `exercises/exercise-ui.ts` `hintLabel(shape)`/`checkMeta(response)`, `ui/reader/mark-terms.ts` `markSection`, `ui/scope/scope-selection.ts` (picks = section ids, or topic id for a section-less topic; `toScope` → whole = empty lists, null = nothing), `ui/flashcards/deck-state.ts` (`startDeck`/`rateCard`/`deckKey`). `IdeaUnitSpec`/`ListSpec` re-exported from study-types.
  - [x] 7b exercises: `IdeaUnitExercise` (type → "Next" → definition shown + key-word TapChips pre-ticked), `ListExercise` (type rows / pick chips + "List card" stamp + n/N), dispatch in `Exercise.svelte`, `hint` prop (choose hides the removed option), TapChip `revealed` state.
  - [x] 7c `HintLink`, `MeetTerms`, `Reader`, `FlashcardDeck` (+ Flashcard `hinted` bindable), `ScopePicker`, ModeDoor `disabled` + stamp.
  - [x] 7d `/dev/ui` guide section "Phase 8.6 components"; `tests/e2e/visual.spec.ts` (`toHaveScreenshot` per guide section, mobile); CI `updateSnapshots: 'missing'` (baselines are per OS: win32 committed, Linux written on CI). Needs a Decisions log row at handoff.
  - [x] 7e `npm run check`, unit, `npm run build:test`, `layout.spec.ts` + `visual.spec.ts`; commit; checkpoint.
- Wiring into screens (HintLink + `checkMeta` on the study page, deck/scope/reader routes) is steps 8–9.
- Step-7 notes (not yet in the docs; Decisions log rows at handoff):
  - Reader goes three-column by a **container query** at 900 px of its own width (not the 1024 px window media query): beside the 260 px Sidebar a 1280 px window leaves ~1020 px, and the style-guide panes are narrower. `FlashcardDeck` keeps the 1024 px media query (its columns have 0 minimums, no overflow).
  - `ModeDoorRow` with 4 doors is 2 × 2 below 768 px (`:has(> :global(:nth-child(4)))`); a disabled door's stamp wraps.
  - Visual snapshots: `tests/e2e/visual.spec.ts`, one full-page shot clipped to each guide section from scroll 0 (element shots shifted text by a sub-pixel between runs), `maxDiffPixelRatio 0.002`, CI `updateSnapshots: 'missing'`. Refresh after deliberate visual changes with `npx playwright test visual --project=mobile --update-snapshots`. Rule: every new guide section id must be added to its `SECTIONS` list (a test checks).
  - `FlashcardDeck` takes plain `{ key, term, answer }` cards (the page maps `DeckCard`'s selfRate spec: prompt → term, answer); `keyboard={false}` where several decks share a page. Flashcard's hint now uses `HINT_WORDS`.
  - IdeaUnit stage 1 has its own "Next: tick the key words" button (response stays null, so the page's Check is disabled until the ticking stage).

**8. Screens: pick → Learn, Exam prep wiring (screen checkpoint).**
- Course page: doors become pick-then-mode (scope picker → Learn / Practice / Exam prep / Play disabled), and the topics list gets PawRings and "N topics · N sections".
- New route `/course/[id]/learn` (Q2).
- `/course/[id]/exam` collects the existing exam/plan cards and respects the scope (no logic change).
- e2e: `learn.spec.ts`, `scope.spec.ts`, `@both` layout rows.
- Step-8 plan (2026-11-20), each ticked when done:
  - [x] 8a services: `LearnTopicView` gains `read` + `outline` (sections with `read`), `AddedSectionView` gains `notes` (`titleOf`); test in `learn-service.test.ts`.
  - [x] 8b doors (`ui/course-map/doors.ts`): `courseDoors(today, topics)` → Learn (`/course/[id]/learn`, "N sections to read"), Practice (today's review if due, else Exam prep; its own screen in step 9), Exam prep (`/course/[id]/exam`), Play disabled. `doors.test.ts` rewritten.
  - [x] 8c course page: hero "Course · N topics · N sections", `ScopeSheet.svelte` ("Studying N of M topics · change" + Sheet + ScopePicker + Save), 4 doors, `TopicList.svelte` (ChecklistRow + PawRings, "N of M read", first unread = current; tap → Learn topic), cards, undo import, course map.
  - [x] 8d `/course/[id]/exam`: plan cards, status counts, split prompts, Yuki line, sleep reminder (`?done=`), exam form, "Planning N of M topics" when scoped. `ExamForm`/`PlanCards` moved there. `/learn/[courseId]/[unitKey]` links go back to Exam prep ("Back to Exam prep").
  - [x] 8e `/course/[id]/learn` (`?topic=&step=`): topic picker (TopicList), `LearnStep.svelte` per screen, `AddedReview.svelte` (keep/delete per note via `cardListService.deleteNote`), "Topic done" with next topic; pure `ui/learn/learn-nav.ts` + `tests/unit/ui/learn-nav.test.ts`.
  - [x] 8f study page: HintLink (label from `hintLabel`, `studyService.hint`, `hint` passed to Exercise), Check meta `checkMeta`, `unit=learn` (no session summary, count rounds still pause); feedback moved to `AnswerFeedback.svelte` (300-line limit).
  - [x] 8g e2e: `learn.spec.ts`, `scope.spec.ts`, shared `learn-course.ts`; `play-session.ts` answers `ideaUnit`/`list`; modes/planner helpers go through the Exam prep door; layout `@both` row "course doors, scope sheet and the Learn reader fit".
  - [x] 8h e2e: learn 2/2, scope 2/2, modes/planner/cards/session green, course-map fixed (see note), layout 16/16 on both; commit; checkpoint.
- Step-8 notes (Decisions log rows at handoff):
  - The course page no longer shows today's plan or the exam form; they moved to `/course/[id]/exam` (Exam prep door). Home's "Plan and learn" still opens the course page.
  - Learn session steps start straight from the previous screen's button (e.g. "Done reading" → questions); landing on a session screen by URL shows a short intro with Start. Meet the terms always shows its terms first. A step with nothing to ask (no look-back candidate yet) is skipped.
  - `/study?unit=learn`: like `unit=1` (straight back, no session summary) but the count round's summary still shows (Q16 "keep going / break").
  - Bug found by `course-map.spec` (from step 4): Home's refresh, slowed by `ensureCardPaths()`, listed the sample course after `createCourse` but before its commit; a reload then cut the seed off and the next start saw "has courses", leaving the sample empty. Fix: Home awaits `ensureSampleCourse()` before planning (first run shows the loader a few seconds longer). Step 10 (Q17: sample only on tap) replaces this flow.
  - Layout row for Learn has `test.setTimeout(90_000)` (import + four screens). `learn`/`scope` import-page timeouts under 2 workers logged in UNVERIFIED_TESTS.md.
  - The look-back stamp from the mockup (04-question-lookback) is not on the study screen yet (the study page doesn't know the step); possible later polish.

**9. Screen: Practice (screen checkpoint). DONE.** `/course/[id]/practice`: flashcards + quick quiz, no timer, round pause at about 20. e2e `practice.spec.ts`, which also checks that FSRS fields are unchanged.

**10. Settings, Shelf, Welcome/Home (screen checkpoint).**
- `/settings`: theme labelled "Lamp-light", companion, haptics, sounds, spelling mode (music toggle hidden until Phase 10).
- `/courses` (Shelf): BottomNav and Sidebar point there, plus a settings entry in TopBar.
- Welcome: Yuki, 3-step how-it-works, primary "Try a sample course", then "Bring my lectures", then "Make cards by hand" (Q17).
- Home: where-you-left-off, date stamp, gentle suggestion, no streak copy.
- e2e: `home.spec.ts`, `settings.spec.ts`, layout rows.
- Step-10 plan (2026-11-20), each ticked when done:
  - [x] 10a services: `SettingsService` (`settings-service.ts`: get/update on kv `settings`, zod-checked; wired in `preferences-wiring.ts` so the shell stays small); `HomeService` (`home-service.ts`: `leftOff()` = latest review event's course/topic/mode → Learn topic / Practice / Exam prep link + sections read; `shelf()` = per course topics, sections, read); sample on tap (`addSampleCourse()` in import-wiring replaces `ensureSampleCourse`; `seedSampleCourse` no longer skips on the flag, refuses when courses exist; flag still set); pure `ui/home/home-text.ts` (`dateStamp`, `examLine`, `workLine`, `suggestionOf`). Unit tests for each.
  - [x] 10b `/courses` Shelf (today's per-course cards move here from Home: minutes, readiness, Start review, open, delete); `nav-hrefs` shelf → `/courses`; settings gear in TopBar trailing on Home and Shelf.
  - [x] 10c `/settings`: theme Segmented (Follow system / Light / Lamp-light / Auto night), companion (Full / Quiet / Off), haptics, sounds, spelling (Forgiving typos / First letter); saves at once, updates `prefs` live; music toggle hidden.
  - [x] 10d Home: Welcome when no courses (Yuki, 3 steps, "Try a sample course" → seeds → course page; "Bring my lectures" → /import; "Make cards by hand" → /import for now, step 11 repoints it to `/course/new`); Den: date stamp, "Welcome back.", where-you-left-off card (Continue), gentle suggestion (Yuki + "Only if you fancy it…" Let's go / Not tonight), shortfall note, compact shelf rows; no streak copy. Home no longer awaits a seed (step-8 race note is moot).
  - [x] 10e e2e: `home.spec.ts` (welcome → sample → course page; left-off after a Learn answer), `settings.spec.ts` (Lamp-light + sounds off survive reload), layout `@both` rows; update `course-map`, `planner`, `modes`, `import` specs for the new Home/Shelf. Build, run, commit, checkpoint.

**11. Sounds + Manual mode (screen checkpoint).**
- `ui/delight/sound.ts`: Web Audio synth for the 4 effects only (Q11; no music), gated by the pure `soundAllowed(context, prefs)` (never on reading screens), with unit tests.
- **Sound toggle must be easy to find (user, 2026-11-16):** a speaker icon button in the study/practice TopBar (one tap mutes or unmutes, `aria-pressed`, label "Sounds on"/"Sounds off", 48 px target) writes `Settings.sounds` straight away, plus the labelled Sounds row in `/settings`. Both save to kv, so the choice holds on reload and next visit. e2e: mute in a session, reload, still muted; the Settings row shows off.
- Manual: `/course/new` and `/course/[id]/add` forms for course, topic, section and every non-image card type, reusing `note-edit.ts`, `NoteEditor`, repos and `writeBatch` through a `ManualContentService`. The list-fact form has items and the key-word tick.
- e2e `manual.spec.ts`.

**12. Verify (checkpoint d).** `npm run build:test` then `npm run verify`. Timeouts that pass on a rerun go into UNVERIFIED_TESTS.md.

**13. Review (checkpoint e).** `reviewer` (Sonnet), fresh session, diff since the step-0 commit, spec sections as above, `test-results/summary.md`. Fix blockers.

**14. Handoff + PROGRESS (checkpoint f).** HANDOFF current state and patterns, Decisions log rows, PROGRESS entry, BUILD_PLAN phase table, delete WIP.md. Push only after you confirm.

## Not yet in the docs (decided while building)
- Step 1: `Settings.sounds` defaults to **on** (like `haptics`); both new settings fields use zod `.default()` so settings stored before 8.6 still parse. Tell the user at the step-1 checkpoint.
- Step 1: `exercise-check.ts` `verdictOf` is now a per-shape checker table (lint complexity); `checkIdeaUnit`/`checkList` live in `exercise-check-units.ts`.
- Step 1: `Exercise.svelte` renders nothing yet for the `ideaUnit` and `list` shapes (no builder produces them until step 4); step 7 adds `IdeaUnitExercise` and `ListExercise` there.
- Stub names as built (they replace the names in the step-1 bullet above): `scope.ts` `isWholeCourse`, `inScope`, `scopeItems`, `scopeSummary`; `learn-flow.ts` `learnOrder`, `meetTerms`, `sectionQuestions`, `topicFlow`, `pickLookBack`; `practice.ts` `quickQuiz`, `missesToRetry`, `nextDeckPass`; `list-grading.ts` `listRequired`, `listPath`, `gradeListTyped`, `gradeListPicked`; `idea-unit.ts` `matchKeyWords`, `gradeIdeaUnit`; `hint.ts` `microHint`; `exercise-build-list.ts` `buildIdeaUnit`, `buildListTyped`, `buildListPick`, `buildListNot`.

- Step 4: `checkResponse` returns `verdictKind` and (idea unit) `weight: 'recognition'`, but `SessionService` still logs `weight: weightOf(kind)` and no `verdictKind`; step 6 must pass the verdict's `weight ?? weightOf(kind)` and `verdictKind` (plus `hinted`) into the event.
- Step 4: `ensureCardPaths()` (study-wiring) runs from Home's `refresh()` only; a study route opened directly before Home keeps the old (still valid) paths until the next Home visit.

- Step 6: a typed answer accepted through a typo match (`verdict.typo`, correct) is logged `verdictKind: 'fuzzy'`; idea-unit/list verdicts log their own kind; exact = absent (DATA_MODEL §3.6 row).
- Step 6: new pure engine rule `practice.ts queueWeight(mode, weight)`: in Practice a `recognition` correct counts as `full` in the session queue (the queue otherwise needs a full-weight correct last, so an mc-only quick quiz never ended). Events keep the real weight; replay skips practice anyway. Tests: `tests/unit/engine/practice-queue.test.ts`. Needs a Decisions log row at handoff.
- Step 6: Q18 "misses back once at round end" is served by the queue: a missed quiz card goes to redo-till-right, then comes back after `ERROR_LAG` and one correct finishes it (required 1). `quizSummary` lists the misses at the end. Needs a Decisions log row.
- Step 6: Meet the terms' matching check = one session card (the first term note's first card) forced to `matching`, `required: ACQ_STEP_REQUIRED`. Learn steps use `ACQ_STEP_REQUIRED` (1) per card.
- Step 6: Learn under a scope uses only in-scope sections (Learn order and look-back distance are over the scoped sections). Look-back rng = `rngFor(chunkId, 'lookback:<event count>', 0)`.
- Step 6: "sections the student has read in Learn" (Q8) is derived from events, no stored field: a section counts as read once any of its cards has a review event with mode `acquisition`. Learn's questions follow the reading, so a section read this visit with cards is already counted when its look-back runs; a section without cards has no look-back candidates anyway.
- Step 9: the Practice door now always opens `/course/[id]/practice` (hint = in-scope card count, never the has-work dot); it no longer starts today's review, which lives in Exam prep. `doors.ts` `DoorAction` `review` is gone. Needs a Decisions log row at handoff.
- Step 10: Home no longer shows the per-course plan cards (minutes, readiness, Start review, delete); they moved to the Shelf `/courses` ("Open course" replaces "Plan and learn"). Home shows compact shelf rows (name, "N topics · N of M read") and "All courses and plans". e2e helpers in `modes`/`planner` now open courses from `/courses`. Needs a Decisions log row at handoff.
- Step 10: "Where you left off" is derived from the latest review event (no stored field): its card's course and topic, mode `acquisition` → Learn topic (`?topic=`), `practice` → Practice, others → Exam prep (`home-service.ts leftOffMode`). Needs a Decisions log row.
- Step 10: the gentle suggestion is the course with the most due cards ("Only if you fancy it: N <course> cards to review."); "Let's go" starts today's review, "Not tonight" hides it for this visit only (not stored). None when today's minutes are used up (Yuki says rest instead).
- Step 10: Q17 as built: `seedSampleCourse` no longer reads the flag; it adds the sample whenever there are no courses (so a deleted sample can be added again from Welcome) and sets `sampleCourseSeeded` as a record. DATA_MODEL row updated. `ensureSampleCourse` → `addSampleCourse()` (returns the course id; Welcome opens the course page).
- Step 10: Settings theme is a Select (four labels don't fit a Segmented at 360 px): "Follow the system", "Light (cabin)", "Lamp-light (dark)", "Lamp-light near bedtime" (auto-night). Spelling: "Type them" / "Word bank" (firstLetter mode turns blanks into a first-letter word bank). Settings shows the Sidebar/BottomNav with Den active. `Toggle` gained an `onchange` prop. `DisplayPrefs` gained `sounds` (for step 11's gate and mute button).
- Step 10: Welcome's "Make cards by hand" links to `/import` (course-name form) until step 11 repoints it to `/course/new`.

## Agents
| Step | Agent | Owns (writes only) | Brief |
|---|---|---|---|
| 2 | spec-test-writer (Sonnet) | `tests/unit/engine/{idea-unit,list-grading,hint,learn-flow,scope,practice,exercise-build-list,replay-hinted}.test.ts` | See the full brief below |
| 5 | spec-test-writer (Sonnet) | `tests/unit/engine/round-count.test.ts` | See "Step-5 brief" below |
| 13 | reviewer (Sonnet) | none | Phase 8.6, base = step-0 commit, specs above, summary.md |

### Step-2 brief (paste as the agent prompt)
> Phase 8.6, workflow step 2. Write unit tests (Vitest, `fast-check` where a property helps; fixtures in `tests/unit/engine/fixtures.ts`) for these stubbed modules, from their JSDoc and the spec only. Never read function bodies (they throw). Modules: `src/lib/engine/idea-unit.ts`, `list-grading.ts`, `hint.ts`, `scope.ts`, `learn-flow.ts`, `practice.ts`, `exercise-build-list.ts` + `exercise-check-units.ts` (through `buildExercise`/`checkResponse` in `exercise-spec.ts`/`exercise-check.ts`), and the replay rules not yet implemented: a review with `hinted: true` never counts toward the criterion and, if correct and the session's first attempt, is rated Hard for FSRS (`engine/replay-card.ts`, `criterion-history.ts`, `fsrs.ts ratingFor`); review events with mode `practice` are skipped entirely by replay (no FSRS, criterion, study day, acquisition handoff, accuracy or pathStep); `matching` answers carry weight `recognition` (`exercise-kinds.ts weightOf`), while `pretest` and `hotspot` stay `none`. Read only: BUILD_PLAN §5.1 rows `ideaUnit`, `listN`, `matching`; §6.2 rating map; §6.3; SESSION_NOTES §C, §D (D1–D5), §H, §J; PROMPTS §6; the BUILD_PLAN Decisions log rows starting "Phase 8.6"; `docs/WIP.md` section "Decisions"; config names in `src/lib/config/defaults.ts` (block "Phase 8.6"). Write to `tests/unit/engine/{idea-unit,list-grading,hint,learn-flow,scope,practice,exercise-build-list,replay-hinted}.test.ts` only. Report: test counts per file, and every `SPEC-GAP` (a case the spec doesn't settle) with the reading you chose.

### Step-5 brief (paste as the agent prompt)
> Phase 8.6, workflow step 2 for count rounds. Write `tests/unit/engine/round-count.test.ts` only (Vitest; reuse `tests/unit/engine/session-fixtures.ts` and the style of `tests/unit/engine/round.test.ts`, which you may read for fixtures, not for expected values). Behaviour comes from JSDoc and spec only, not from function bodies: `src/lib/engine/round.ts` (`checkRoundEnd`, `startRound`, `roundSummary`), `src/lib/engine/session.ts` `planSession` (its `PlanInput.roundBy` option), and `SessionSnapshot.roundBy` in `src/lib/db/schemas/session.ts`. Spec: BUILD_PLAN §6.4 (rounds); the BUILD_PLAN Decisions log rows "Phase 8.6 Q16" and "Phase 8.6 step 5: count rounds"; DATA_MODEL §3.7 row `snapshot`; config `LEARN_ROUND_CARDS`, `ROUND_WORKING_SET`, `ROUND_MAX_ANSWERS`, `ROUND_MAX_MINUTES` in `src/lib/config/defaults.ts`. Cover: planSession with `roundBy: 'count'` stores it and fills round 1 with up to `LEARN_ROUND_CARDS` cards (without it: `roundBy` absent, `ROUND_WORKING_SET`); a count round ends on all-done or at `LEARN_ROUND_CARDS` answers, never by minutes (even hours later) and not at `ROUND_MAX_ANSWERS` if that is lower; never while `clearing`; `startRound` keeps `roundBy` and fills to `LEARN_ROUND_CARDS`; clock rounds (absent `roundBy`, or `'clock'`) unchanged; a stored snapshot without `roundBy` parses with `SessionSnapshotSchema`. Report: test count and every `SPEC-GAP` with the reading you chose.

## Decisions (user, 2026-11-16; all in the BUILD_PLAN Decisions log as "Phase 8.6 Qn")
1. Idea-unit: correct only when every key word is ticked. If all ticks are the app's pre-ticks → recall (full); if the student ticked any → recognition (Hard). No key words → MC + typed definition → term only.
2. Learn door = new topic-level route `/course/[id]/learn`, no pretest. `/learn/[courseId]/[unitKey]` stays as Exam prep's planned learn steps, unchanged.
3. Learn answers: mode `acquisition`, `credited: false` (next-day handoff); no clock, no planner minutes.
4. Practice: `review` events with mode `practice`, `credited: false`; replay skips them entirely (no FSRS, criterion, handoff, accuracy, pathStep). Flip is not logged.
5. Matching weight = recognition when it is a card's own review; `pretest`, `hotspot` stay `none`.
6. Meet the terms: section `keyterm` notes, else non-list `@fact` notes, at most 4; example from a same-section `@scenario` whose answer is the term, else none; fewer than 2 terms → skip; then one matching check.
7. Section questions: 2 (1 if the section has ≤ 2 cards), recall formats first; the rest go to the end-of-topic mixed quiz, interleaved.
8. Look-back: from a section ≥ 2 back in the course's Learn order, **and only from sections the student has already read in Learn**; favour cards last answered wrong, then least recently seen; seeded RNG; none for the first two sections.
9. List kinds `listAll` (recall), `listN` (recall), `listPick` (recognition; select-all = N = M), `listNot` (recognition). N = ceil(M × 0.5), min 2; lists of ≤ 3 items → `listAll` only. Other J formats out of scope.
10. Micro hint: typed → first 2 letters of each word; lists and multi-word answers → first 3 words; choice → remove one wrong option. One per attempt; `hinted: true` logged.
11. Sound effects: Web Audio synth. **Music deferred to Phase 10**: the `music` setting field is added now (default off), its toggle hidden.
12. Scope stored per course (kv `studyScope`); Exam prep plans, triages and counts readiness on in-scope cards only; doors show "Studying N of M topics · change".
13. "Added by the chatbot": minimal. Learn shows `added` sections last as "Added by the chatbot, check these", with keep/delete per card via `CardListService`.
14. Reskin leftovers included as listed in steps 7, 8, 10; EXAM TRAP excluded (SESSION_NOTES §I: prompt v3 trap directive).
15. Manual mode: keyterm, fact (list + key words), cloze, sequence, compare, scenario, example; diagram/occlusion wait for Phase 6.
16. Learn and Practice rounds end after `LEARN_ROUND_CARDS` = 20 answered cards, no minutes; Exam prep rounds unchanged.
17. Sample course seeded only on tap; Welcome whenever there are no courses (supersedes the Decisions row "Default course").
18. Quick quiz: every in-scope card once, format rotated from its kinds (ignoring `pathStep`), misses back once at round end, summary at the end only.
19. Step 4 path refresh keeps card IDs and every review event; a test proves IDs, events and FSRS state are unchanged.

## Verification (end of phase)
`npm run test`, then `npm run build:test`, then `npm run verify` (unit + sim + e2e + coverage + bundle ≤ `SHELL_JS_BUDGET_KB`), then read `test-results/summary.md`. Manual check in `npm run preview`: pick 2 topics, then Learn (summary → meet terms → read → 2 questions → look-back → mixed quiz → summary), then Practice (flip deck, quick quiz, FSRS unchanged in the card list), then Exam prep shows only in-scope work; sounds silent on the reader; manual course created by hand and studied.
