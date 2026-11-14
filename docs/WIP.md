# WIP — Phase 8.5: Cards & import fixes

## Checkpoint log

| Date | Phase | Step | Model | Done | Files | Next | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-14 | 8.5 | 0 do-first cleanups | Sonnet 5.5 | HANDOFF "do first" items 1–4 | 8 | Step 1: interface for the card list + import fixes | bdf57a8 |
| 2026-11-14 | 8.5 | 1 interface | Sonnet 5.5 | importId + course.lastImport schema/DATA_MODEL; stubs for card-regen, duplicates, fix-prompt, card list, import undo | 14 | Step 2: tests (spec-test-writer for duplicates + card-regen; direct for services) | 601f819 |
| 2026-11-14 | 8.5 | 1b recheck | Opus 5.5 | Re-reviewed steps 0–1; fixed 2 interface gaps + 2 small issues | 6 | Step 2: tests | 9add3d6 |
| 2026-11-14 | 8.5 | 2 tests | Opus 5.5 | Spec tests (agent: card-regen, duplicates) + direct tests (card list, service, undo, re-import wiring, fix prompt); SPEC-GAPs logged | 9 | Step 3: implement card-regen, duplicates, fix-prompt, card-list, services, import-service split + wiring; commit tests with it | uncommitted (hook blocks red tests) |
| 2026-11-14 | 8.5 | 3a modules | Opus 5.5 | All step-3 modules + services + import wiring green, committed with the step-2 tests; card rows sort cards by createdAt then variant (IDs are random) | 22 | Step 3b: screens ("See all cards", undo button, fix-it prompt, preview duplicates) | 1c2bea0 |

## Task and spec

- Spec: `BUILD_PLAN.md` §10 row 8.5; Decisions log rows "import preview", "Phase 8.5" and "re-import by lectures"; `DATA_MODEL` §3.4, §3.5; `DESIGN` §6 Import, §13; SESSION_NOTES A1 (one-night minimum block).
- Done when: a student can find and fix a wrong card in under a minute without reading the raw import text; re-importing the same text adds no duplicates; an import can be undone.
- Order inside 8.5 (BUILD_PLAN row): the styling of these screens first, then the prompt rule "an answer of 3 or more items becomes separate cards or a @sequence".

## Checklist

- [x] 0. HANDOFF "do first" cleanups: `DEFAULT_IMPORT_GOAL` in `config/defaults.ts` (used by `routes/import/+page.svelte`, `PromptIntake.svelte`); `CourseMapPanel` uses the global token-based `.sr-only`; shared `util/clipboard.ts` `copyText` (used by `ImportPreviewPanel`, `PromptIntake`); `tests/unit/services/import-wiring.test.ts` for `ensureSampleCourse`.
- [x] 1. Interface (checkpoint a). Stubs (`throw new Error('not implemented')`):
  - `engine/card-regen.ts` `planCardRegen(note, existing)` → keep/add/remove by variant (rule 7).
  - `import/duplicates.ts` `noteFingerprint`, `sectionFingerprint`, `dropDuplicateNotes(topics, existing)` (course-wide + within the paste; image notes never duplicates; the drafter reuses same-fingerprint sections of the matched topic).
  - `import/fix-prompt.ts` `buildFixPrompt(errors, source)`.
  - `services/card-list-types.ts` (view types), `services/card-list.ts` `toCardList`, `filterCardList(view, query, filter)`.
  - `services/card-list-service.ts` `CardListService(store, replay, logger)`: `list`, `editNote`, `deleteNote`, `flag`, `unflag`.
  - `services/import-undo.ts` `ImportUndoService(store, logger)`: `lastImport`, `undo`.
  - Schemas: `ImportIdSchema` (common), optional `importId` on topics/chunks/notes/cards/media, `Course.lastImport` (`LastImportSchema`, `TopicBeforeImportSchema`). DATA_MODEL §3.1–3.5, §3.8 updated. No Dexie bump.
  - Still to wire at step 3: `ImportService.commit` sets `importId` on drafted records and writes `course.lastImport`; preview counts duplicates (`ImportPreview.duplicates`); `OneNightView.minimumBlock` (step 4).
- [x] 1b. Opus recheck of steps 0–1 (user asked; 9add3d6): added `sectionFingerprint` (re-import was going to copy sections even with notes de-duplicated); undo must also remove cards an edit added to a removed note (they carry no `importId`); `editNote` keeps the note's type. Step 3 must also split `services/import-service.ts` (already 305 lines, limit 300) before adding the importId/lastImport/duplicate wiring.
- [x] 2. Tests (2026-11-14, **uncommitted on purpose**): the pre-commit hook runs `vitest --changed` (untracked files included), so red spec tests block every commit; per the CLAUDE.md trap they are committed together with the step-3 implementation. Never `--no-verify`. Files on disk: `tests/unit/engine/card-regen.test.ts` (14, agent), `tests/unit/import/duplicates.test.ts` (31, agent), `tests/unit/import/fix-prompt.test.ts`, `tests/unit/services/card-list.test.ts`, `card-list-service.test.ts`, `import-undo.test.ts` (also holds the ImportService re-import / importId / lastImport wiring tests), `card-list-fixtures.ts`; plus 2 Decisions-log rows in `BUILD_PLAN.md` (SPEC-GAPs; card-list wording + `studiedCards`). State: typecheck + lint clean; 77 fail on `not implemented` or missing step-3 wiring, 1 passes. **Checkpoint (b), no commit possible.**
- [x] 3a. Implement the modules (2026-11-14, Opus 5.5, commit in the checkpoint log): `card-regen`, `duplicates` (end-punctuation = any non-letter/non-digit run, per the SPEC-GAP row), `fix-prompt`, `card-list` (local `groupBy`, not ES2024 `Map.groupBy`), `CardListService`, `ImportUndoService`; `import-service.ts` split (helpers → `services/import-preview-parts.ts`), preview drops duplicates (`ImportPreview.duplicates`), commit stamps `importId` and writes `course.lastImport`; `import-batch.ts` snapshots changed topics (`topicsBefore()`) and reuses same-fingerprint sections. New plumbing: `ContentRepo.draftDelete`, `ContentStore.putBatch` (bulkPut across tables, one transaction; `writeBatch` stays add-only) and `ContentStore.now()`, with 2 tests in `content-store.test.ts`. All 1834 tests green, check clean.
- [ ] 3b. Screens (UI only, styling first, e2e): "See all cards" (after an import and on the course page), styling first; skipped/unsure items link into the list; fix-it prompt for skipped parts; check which of preview on paste / numbered steps / Start studying / paste more / sample cards already exist and finish the rest. **Checkpoint (c)** per module.
- [ ] 4. One-night minimum block: pass `OneNightPlan.minimumBlock` through `OneNightView` (`services/course-types.ts`, built in `course-learn.ts` `oneNight`) to `PlanCards.svelte`, show the sleep reminder, + e2e.
- [ ] 5. Prompt rule: an answer of 3+ items becomes separate cards or a `@sequence` (`import/prompt-v2.ts`, PROMPTS.md).
- [ ] 6. `npm run verify`. **Checkpoint (d).**
- [ ] 7. Reviewer (fresh session): diff since base `7e09c48`, **plus `src/lib/import/parser.ts`, `lexer.ts` and `build*.ts` read in full** (never independently reviewed). **Checkpoint (e).**
- [ ] 8. HANDOFF + PROGRESS, delete this file. **Checkpoint (f).**

## Step 2 ownership and agent brief

- `spec-test-writer` (Sonnet) owns `tests/unit/engine/card-regen.test.ts` and `tests/unit/import/duplicates.test.ts`. Status: done (45 tests, all failing on `not implemented`); its 8 SPEC-GAPs accepted as read and logged in the Decisions log, no test changes needed.
- Written directly (main session): `tests/unit/services/card-list.test.ts`, `card-list-service.test.ts`, `import-undo.test.ts`, `tests/unit/import/fix-prompt.test.ts`, and import-service re-import/undo wiring tests.
- Brief (relaunch verbatim if lost): "Write failing unit tests, from the spec only, for two stubbed modules of Phase 8.5. (1) `src/lib/engine/card-regen.ts` `planCardRegen(note, existing)` → `tests/unit/engine/card-regen.test.ts`. (2) `src/lib/import/duplicates.ts` `noteFingerprint`, `sectionFingerprint`, `dropDuplicateNotes` → `tests/unit/import/duplicates.test.ts`. Read only: the two stub files (their JSDoc is part of the spec); `src/lib/engine/cardgen.ts` (`generateCards`, `NoteContent`, `CardSpec`: card variants come from here); type definitions at the top of `src/lib/import/build.ts` (`PlannedTopic`, `PlannedChunk`, `PlannedNote`, `PlannedContent`, lines 1–80); `docs/BUILD_PLAN.md` §10 row 8.5 (line ~801) and Decisions log rows 'Phase 8.5: duplicate notes are skipped course-wide' (~line 1172); `docs/DATA_MODEL.md` §3.5 (`variant` unique per note); CLAUDE.md rule 7. Look at `tests/unit/engine/cardgen.test.ts` and `tests/unit/import/build.test.ts` only for fixture style. Cover: keep by variant with same ID; add new variants; remove lost variants; pathChanged true/false; trace present; fingerprint normalisation (case, inner spacing, end punctuation) equal, different types/payloads differ, image notes → null; section fingerprint title+text; dropDuplicateNotes: course-wide match across topics, within-paste earlier duplicate dropped (first kept), image notes never dropped, order of kept notes and topics/sections unchanged, skipped reports line + topic name. Report SPEC-GAPs instead of guessing."

## Notes

- Decisions (2026-11-14, user): undo = latest import any time; "looks wrong" = flag + pause. Both in the Decisions log, with duplicate skip being course-wide.

- Base commit for the review: `7e09c48`.
- 2026-11-14: `tests/unit/services/study-service.test.ts` "plays the harness session to the end" failed once inside the pre-commit hook and passed in 20+ reruns (likely a timeout under load). If it fails again at verify, read its message before anything else.
- Step 3b services to call from the screens: `CardListService.list/editNote/deleteNote/flag/unflag`, `filterCardList`, `ImportUndoService.lastImport/undo`, `buildFixPrompt(preview.errors, text)`, `ImportPreview.duplicates`. None are wired into `services/wiring` or any route yet.
- `test-results/summary.md` currently shows an older verify with `test:e2e:built` failed (from before this phase); recheck at step 6.
