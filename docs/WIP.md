# WIP — Import v2

## Committed 2026-11-13 with audit 1.1, 1.5, 1.6 (one commit; hash in AUDIT.md)

- **Gap decisions (user, confirmed):** PROMPTS §7 "Robust parsing" now says: unknown directives are skipped with a warning, never an error, and the lines under them with them; directive names are case-insensitive; `ParseOutput` has `warnings` next to `errors`; an empty paste gives no errors and no warnings ("Nothing to import").
- **Code:** `parser.ts` looks up the lowercased name in the `Map` (the lookup already used own keys, so `@constructor` / `@__proto__` never match). Warnings keep the spelling the paste used.
- **Tests updated to the spec:** `build.test.ts` (13 messages now "before any @topic or @deck", PROMPTS §7); `parser.test.ts` (empty text, case-insensitive, unknown ×3 and lone `@` as warnings); `tests/golden/import/malformed.expected.json` (preamble and `@unknown` moved to `warnings`); `import-service.test.ts` asserts `preview.warnings` (golden files without a list expect none).
- **Coverage (threshold not lowered):** `src/lib/import/**` is below 80% (75.7% lines, 64% branches) until Import v2 is implemented. Same reason the stub check fails at the interface step.
- **Still open for Import v2:** parser, builder and UI (checklist step 4 onward). The WIP Design lines on warnings are now PROMPTS §7.
- **Open item:** Full `npm run test` not rerun after 771609b (the hook ran the 19 affected files only). Run it at the next checkpoint.
- **Open item:** `build-structure.ts` `applyStructure` complexity 22 > 10 (eslint warning, not blocking). Refactor during Import v2.

## Design (decided; goes into the Decisions log and DATA_MODEL)

- **Section = a `chunks` record** (table name kept to avoid a rename migration): new optional `title`, `priority`, `tip`, `added: true`; `text` may be `''` (Just study / Cram replies have no @read). Acquisition must skip the read step for an empty section.
- **Topic:** new `key?` (map id), `from: string[]` (default `[]`, normalised "Lecture I"), `summary?`, `partial?: true`.
- **Course:** new `map?: CourseMap` = `{ bigpicture: string[]; habit: string[]; topics: { key; title; from[]; sections[] }[]; links: { from; to; how }[]; cheat?: { name; items; rows }; missing: string[]; next?: { topicKey; section? }; goal? }`.
- **Fact payload:** new `keyWords?: string[]` (idea units from `*…*`, stored stripped), `list?: true` (definition is only starred items → no `rev` card).
- **@link** lines → `scenario` notes (one card) tagged `link:<key>`.
- **[ADDED]:** trailing on a card line → note `generated: true`; leading on @read → chunk `source: 'generated'`; the section titled "Added by the chatbot (check these)" → chunk `added: true`. `[GENERATED]`/`[CHECK]` stay aliases.
- **Unknown directive / text before first @ / outside fences:** warnings (new `ParseOutput.warnings`), never errors. If the paste has ``` fences, only lines inside fences count.
- **Completeness:** last directive @end → complete; @next → clean stop, resume at its topic; neither → cut off: drop the last section of the last topic, mark it partial, resume there.
- **Dexie v2:** same indexes + upgrade: topics get `from: []`; chunks get `title` from the first tag of their notes.
- New modules (files ≤ 300 lines): `import/source.ts` (fences, preamble), `import/map-parsers.ts`, `import/key-words.ts`, `import/build-map.ts`, `import/completeness.ts`, `import/validate.ts`, `import/lectures.ts` (from: normalisation), `import/prompt-v2.ts`.

## PAUSED 2026-11-13 (user asked to pause; usage limit hit) — resume here

**Nothing of Import v2 is committed yet.** Last commit: fc36dd9. All work below is in the working tree (see `git status`). Don't commit piecemeal: the pre-commit hook runs changed tests, and 19 older tests still fail on intended spec changes until the test agent updates them.

**Also pending from the user's latest requests (do after Import v2 is green):**
- A **default course auto-imported** on first run, built from `tests/fixtures/import/` (security and/or datacomms reply) — e.g. a service that imports it once when there are no courses (KV flag so it never re-imports after the student deletes it). Not started.
- **Commit and push** once verify passes (push redeploys GitHub Pages).
- Uncommitted config change already made (commit with the rest): `.claude/agents/spec-test-writer.md` gained `model: sonnet`; CLAUDE.md workflow step 2 says "(runs on Sonnet)". NOTE: the last agent launch still ran on Opus, because agent definitions are read when the session starts — a new session picks up Sonnet.

### Done (uncommitted)
- Interface + data: `db/schemas/course.ts` (CourseMap, Topic key/from?/summary/partial, Chunk title/priority/tip/added), `note.ts` (fact keyWords/list), `db/schema.ts` Dexie v2 `upgradeToV2` (chunk titles from tags), DATA_MODEL §3.1–§3.4, §4.2, §4.6, BUILD_PLAN Decisions log (10 rows "Import v2: …" + legacy-cut rule is in `completeness.ts` JSDoc — **add a Decisions row**: "a legacy @deck paste without @end is reported cut but nothing is dropped").
- Parser/builder implemented and smoke-tested on both fixtures (0 errors; datacomms 7 topics / 23 sections / 119 cards, 7 warnings for @exam; security 8 / 27 / 167, map 8 topics, 12 links, 11 cheat rows, 2 missing; truncating mid-section → cut, topic partial, resume set): `source.ts`, `lectures.ts`, `key-words.ts`, `completeness.ts`, `build-map.ts`, `build-structure.ts` (new; holds BuildState + structure handling), `build.ts` (notes, key words, link tags, completeness/map wiring), `map-parsers.ts`, `parser.ts` (prepareSource, warnings), `block-parsers.ts` ([ADDED] prefix, compare name, exported strayLineErrors), `compare-parser.ts` (shared `readTable`), `lexer.ts` ([ADDED]), `validate.ts`, `prompt-v2.ts` (BASE/GOAL generated verbatim from PROMPTS.md), `engine/cardgen.ts` (list facts fwd only).
- Services: `import-map.ts` (new: matchTopic by from/key/name, mapChecklist, nextCourseMap, resumeFor), `import-service.ts` (preview: status, warnings, checklist, missing, resumePrompt, starredGaps + flags notes; commit(…, goal?) writes the course map in the batch), `import-batch.ts` (matchTopic, topic v2 fields, chunk v2 fields), `content-store.ts` (`ContentBatch.courses?`).
- Tests written directly: `tests/unit/db/migration-v2.test.ts` (passes).

### Next steps, in order
1. Fix the 2 type errors: `src/lib/ui/styleguide/guide-data.ts` `SAMPLE_IMPORT_PREVIEW` needs the new ImportPreview fields (`status: 'complete'`, `warnings: []`, `checklist: []`, `missing: []`, `resumePrompt: null`, `starredGaps: []`). Then `npm run check` must be 0 errors.
2. Lint: `build.ts` may exceed the 300-line rule; `import-batch.ts` `({ line, ...section })` unused `line`; `build-map.ts` uses a cast `block as MapBlock` (replace with a type guard).
3. Relaunch **spec-test-writer** (the brief below "spec-test-writer brief (Import v2 parser)" plus part A: update 19 older tests for the spec change — build.test.ts "reports @X before any @deck" ×12 → message now "… before any @topic or @deck…"; parser.test.ts empty-text (new `warnings`), case-sensitive / @constructor / @toString / @__proto__ / lone @ → now warnings; golden `malformed` in import-service.test.ts). Two launches died on the 5-hour limit before writing anything.
4. Acquisition: skip the read step for a section with empty text (`engine/acquisition.ts` unitSteps); `services/course-learn.ts` `unitSection` should prefer the chunk `title` (now stored) over note tags.
5. UI: import screen intake (4 questions, PROMPTS §2) → `buildPrompt` "Copy prompt" + `PDF_TIP` + "Claude is the supported chatbot"; preview: checklist "N of M topics imported", @missing warnings, warnings list, partial note, "Copy resume prompt" when `resumePrompt`; pass the intake goal to `commit`. Course page: bigpicture, habit questions, @cheat table (simple). Add new states to `/dev/ui`.
6. e2e for intake/prompt, multi-reply paste + checklist, course page map. Then the default course (above), verify, reviewer (Sonnet), PROGRESS, HANDOFF, delete WIP, commit in groups of ≤ ~40 files, push.

## Checklist

- [x] 1 Interface: schemas, AST types, module signatures (stubs) — commit: 771609b. event.ts fields for 8.6 included (ReviewEvent `hinted`, `verdictKind`).
- [ ] 2 spec-test-writer on the import modules (brief below once written)
- [x] 3 Data model + Dexie v2 migration + DATA_MODEL (one commit) — commit: 771609b
- [ ] 4 Implement parser/build/prompt; services (preview checklist, missing, resume, from: matching, commit new fields)
- [ ] 5 UI: intake + Copy prompt + PDF tip; preview checklist/missing/resume; course page bigpicture/habit/cheat
- [ ] 6 e2e; verify; reviewer; PROGRESS; HANDOFF; Decisions log; delete WIP

## Progress

- (nothing committed yet for this task)
- Interface written (uncommitted; the pre-commit hook runs changed tests, so it is committed together with the agent's tests and the implementation): schemas (`course.ts` CourseMap/Topic/Chunk, `note.ts` fact keyWords/list), `db/schema.ts` `upgradeToV2` + version 2, DATA_MODEL §3.1–§3.4, §4.2, §4.6, `ast.ts` new blocks + isAdded, `lexer.ts` [ADDED], `parser.ts` warnings + `MAP_BLOCK_PARSERS`, `build.ts` plan types + `applyV2Block` stub, stubs in `source.ts`, `lectures.ts`, `key-words.ts`, `completeness.ts`, `build-map.ts`, `validate.ts`, `map-parsers.ts`, `prompt-v2.ts`; `import-batch.ts` writes `from`. Test `tests/unit/db/migration-v2.test.ts` (passes). Decisions log: 10 rows "Import v2: …".
- spec-test-writer LAUNCHED (brief below). Owns: `tests/unit/import/**` (incl. parser.test.ts), `tests/unit/engine/cardgen.test.ts`, `tests/golden/import/**`. Don't edit those while it runs.

### spec-test-writer brief (Import v2 parser)

Read: docs/PROMPTS.md (all), the BUILD_PLAN Decisions log rows starting "Import v2:", DATA_MODEL §3.2–§3.4, §4.2 (fact), §4.6. Fixtures: tests/fixtures/import/{datacomms,security}_reply.txt. Write tests (from the spec, not the stub bodies) for: parseImport (warnings, unknown directives, fences, preamble), every new directive parser, `normalizeFrom`/`sharesLecture`, `readKeyWords`, `checkCompleteness`, `collectMap`, `buildPlan` v2 (topics by key, sections, summary, tip, added, link notes, legacy @deck/@tag, early @end, @next resume, partial), `starredGaps`, `buildPrompt`/`resumePrompt` (BASE verbatim from PROMPTS §3, GOAL blocks §4), cardgen list facts (fwd only). Fixture tests: both parse with zero errors (datacomms has @exam → warnings only); topic/section/card counts; truncate a fixture mid-section → that topic partial, last section dropped, resume set; early-@end; legacy @deck/@tag. Update parser.test.ts "returns nothing for empty text" for the new `warnings` field.
