# WIP — Phase 8.5: Cards & import fixes

## Checkpoint log

| Date | Phase | Step | Model | Done | Files | Next | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-14 | 8.5 | 0 do-first cleanups | Opus 5.5 | HANDOFF "do first" items 1–4 | 8 | Step 1: interface for the card list + import fixes | bdf57a8 |
| 2026-11-14 | 8.5 | 1 interface | Opus 5.5 | importId + course.lastImport schema/DATA_MODEL; stubs for card-regen, duplicates, fix-prompt, card list, import undo | 14 | Step 2: tests (spec-test-writer for duplicates + card-regen; direct for services) | 601f819 |

## Task and spec

- Spec: `BUILD_PLAN.md` §10 row 8.5; Decisions log rows "import preview", "Phase 8.5" and "re-import by lectures"; `DATA_MODEL` §3.4, §3.5; `DESIGN` §6 Import, §13; SESSION_NOTES A1 (one-night minimum block).
- Done when: a student can find and fix a wrong card in under a minute without reading the raw import text; re-importing the same text adds no duplicates; an import can be undone.
- Order inside 8.5 (BUILD_PLAN row): the styling of these screens first, then the prompt rule "an answer of 3 or more items becomes separate cards or a @sequence".

## Checklist

- [x] 0. HANDOFF "do first" cleanups: `DEFAULT_IMPORT_GOAL` in `config/defaults.ts` (used by `routes/import/+page.svelte`, `PromptIntake.svelte`); `CourseMapPanel` uses the global token-based `.sr-only`; shared `util/clipboard.ts` `copyText` (used by `ImportPreviewPanel`, `PromptIntake`); `tests/unit/services/import-wiring.test.ts` for `ensureSampleCourse`.
- [x] 1. Interface (checkpoint a). Stubs (`throw new Error('not implemented')`):
  - `engine/card-regen.ts` `planCardRegen(note, existing)` → keep/add/remove by variant (rule 7).
  - `import/duplicates.ts` `noteFingerprint`, `dropDuplicateNotes(topics, existing)` (course-wide + within the paste; image notes never duplicates).
  - `import/fix-prompt.ts` `buildFixPrompt(errors, source)`.
  - `services/card-list-types.ts` (view types), `services/card-list.ts` `toCardList`, `filterCardList(view, query, filter)`.
  - `services/card-list-service.ts` `CardListService(store, replay, logger)`: `list`, `editNote`, `deleteNote`, `flag`, `unflag`.
  - `services/import-undo.ts` `ImportUndoService(store, logger)`: `lastImport`, `undo`.
  - Schemas: `ImportIdSchema` (common), optional `importId` on topics/chunks/notes/cards/media, `Course.lastImport` (`LastImportSchema`, `TopicBeforeImportSchema`). DATA_MODEL §3.1–3.5, §3.8 updated. No Dexie bump.
  - Still to wire at step 3: `ImportService.commit` sets `importId` on drafted records and writes `course.lastImport`; preview counts duplicates (`ImportPreview.duplicates`); `OneNightView.minimumBlock` (step 4).
- [ ] 2. Tests: plumbing (card-list service, undo) written directly; duplicate-skip in the import pipeline → `spec-test-writer` (Sonnet). **Checkpoint (b).**
- [ ] 3. Implement + screens: "See all cards" (after an import and on the course page), styling first; skipped/unsure items link into the list; fix-it prompt for skipped parts; check which of preview on paste / numbered steps / Start studying / paste more / sample cards already exist and finish the rest. **Checkpoint (c)** per module.
- [ ] 4. One-night minimum block: pass `OneNightPlan.minimumBlock` through `OneNightView` (`services/course-types.ts`, built in `course-learn.ts` `oneNight`) to `PlanCards.svelte`, show the sleep reminder, + e2e.
- [ ] 5. Prompt rule: an answer of 3+ items becomes separate cards or a `@sequence` (`import/prompt-v2.ts`, PROMPTS.md).
- [ ] 6. `npm run verify`. **Checkpoint (d).**
- [ ] 7. Reviewer (fresh session): diff since base `7e09c48`, **plus `src/lib/import/parser.ts`, `lexer.ts` and `build*.ts` read in full** (never independently reviewed). **Checkpoint (e).**
- [ ] 8. HANDOFF + PROGRESS, delete this file. **Checkpoint (f).**

## Notes

- Decisions (2026-11-14, user): undo = latest import any time; "looks wrong" = flag + pause. Both in the Decisions log, with duplicate skip being course-wide.

- Base commit for the review: `7e09c48`.
- `test-results/summary.md` currently shows an older verify with `test:e2e:built` failed (from before this phase); recheck at step 6.
