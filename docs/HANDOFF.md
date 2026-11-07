# Handoff — read this first in every new session

The working notes passed from one phase to the next. Unlike `PROGRESS.md` (a history that only grows), this file is **edited to stay current and short: under about 80 lines.** Remove what stops being true.

## Current state

- **Done:** Phases 0, 1 and 2. **Next:** Phase 3 (Cards & grading).
- **Exists:** tooling, CI, logger, Dexie schema, zod schemas for every entity, repositories, event log, `merge()`, `replay()`, the import pipeline, `engine/cardgen.ts`, and the `/import` screen.
- **Partial on purpose:** `replay()` only derives `accuracy`; Phase 4 adds FSRS, criterion, status and fragile. Phase 3 has `cardgen` already, so it builds `grading`, `distractors` and `rng`. Occlusion notes import with no boxes and so no cards, until the Phase 6 editor adds boxes.
- **Not wired yet:** `kv.schemaVersion` isn't written. Screens are unstyled and not in a style guide, because tokens and `/dev/ui` arrive in Phase 5, which must restyle `/import` (notebook paper, per `DESIGN` Import) and add `ImportPreviewPanel` to the guide.

## How data works here (reuse this; don't reinvent it)

| To do this | Use | Never |
| --- | --- | --- |
| Create or change content | `CourseRepo`, `TopicRepo`, `ChunkRepo`, `NoteRepo`, `CardRepo`, `MediaRepo` in `db/repos/content-repos.ts`, built on `ContentRepo` | Touch a Dexie table directly |
| Delete content | `repo.softDelete(id)`; reads already hide tombstones | Hard delete, except archive or replace import |
| Record study history | `EventRepo.append(fields)`; it adds `id`, `ts`, `deviceId`, `seq` | Update or delete an event |
| Update card scheduling | Extend `replay()`; `ReplayService.rebuildAll()` stores the result via `CardRepo.applyReplay` | Write `fsrs`, `due`, `status`, `fragile`, `weak`, `daysCorrect`, `pathStep` or `accuracy` anywhere else |
| Read or write settings | `KvRepo.get/set`, validated against `KV_SCHEMAS` | Touch `db.kv` directly |
| Write across several tables, all or nothing | Build records with `repo.draft` and `repo.draftChange`, then `ContentStore.writeBatch`, which is one transaction | Open a Dexie transaction around repository calls |
| Get cards for a note | `generateCards(note).result` in `engine/cardgen.ts` | Hard-code variants or paths |
| Import text | `ImportService`, which runs `parseImport`, `buildPlan` and `ImportBatchDrafter` | Call the pipeline from a screen |
| Give a screen a service | A `services/*-wiring.ts` module, imported only by that route, so its dependencies stay out of the shell | Add repos or zod to `services/app.ts` |
| Combine two devices | `merge()`, then replay `affectedCardIds` | Merge caches |
| Add or change a stored field | `DATA_MODEL.md`, the zod schema in `db/schemas/` and any Dexie migration, in one commit | Change only one of them |

**Engine pattern:** pure functions in `src/lib/engine/` returning `Traced<T>` (`{ result, trace }`). Sort with `compareText` or `sortEvents`, never `localeCompare`. Lint fails on `Date.now`, `Math.random`, DOM or IO use there, and on a complexity above 10.

**Import direction:** UI → services → engine and repos → schemas and config. `src/lib/import` is pure like the engine (it may use the engine, schemas and config), and only services call it. Lint fails on violations. A UI import path with a segment named exactly `import` trips that rule, which is why the components live in `ui/import-screen/`.

**Test pattern:** `import 'fake-indexeddb/auto'` plus a unique database name per test. Property tests use `fast-check`; shared generators are in `tests/unit/engine/fixtures.ts`. Golden files are in `tests/golden/import/` (hand-written, never generated from output) and run from `tests/unit/services/import-service.test.ts`.

## What each phase reads

Read these sections, plus this file and the Decisions log. Open anything else only when a question needs it.

| Phase | `BUILD_PLAN.md` | Other docs |
| --- | --- | --- |
| 2 Import | §4, §5 | `DATA_MODEL` §3.2–§3.5, §3.8, §4 |
| 3 Cards & grading | §5, §6.10, §6.11 | `DATA_MODEL` §4.2, §4.3 |
| 4 Engine core | §3.3, §6.1–§6.5, §6.12, §13 | `DATA_MODEL` §3.5–§3.7, §4.5; `CONCEPT` §5, §6 |
| 5 Design & exercises | §3.3, §9 | `DESIGN` in full; `CONCEPT` §4 |
| 6 Diagrams | §7, §14 | `CONCEPT` §13; `DATA_MODEL` §4.2 |
| 7 Modes | §6.6–§6.8 | `CONCEPT` §7–§9 |
| 8 Planner | §6.9 | `CONCEPT` §10, §11; `DATA_MODEL` §5 |
| 9 Transfer & offline | §8, §11.5 | `CONCEPT` §18, §19; `DATA_MODEL` §7 |
| 10 Polish & ship | §10, §11 | `DESIGN` §9 |

## End-of-phase handoff (what every phase leaves behind)

Before finishing a phase, update this file:

1. **Current state:** what's done, what's next, what's partial or not wired.
2. **How data works:** add any new service, repo method or pattern that later phases must reuse, and correct anything you changed. **If you improved how something works, say here what to do now and what to stop doing.**
3. **Traps:** anything that cost real time goes in the toolchain traps in `CLAUDE.md`.

Then append the `PROGRESS.md` entry and add decisions to the Decisions log. Write for someone with no memory of this session: name files and functions, and state rules rather than history.
