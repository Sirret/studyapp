# WIP — Phase 8.5: Cards & import fixes

## Checkpoint log

| Date | Phase | Step | Model | Done | Files | Next | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-14 | 8.5 | 0 do-first cleanups | Opus 5.5 | HANDOFF "do first" items 1–4 | 8 | Step 1: interface for the card list + import fixes | (this commit) |

## Task and spec

- Spec: `BUILD_PLAN.md` §10 row 8.5; Decisions log rows "import preview", "Phase 8.5" and "re-import by lectures"; `DATA_MODEL` §3.4, §3.5; `DESIGN` §6 Import, §13; SESSION_NOTES A1 (one-night minimum block).
- Done when: a student can find and fix a wrong card in under a minute without reading the raw import text; re-importing the same text adds no duplicates; an import can be undone.
- Order inside 8.5 (BUILD_PLAN row): the styling of these screens first, then the prompt rule "an answer of 3 or more items becomes separate cards or a @sequence".

## Checklist

- [x] 0. HANDOFF "do first" cleanups: `DEFAULT_IMPORT_GOAL` in `config/defaults.ts` (used by `routes/import/+page.svelte`, `PromptIntake.svelte`); `CourseMapPanel` uses the global token-based `.sr-only`; shared `util/clipboard.ts` `copyText` (used by `ImportPreviewPanel`, `PromptIntake`); `tests/unit/services/import-wiring.test.ts` for `ensureSampleCourse`.
- [ ] 1. Interface: card-list service types and signatures (list by topic with status + search, edit keeping card IDs, delete = tombstone, "looks wrong" flag), import duplicate-skip and undo signatures, any zod/data-model change (rule 19). Commit. **Checkpoint (a).**
- [ ] 2. Tests: plumbing (card-list service, undo) written directly; duplicate-skip in the import pipeline → `spec-test-writer` (Sonnet). **Checkpoint (b).**
- [ ] 3. Implement + screens: "See all cards" (after an import and on the course page), styling first; skipped/unsure items link into the list; fix-it prompt for skipped parts; check which of preview on paste / numbered steps / Start studying / paste more / sample cards already exist and finish the rest. **Checkpoint (c)** per module.
- [ ] 4. One-night minimum block: pass `OneNightPlan.minimumBlock` through `OneNightView` (`services/course-types.ts`, built in `course-learn.ts` `oneNight`) to `PlanCards.svelte`, show the sleep reminder, + e2e.
- [ ] 5. Prompt rule: an answer of 3+ items becomes separate cards or a `@sequence` (`import/prompt-v2.ts`, PROMPTS.md).
- [ ] 6. `npm run verify`. **Checkpoint (d).**
- [ ] 7. Reviewer (fresh session): diff since base `7e09c48`, **plus `src/lib/import/parser.ts`, `lexer.ts` and `build*.ts` read in full** (never independently reviewed). **Checkpoint (e).**
- [ ] 8. HANDOFF + PROGRESS, delete this file. **Checkpoint (f).**

## Notes

- Base commit for the review: `7e09c48`.
- `test-results/summary.md` currently shows an older verify with `test:e2e:built` failed (from before this phase); recheck at step 6.
