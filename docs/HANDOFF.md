# Handoff — read this first in every new session

The working notes passed from one phase to the next. Unlike `PROGRESS.md` (a history that only grows), this file is **edited to stay current and short: under about 80 lines.** Remove what stops being true.

## Current state

- **Phase order (user, 2026-11-08): 5 → 7 → 8 → 8.5 → 6 → 9 → 10.** After Phase 5 comes Phase 7, not 6. **When Phase 8 is done, tell the user that Phase 8.5 (Cards & import fixes, BUILD_PLAN §10) is next, before starting anything else.** Before starting Phase 6, confirm with the user that 5, 7, 8 and 8.5 are done. Phase 6 also owns the image/zip import-prompt gaps (Decisions log).

- **Done:** Phases 0–5. **Next:** Phase 7 (Modes); see the phase order above. The `reviewer` (Sonnet, diff-only) runs once at the end of each of Phases 7, 8 and 9, and again only if it found blockers.
- **Exists:** tooling, CI, data layer, import (with `@end` and a plain-language preview), cardgen, grading, distractors, the engine core with full `replay()`, and from Phase 5: the design system in layers (DESIGN §13: tokens → themes → primitives → components incl. Yuki → delight → layout → exercises), the `/dev/ui` style guide, exercise specs and checks for every non-diagram kind (`engine/exercise-spec.ts`, `exercise-check.ts`, BUILD_PLAN §5.1), the exercise components (`src/lib/exercises`), `StudyService`, the study screen `/study/[sessionId]`, a placeholder Today (course list → Practise, trash a course), the restyled `/import`, and the dev harness `/dev/session`.
- **Not wired yet / partial:** Today is a placeholder until the planner (Phase 8). `StudyService.startCourse` runs a **practice** session (longterm, the first `PRACTICE_SESSION_CARDS` live non-diagram cards); Phase 7's modes replace that card choice and set `credited: false` for acquisition chunk quizzes. Off-path kinds (`pretest`, `matching`, `blurt`, `explainIt`, `multiSelect`, `categorize`, `oddOneOut`, `pickPrinciple`, `flip`) are built and graded, but only the harness shows them; Phase 7 decides when modes schedule them (via `StartOptions.forceKinds`-style plumbing or by extending `exerciseKindFor`). Diagram and occlusion kinds fall back (Phase 6). No Courses/Plan/Settings routes yet, so `BottomNav` isn't mounted. `relearningSessionsAhead` is still 0 (Phase 8). Deferred: `/dev/ui` visual-regression screenshots (DESIGN §13.4) and drag gestures (tap-to-place works everywhere).

## How data works here (reuse this; don't reinvent it)

| To do this | Use | Never |
| --- | --- | --- |
| Create or change content | `CourseRepo`, `TopicRepo`, `ChunkRepo`, `NoteRepo`, `CardRepo`, `MediaRepo` in `db/repos/content-repos.ts`, built on `ContentRepo` | Touch a Dexie table directly |
| Delete content | `repo.softDelete(id)`; reads already hide tombstones | Hard delete, except archive or replace import |
| Record study history | `EventRepo.append(fields)`; it adds `id`, `ts`, `deviceId`, `seq`. An answer plus its session snapshot: `appendWithSession` (one transaction) | Update or delete an event |
| Update card scheduling | Extend `replayCard()` in `engine/replay-card.ts`; `ReplayService.rebuildAll()` or `rebuildCards(ids)` stores the result via `CardRepo.applyReplay`. Criterion counting in both replay and planning goes through `recordCriterion` / `criterionHistory` in `engine/criterion-history.ts` (uses each event's `required`; derives it when absent) | Write `fsrs`, `due`, `status`, `fragile`, `weak`, `daysCorrect`, `pathStep` or `accuracy` anywhere else |
| Read or write settings | `KvRepo.get/set`, validated against `KV_SCHEMAS` | Touch `db.kv` directly |
| Write across several tables, all or nothing | Build records with `repo.draft` and `repo.draftChange`, then `ContentStore.writeBatch`, which is one transaction | Open a Dexie transaction around repository calls |
| Run a study session | `SessionService.start({ mode, courseIds, plannedMinutes, cards, confusionEvents })` with `cards` from `toPlanCard(card, noteType, cardEvents, { mode, relearningSessionsAhead })`; show `view.item` (`attempt` seeds `rngFor`, `firstAttempt: false` means redo-till-right, `count`/`required` feed the progress dots); `answer(id, { kind, correct, responseMs, credited, chosen?, chosenFromCardId? })` logs `required` on the event; when `view.round` is set the round ended: `continueRound(id, { afterBreak })` or `stop(id)`; `resume(id)` after a reload | Keep queue or round state in a component, append review events yourself, or force a break |
| Know what kind a card shows, and its weight | `currentKind(path, pathStep, accuracy)` (MC gating) and `weightOf(kind)` in `engine/exercise-kinds.ts` | Re-derive §3.3 groups or weights |
| Ask FSRS something | `retrievabilityAt(card.fsrs, t, config.fsrs)`; config from `kvReplayConfig(kv, tzOffset)` | Import `ts-fsrs` outside `engine/fsrs.ts` |
| Work out study days | `dayIndex` / `daysBetween` with the device's `tzOffsetMin` (minutes east of UTC) | `new Date().getHours()` in the engine |
| Get cards for a note | `generateCards(note).result` in `engine/cardgen.ts` | Hard-code variants or paths |
| Know what a card asks for | `cardAnswer(note, variant)` / `answerEntries(cards, notesById)` in `engine/answers.ts` | Derive answers from payloads in a screen |
| Judge a typed answer | `gradeTyped({ cardId, typed, answer, accepted, others })`; log `result.normalized` as `chosen` and `chosenFromCardId` when set. "I was right" → `checkAccept`, append `acceptAdded`, re-log as correct only if `passesGuard` | Compare strings yourself or skip the collision guard |
| Grade drag, order or rebuild | `hitTest`, `gradeSequence`, `gradeEdgeSet` in `engine/grading-shapes.ts` | |
| Build multiple choice or a first-letter bank | `pickDistractors` / `firstLetterBank` with `rngFor(cardId, sessionId, attempt)` | `Math.random`, or options from another answer kind |
| Import text | `ImportService`, which runs `parseImport`, `buildPlan` and `ImportBatchDrafter` | Call the pipeline from a screen |
| Give a screen a service | A `services/*-wiring.ts` module, imported only by that route, so its dependencies stay out of the shell | Add repos or zod to `services/app.ts` |
| Show and grade an exercise | `StudyService` (`study-wiring.ts`): `startCourse`/`open` give a `StudyView` whose `item.exercise` is a spec; render it with `exercises/Exercise.svelte` (`{ spec, verdict, response, onsubmit }`); `submit(id, response)` grades (`checkResponse`) and logs; `acceptTyped` is "I was right". UI types come from `services/study-types.ts` | Import the engine into UI, grade in a component, or build options outside `buildExercise` |
| Style anything | Tokens only (`design/tokens/*`, `themes/*`); a component's look lives in its one file; screens compose layers with no styles (Stylelint runs in `npm run lint`, DESIGN §13). New pieces go into `/dev/ui` (`ui/styleguide/*`) | Raw hex, px off the scale, `--palette-*` in components, or copying a component to change its look (add a prop) |
| Delight and Yuki reactions | The screen decides; `effectOn(effect, prefs.companion)` and `hapticTick` in `ui/delight/delight.ts`; `prefs` from `services/preferences.svelte.ts`; pressables carry `data-paw` | Trigger effects inside exercise components |
| Trash a course | `courseService.trash(id)` (`study-wiring.ts`) → `ContentStore.trashCourse` (tombstones, one transaction) | Delete records |
| Combine two devices | `merge()`, then replay `affectedCardIds` | Merge caches |
| Add or change a stored field | `DATA_MODEL.md`, the zod schema in `db/schemas/` and any Dexie migration, in one commit | Change only one of them |

**Engine pattern:** pure functions in `src/lib/engine/` returning `Traced<T>` (`{ result, trace }`). Sort with `compareText` or `sortEvents`, never `localeCompare`. Lint fails on `Date.now`, `Math.random`, DOM or IO use there, and on a complexity above 10.

**Import direction:** UI → services → engine and repos → schemas and config. `src/lib/import` is pure like the engine (it may use the engine, schemas and config), and only services call it. Lint fails on violations. A UI import path with a segment named exactly `import` trips that rule, which is why the components live in `ui/import-screen/`.

**Test pattern:** `import 'fake-indexeddb/auto'` plus a unique database name per test (create it in each test's setup; `afterEach` deletes it). Sim scenarios live in `tests/sim/` and report through `writeSimReport` in `tests/sim/harness.ts`. Session fixtures are in `tests/unit/engine/session-fixtures.ts`. Property tests use `fast-check`; shared generators are in `tests/unit/engine/fixtures.ts`. Golden files are in `tests/golden/import/` (hand-written, never generated from output) and run from `tests/unit/services/import-service.test.ts`.

## What each phase reads

Read these sections, plus this file and the Decisions log. Open anything else only when a question needs it.

| Phase | `BUILD_PLAN.md` | Other docs |
| --- | --- | --- |
| 2 Import | §4, §5 | `DATA_MODEL` §3.2–§3.5, §3.8, §4 |
| 3 Cards & grading | §5, §6.10, §6.11 | `DATA_MODEL` §4.2, §4.3 |
| 4 Engine core | §3.3, §6.1–§6.5, §6.12, §13 | `DATA_MODEL` §3.5–§3.7, §4.5; `CONCEPT` §5, §6 |
| 5 Design & exercises (done) | §3.3, §5.1, §9 | `DESIGN` in full; `CONCEPT` §4 |
| 6 Diagrams | §7, §14 | `CONCEPT` §13; `DATA_MODEL` §4.2 |
| 7 Modes | §6.6–§6.8 | `CONCEPT` §7–§9 |
| 8 Planner | §6.9 | `CONCEPT` §10, §11; `DATA_MODEL` §5 |
| 8.5 Cards & import fixes | §4, §10 row 8.5, Decisions log rows "import preview" and "Phase 8.5" | `DATA_MODEL` §3.4, §3.5; `DESIGN` §6 Import, §13 |
| 9 Transfer & offline | §8, §11.5 | `CONCEPT` §18, §19; `DATA_MODEL` §7 |
| 10 Polish & ship | §10, §11 | `DESIGN` §9 |

## End-of-phase handoff (what every phase leaves behind)

Each phase should be startable in a new chat from CLAUDE.md, this file and the Decisions log alone. While a phase is in progress, `docs/WIP.md` is the live checkpoint (CLAUDE.md rule 21; `npm run wip` shows it). Before finishing a phase, update this file:

1. **Current state:** what's done, what's next, what's partial or not wired.
2. **How data works:** add any new service, repo method or pattern that later phases must reuse, and correct anything you changed. **If you improved how something works, say here what to do now and what to stop doing.**
3. **Traps:** anything that cost real time goes in the toolchain traps in `CLAUDE.md`.

4. **WIP:** move anything still useful from `docs/WIP.md` here or into the Decisions log, then delete `WIP.md` in the phase's last commit.

Then append the `PROGRESS.md` entry and add decisions to the Decisions log. Write for someone with no memory of this session: name files and functions, and state rules rather than history.
