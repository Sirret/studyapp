You are an AI assistant working on the Snowpack: Study & Cram repository. Your job for this session is to work through a bounded documentation and process audit, not a redesign and not a code review. The audit is below. Work through it top to bottom within each tier, applying the fix in each item and updating every file the item's Propagate line names, all in the same commit. Mark each item's checkbox when its commit lands and record the commit hash. When every item in a tier is done, move to the next tier. Do not skip items. Do not start any item from a later tier until every earlier-tier item is done. When every item is done and every propagate edit has landed, delete this file from the repository in its own commit.

How to edit (saves usage): for each item, locate the heading or line with grep and read only about 40 lines around it. Never read a whole doc for these items. CLAUDE.md lives at the repository root (not docs/); every "CLAUDE.md" below means the root CLAUDE.md — if yours is elsewhere, use its real path and do not create a second one.

Two rules govern this whole document and override anything else:

    The design is not built yet. docs/DESIGN.md describes a previous direction. The user has decided the cozy style (see docs/SESSION_NOTES.md section G), drawn all 42 screens, and will rewrite DESIGN.md later. Until that rewrite lands, no item in this audit decides anything about the design, and no new screen may use anything from DESIGN.md's prose. Screens are built against design tokens only. Item 2.2 is the only design-adjacent item, and its only job is to enforce that constraint; it does not choose a direction.

    Where a fix goes is defined by Appendix A. If an item changes a stored field, an engine rule, a tunable number, a phase order, a test status, a design token, an agent's scope, an import directive, or an event field, Appendix A lists every other file that must be edited in the same commit. A commit that touches one file without the Appendix A propagation is a broken commit.

Status legend for each item: [ ] not started, [~] in progress, [x] done (with commit hash), [!] blocked (with reason).
Tier 1 — Blocking (do before the next commit)

Order note (user decision): items 1.5 and 1.6 go first as one commit, and 1.1 shares that commit (SESSION_NOTES §A and §J). Then 1.2, 1.3, 1.4, 1.7, then Tier 2. Reason: uncommitted Import v2 work blocked the pre-commit hook (`npm run check` failed on the ImportPreview style-guide sample, fixed in 1.6). The hook also runs the Import v2 tests, so the commit waits on the SPEC-GAPs in docs/WIP.md. `--no-verify` is not used.
[x] 1.1 — Mark SESSION_NOTES section A as applied (10 of 11 items)

    Where: docs/SESSION_NOTES.md, section A header.

    Evidence: docs/PROGRESS.md's entry "2026-11-13 — Fix pass" says all 18 Fix-pass items were applied (that brief covered A1–A10 plus the 8 B bugs); item A11 (Settings and Courses screens) was explicitly excluded, per "SESSION_NOTES A11 (Settings and Courses screens) was not in this pass's brief." The section A header still reads "NOT APPLIED (still pending in code)".

    Risk: A fresh session reading section A will re-verify work already done, wasting tokens on exactly the item that is costing the most.

    Fix: Change the header to: ## A. Tech-check fixes: 10 of 11 applied (Fix pass, 2026-11-13); A11 open. Append ✅ to items A1 through A10. Leave A11 with ⏳ Settings and Courses screens — still pending; see 8.6. Also update the status key at the top of the file so NOT APPLIED refers only to A11.

    Propagate: docs/HANDOFF.md — its "Not wired yet" section already says "No Courses/Settings routes yet (SESSION_NOTES A11)"; keep as is. docs/PROGRESS.md — no change.

    Effort: S.

    Status: [x] — commit: 771609b (one commit with 1.5 and 1.6, by user decision: SESSION_NOTES §A and §J go in the same commit as 1.5).

[x] 1.2 — Mark SESSION_NOTES section B as applied

    Where: docs/SESSION_NOTES.md, section B header.

    Evidence: docs/PROGRESS.md's Fix pass entry lists item 18 ("Learn ceremony: no round or session summary screens inside a Learn unit") and confirms all 18 items across A and B were done.

    Fix: Change the header to ## B. Bugs found by using the live app (Nov 13): all fixed in the Fix pass and append ✅ to each bullet.

    Propagate: docs/HANDOFF.md — no change. docs/PROGRESS.md — no change.

    Effort: S.

    Status: [x] — commit: 0a252e8. Section B: 8 bullets ✅, the typed paraphrase and Meet the terms bullets ⏳ 8.6 (D3, D2), the @coverage bullet superseded by @missing. Evidence mismatch resolved with the user, 2026-11-13.

[x] 1.3 — Add a "Phase status" table to BUILD_PLAN section 10

    Where: docs/BUILD_PLAN.md, section 10, immediately above the existing phase table.

    Evidence: Section 10 lists phases 0 to 10 in numeric order with 6 before 7. The Decisions log says the real order is 5, then 7, then 8, then Fix pass, then Import v2, then 8.5, then 8.6, then 6, then 9, then 10, then 11. docs/HANDOFF.md carries the real order; CLAUDE.md's reviewer rule names only 7, 8 and 9. A fresh session reading section 10 will build in the wrong order.

    Fix: Insert this block immediately before the existing phase table:

text

### Phase status (authoritative — overrides the table below)

Rows are in build order. Order and status are maintained here. The table below is the original plan; where they disagree, this table wins.

| # | Phase | Status | Spec authority |
|---|-------|--------|----------------|
| 0–5 | Setup … Design system & exercises UI | Done | BUILD_PLAN |
| 7 | Modes | Done | BUILD_PLAN §6.6–§6.8 + Decisions log |
| 8 | Planner | Done | BUILD_PLAN §6.9 |
| — | Fix pass (tech-check + live bugs) | Done | SESSION_NOTES §A (A1–A10), §B |
| — | Import v2 | In progress | PROMPTS.md |
| 8.5 | Cards & import fixes | Next | BUILD_PLAN §10 row 8.5 + SESSION_NOTES |
| 8.6 | Learn & Practice | Pending | SESSION_NOTES §C, §D, §J, §K |
| 6 | Diagrams | Outstanding | BUILD_PLAN §7 |
| 9 | Transfer & offline | Not started | BUILD_PLAN §8 |
| 10 | Polish & ship | Not started | BUILD_PLAN §10 + §11 |
| 11 | Play | Not started | GAMES.md |

**Design status:** `DESIGN.md` describes a previous direction. The cozy direction (SESSION_NOTES §G) is being prepared but DESIGN.md has not been rewritten, and its current prose is not authoritative. Until the rewrite, every new screen uses design tokens only (`src/lib/design/tokens/*`, `themes/*`) and adds new components to `/dev/ui` before using them on a screen. See section 15 and CLAUDE.md rule 20.

    Propagate: docs/HANDOFF.md — remove the line "Before starting Phase 6, confirm with the user that the phases before it are done" and replace it with "Phase order and status are in BUILD_PLAN §10's 'Phase status' table." CLAUDE.md — item 1.4.

    Effort: S.

    Status: [x] — commit: c00ccbb. Evidence matched. The HANDOFF line was present and is replaced.

[x] 1.4 — Update CLAUDE.md's reviewer rule to match practice

    Where: CLAUDE.md, workflow step 5, and .claude/agents/reviewer.md description.

    Evidence: CLAUDE.md says "called once per phase, only at the end of Phases 7, 8 and 9". The Fix pass got a reviewer anyway (docs/PROGRESS.md: "Reviewer (Sonnet) on the diff since 950f8a3: PASS"). docs/WIP.md's Import v2 checklist says "one reviewer pass (Sonnet)". Practice is ahead of the rule.

    Fix: In CLAUDE.md, replace workflow step 5 with:

    5. Review. Run the reviewer agent as its own task, in a fresh session (so it doesn't inherit the implementer's context), once per phase: every numbered phase 0–11, plus the Fix pass, Import v2, 8.5 and 8.6. Brief it with: phase name, base commit, the spec sections the phase implements, and the path to test-results/summary.md. It reads the diff (not whole files). Fix its blocker findings; fix or log should-fix and nit. Rerun only if it found blockers.

In .claude/agents/reviewer.md, replace the description's "Run once at the end of each of Phases 7, 8 and 9" with "Run once at the end of every phase, as its own task in a fresh session".

    Propagate: docs/HANDOFF.md — its "Current state" line says the reviewer runs "at the end of Phase 9"; change to "at the end of every phase".

    Effort: S.

    Status: [x] — commit: 9b8bc6c. Evidence matched; CLAUDE.md step 5, reviewer.md description and HANDOFF timing updated.

[x] 1.5 — Add two ReviewEvent fields for Phase 8.6 before Import v2 commits

    Where: src/lib/db/schemas/event.ts, docs/DATA_MODEL.md section 3.6, docs/BUILD_PLAN.md sections 5.1 and 6.3, docs/BUILD_PLAN.md Decisions log.

    Evidence: docs/SESSION_NOTES.md sections D3 (idea-unit definitions), D4 (list "N of M") and J (micro hint) are decided. src/lib/db/schemas/note.ts already has keyWords?: string[] and list?: true, but event.ts has no hinted, no verdictKind, and no place to record an idea-unit or list-N outcome. Adding these later means a Dexie upgrade and a "how do we treat old events" rule; adding them now is one optional field each.

    Fix (schema): Add to ReviewEvent in event.ts:

text

/** A hint was used. A hinted correct is rated Hard for FSRS and never counts toward the criterion. @see BUILD_PLAN §6.3 */
hinted: z.boolean().optional(),
/** How the answer was graded (typed only). Absence = exact. @see BUILD_PLAN §5.1 */
verdictKind: z.enum(['exact', 'fuzzy', 'ideaUnit', 'listN']).optional(),

    Fix (spec): Add three lines. In BUILD_PLAN section 6.3, after the "Counting corrects" bullet, add: "A review with hinted: true never counts toward the criterion (not even as recognition); if correct it is rated Hard for FSRS. This matches SESSION_NOTES §J." In BUILD_PLAN section 5.1, add two new rows to the "Per kind" table: for ideaUnit, "Fact fwd typed answer: the student types, then ticks the note's keyWords. Correct if every key word is ticked. verdictKind: 'ideaUnit'. Fallback: cloze (existing)."; for listN, "Fact with payload.list: true: ask for N of M starred items; validItems >= requiredItems is correct. verdictKind: 'listN'. Fallback: mc."

    Fix (Decisions log): Add one row:

    | Phase 8.6 engine additions (decided before 8.6): ReviewEvent.hinted, ReviewEvent.verdictKind; idea-unit grading for fact fwd typed answers; list "N of M" grading; a hinted correct never counts toward the criterion and is rated Hard for FSRS (SESSION_NOTES §J) | Prevents a Dexie migration after data exists; the current NotePayload already carries keyWords and list, so only the event and grading paths are missing |

    Propagate: docs/DATA_MODEL.md section 3.6 — add hinted and verdictKind rows to the review table. docs/SESSION_NOTES.md sections D3, D4, J — append "Spec: see BUILD_PLAN §5.1 and §6.3; event fields added in this commit." docs/WIP.md — Import v2 checklist item 1 already covers schema additions; add a note "event.ts fields for 8.6 included".

    Effort: M.

    Status: [x] — commit: 771609b (one commit with 1.1 and 1.6). The 1.5 fields are in event.ts, DATA_MODEL §3.6, BUILD_PLAN §5.1 and §6.3, and SESSION_NOTES D3/D4/J.

[x] 1.6 — Commit the Import v2 interface and Dexie v2 that are already written

    Where: docs/WIP.md "Progress" first bullet lists uncommitted interface files: course.ts (CourseMap/Topic/Chunk), note.ts (fact keyWords/list), schema.ts upgradeToV2 and version 2, ast.ts, lexer.ts, parser.ts, build.ts, plus stubs in source.ts, lectures.ts, key-words.ts, completeness.ts, build-map.ts, validate.ts, map-parsers.ts, prompt-v2.ts; import-batch.ts writes from; tests/unit/db/migration-v2.test.ts passes.

    Evidence: docs/WIP.md is the only place this is recorded. docs/HANDOFF.md says "Next: Import v2" without noting the interface is done.

    Risk: A fresh session greps git status, sees a pile of modified files, and either commits piecemeal (against the Windows "Big commits" trap) or re-does the interface.

    Fix: Before committing: npm run check and npm run test must pass. Do NOT require npm run verify here: its stub check is expected to fail because this is the interface step (CLAUDE.md workflow step 1 allows committing `throw new Error('not implemented')` stubs; they must be gone before Import v2 ends). Do not implement or delete stubs to make verify pass. npm run wip must match WIP.md's summary; commit in one group of at most 40 files (per CLAUDE.md's Windows trap) with the message feat(import): Import v2 interface and Dexie v2 (schemas, stubs, migration). Do item 1.5 in the same commit so both land together. Add one line to HANDOFF.md "Not wired yet" section: "Import v2: interface and Dexie v2 are committed (commit hash). Remaining work is the parser, builder and UI, tracked in WIP.md."

    Propagate: docs/WIP.md — mark checklist item 1 (Interface) and item 3 (Data model + Dexie v2 + DATA_MODEL) as [x] with the commit hash.

    Effort: S.

    Status: [x] — commit: 771609b (with 1.1 and 1.5). Import coverage is below 80% until Import v2 is implemented (recorded, threshold not lowered). The WIP and HANDOFF hash backfill lands in the next commit.

[x] 1.7 — Add a "checkpoint and pause" rule to the workflow (saves usage, makes progress trackable)

    Where: CLAUDE.md (repo root), the "Workflow for every phase" section; docs/WIP.md (top); docs/HANDOFF.md "Current state".

    Evidence: Sessions run several workflow steps back to back, so context keeps growing and every later step pays for the earlier ones. /clear can only be typed by the user, so the agent must stop at known points and say so. The user also wants to see what the AI did at each step.

    Fix (CLAUDE.md, add after the workflow steps):

    Checkpoints. Stop at the end of each of these, in every phase (including Fix pass, Import v2, 8.5, 8.6): (a) interface committed, (b) spec tests written, (c) one module implemented and its tests green, (d) verify passing, (e) review done, (f) PROGRESS logged. Also stop if a single step has touched more than ~15 files or the session has run long. At each checkpoint:
    1. Commit the work (never leave a checkpoint with uncommitted changes).
    2. Update the "Checkpoint log" at the top of docs/WIP.md with one row: date · phase · step · model · what was done (one line) · files touched (count) · what's next (one line) · commit hash.
    3. Print exactly:
       CHECKPOINT — <phase> / <step> done (<commit>). Next: <next step>.
       Type /clear, then: Continue from docs/WIP.md
    4. Stop. Do not start the next step in the same session.
    On "Continue from docs/WIP.md": read only the Checkpoint log's last row, the WIP checklist item it points to, and the files that item names. Do not re-read docs that the last row didn't name.

    Fix (docs/WIP.md, add at the very top):

    ## Checkpoint log
    | Date | Phase | Step | Model | Done | Files | Next | Commit |
    |------|-------|------|-------|------|-------|------|--------|

    Propagate: docs/HANDOFF.md "Current state" — add "Sessions stop at checkpoints (CLAUDE.md, Checkpoints); resume with 'Continue from docs/WIP.md'." .claude/agents/reviewer.md and .claude/agents/spec-test-writer*.md — add one line: "Your summary must fit in 25 lines; the lead copies its one-line result into the WIP Checkpoint log."

    Effort: S.

    Status: [x] — commit: cf56b14. Evidence anchors found. Checkpoint rule added to CLAUDE.md; checkpoint log started in WIP.md with the four commits from this session.

Tier 2 — High (do before 8.5)
[x] 2.1 — Spec-test-writer: scope the brief, not the test execution

    Where: docs/WIP.md "spec-test-writer brief (Import v2 parser)" and .claude/agents/spec-test-writer.md.

    Evidence: spec-test-writer is 11% of weekly usage. The brief's first line reads "Read: docs/PROMPTS.md (all), the BUILD_PLAN Decisions log rows starting 'Import v2:', DATA_MODEL §3.2–§3.4, §4.2 (fact), §4.6." That is four spec sources plus two fixtures, paid on every launch.

    Clarification: Test execution stays with the agent; the user does not want to risk forgetting a test. The agent's output is only a summary back to the lead, which is why re-reading context to produce that summary is the actual cost. Therefore do not move test execution out of the agent. Scope the brief, cap the output, and split the model by module.

    Fix (WIP.md brief, replace the first line): "Read only: docs/PROMPTS.md §3 FORMAT block (directive shapes: @map, @topic … | from:, @section, @links a -> b : …, @cheat, *key words*, list facts) and §7 (parser rules — every bullet under 'Robust parsing' and every directive listed).  The exported signatures in src/lib/import/parser.ts, build.ts, ast.ts, prompt-v2.ts. The two fixtures tests/fixtures/import/{datacomms,security}_reply.txt. Do not read §1, §2, §4–§6 of PROMPTS.md, the rest of §3, the Decisions log, or any implementation bodies. Do not create new fixtures."

    Fix (WIP.md brief, append at the bottom): "Write at most two files: tests/unit/import/parser.test.ts and tests/unit/import/lectures.test.ts. Total test code ≤ 400 lines. If you find more than 8 SPEC-GAPs, stop and report them; do not write further tests until the lead has amended the spec. Report the SPEC-GAPs in your final summary; the lead decides how to resolve them."

    Fix (agent file split): Keep spec-test-writer.md (model: sonnet) for the risky modules: engine/replay*, engine/merge, engine/criterion*, engine/queue, engine/session*, engine/status, engine/cram*, engine/planner*, engine/grading*, engine/estimate, engine/value. Add spec-test-writer-haiku.md (model: haiku, same body) for the mechanical modules: transfer/, db/repos/, db/schema.ts upgrades, and import/ helpers that only map data (build-map, lectures, key-words). The import parser itself (import/parser, lexer, completeness, validate: partial replies, early @end, merged lectures) stays on Sonnet. Launch briefs name the model explicitly.

    Why not switch everything to Haiku: Haiku writes equivalent tests for mechanical translation, but under-tests tie-breaks, boundaries and simulation scenarios, which are exactly the tests that caught real bugs in Phases 4, 7 and 8. Sonnet stays where it earns its cost.

    Propagate: CLAUDE.md workflow step 2 — add one line: "Choose the agent by module: spec-test-writer-haiku for plumbing (transfer, repos, migrations, import data-mapping helpers); spec-test-writer (Sonnet) for the import parser, scheduling, replay/merge, grading, planning and simulation." docs/HANDOFF.md "How data works" — add one row for "Spec-test-writer" pointing at this rule.

    Effort: S.

    Status: [x] — commit: (this commit). Evidence matched. Brief cut to the parser's spec sections; Haiku agent added for plumbing; module rule in CLAUDE.md step 2 and HANDOFF.

[ ] 2.2 — Enforce tokens-only for every new screen until DESIGN.md is rewritten

    Where: docs/WIP.md Import v2 checklist (top) and docs/DESIGN.md section 1 (before section 3).

    Evidence: The user has confirmed the design is not built yet: "design.md hasnt been updated yet i will update it later as i changed the design everything is getting a reskin including the courses and import screen." SESSION_NOTES section G records a decided direction and 42 drawn screens, but DESIGN.md's prose has not been rewritten and is not authoritative.

    This item makes no design decision. It only records that the current DESIGN.md cannot be used as a spec, and that new screens must be token-driven so a later rewrite is a token swap rather than a screen rewrite.

    Fix (WIP.md, top of the Import v2 checklist): "UI rule (temporary until DESIGN.md is rewritten): every new screen (routes/import/*, routes/course/[courseId]/*) uses tokens only (src/lib/design/tokens/*, themes/*). No raw hex, no off-scale px, no invented layout. If a component is missing, add it to src/lib/ui/ and to /dev/ui before using it on a screen. Re-theming later must be a token swap only; a screen edit means this rule was broken."

    Fix (DESIGN.md, add before section 3): "Current status (Nov 13): the previous design direction is superseded by the decision recorded in SESSION_NOTES section G. This file describes the previous direction and is being rewritten. Until the rewrite lands, nothing in this file's prose is authoritative; screens must use tokens only. See BUILD_PLAN §10 'Phase status' and CLAUDE.md rule 20."

    Propagate: docs/PROGRESS.md Import v2 entry — note "UI built against current tokens; the design rewrite will be a token swap only." CLAUDE.md rule 20 — add "DESIGN.md is being rewritten; tokens-only applies with extra weight until it lands."

    Effort: S.

    Status: [ ] — commit: _

[ ] 2.3 — SESSION_NOTES section F: record the provisional PDF decision

    Where: docs/SESSION_NOTES.md section F heading and first paragraph.

    Evidence: Section F is headed "OPEN, needs a stress test", but PROMPTS.md section 2 (via WIP.md Import v2 item 3) already recommends PDFs, and WIP.md writes it as a decided tip.

    Fix: Change the section F heading to ## F. Getting slides to the chatbot: provisional — PDFs recommended, stress test outstanding. Add one line after the heading: "Provisional decision (2026-11-13): Import v2 recommends PDF upload on the intake screen; revisit after the section F stress test."

    Propagate: docs/WIP.md Import v2 item 3 — keep as is; it already matches the provisional decision.

    Effort: S.

    Status: [ ] — commit: _

[ ] 2.4 — GAMES.md: separate game misses from weak

    Where: docs/GAMES.md, "Rules for every game".

    Evidence: GAMES.md says "a missed card is flagged weak and reappears more often in later rounds". weak in the Fix pass Decisions log item A6 means "the card's latest credited session was a relearning session with a wrong counting event" and changes cram gap to 1 day. A game miss must not do that.

    Fix: Replace the "Misses are logged" bullet with: "Misses are logged for the games only: a missed card is remembered for the next round (a separate gameMiss flag in the games' own state; it never sets weak and never affects FSRS, cram, or the planner)."

    Propagate: docs/BUILD_PLAN.md section 6.5 — add one line under the weak definition: "weak is never set by games (GAMES.md)."

    Effort: S.

    Status: [ ] — commit: _

[ ] 2.5 — HANDOFF.md: verify checkAccept and passesGuard names

    Where: docs/HANDOFF.md, "How data works" table row for "I was right".

    Evidence: HANDOFF says "'I was right' → checkAccept, append acceptAdded, re-log as correct only if passesGuard." The tree's engine/grading.ts exposes gradeTyped; exercise-check.ts calls it via checkTyped. The names checkAccept and passesGuard may not exist.

    Fix: Open src/lib/engine/grading.ts and src/lib/engine/exercise-check.ts. If the functions exist under different names, update HANDOFF to match. If they do not exist at all, that is a real bug in the Phase 5 "I was right" flow (PROGRESS says the flow was built; likely just naming drift), and it goes into a small follow-up commit before Import v2.

    Propagate: none until verified.

    Effort: S.

    Status: [ ] — commit: _

Tier 3 — Medium (do alongside the next related phase)
[ ] 3.1 — UNVERIFIED_TESTS.md: add a "closed" rule

    Where: docs/UNVERIFIED_TESTS.md, "Rule for every phase".

    Evidence: Six rows, no row is marked closed, and every "Alone" column says "passes" or "passed alone".

    Fix: Add at the end of the "Rule for every phase" section: "A test that passes alone on two consecutive attempts gets marked ✅ with the date. Review the whole list together after Phase 10, or on a CI machine if one is added."

    Propagate: none.

    Effort: S.

    Status: [ ] — commit: _

[ ] 3.2 — PROMPTS.md section 6: align "next button" with "Resume"

    Where: docs/PROMPTS.md section 6, @next / @end row; docs/SESSION_NOTES.md section K.

    Evidence: PROMPTS.md section 6 names "The 'next' button in the import screen". The design notes do not describe one. WIP.md Import v2 item 4 calls it "Resume".

    Fix: In PROMPTS.md section 6, @next / @end row, change "The 'next' button" to "The 'Resume' button, shown when the map reports missing topics". Do NOT edit DESIGN.md (it is being rewritten). Instead add one bullet to docs/SESSION_NOTES.md section K: "Import screen: Resume prompt button, shown when the map reports missing topics (for the DESIGN.md rewrite)."

    Propagate: docs/WIP.md Import v2 item 4 — already says "Resume"; no change.

    Effort: S.

    Status: [ ] — commit: _

[ ] 3.3 — SESSION_NOTES section G: move the decided line to the top

    Where: docs/SESSION_NOTES.md section G.

    Evidence: Section G is long and mostly a design-direction log. The decision is recorded but the next reader has to scroll to find it.

    Fix: Move the "DECIDED (Nov 13): the cozy style is the Snowpack design" line to the top of section G, so the section opens with the conclusion. Keep the rest of section G below as history.

    Propagate: docs/HANDOFF.md "Current state" — add "Design: cozy direction decided (SESSION_NOTES §G); DESIGN.md rewrite pending; screens use tokens only." docs/BUILD_PLAN.md section 10 "Phase status" table already covers this in its Design-status note.

    Effort: S.

    Status: [ ] — commit: _

Tier 4 — Low (housekeeping)
[ ] 4.1 — HANDOFF.md "Current state": point to the phase-status table

    Fix: In docs/HANDOFF.md "Current state", first bullet, replace "Before starting Phase 6, confirm with the user that the phases before it are done" with "Phase order and status are in BUILD_PLAN §10's 'Phase status' table."

    Propagate: none.

    Effort: S.

    Status: [ ] — commit: _

Appendix A — Where a fix goes

Every documentation change must update all of the following in the same commit if any one of them is affected. This is the rule to remember after every edit.
If you change…	Also update
A stored field (name, type, allowed values)	src/lib/db/schemas/<entity>.ts, docs/DATA_MODEL.md, and a Dexie migration in src/lib/db/schema.ts if indexes change
An engine rule (criterion, weight, gap, cap, tie-break)	docs/BUILD_PLAN.md section 6.x, the Decisions log row that introduced it, and the test that asserts it
A tunable number	src/lib/config/defaults.ts, then remove the raw number anywhere else
A phase order or status	docs/BUILD_PLAN.md section 10 "Phase status", docs/HANDOFF.md "Current state"
A phase's spec authority	docs/BUILD_PLAN.md section 10 table row, docs/HANDOFF.md "What each phase reads", docs/PROMPTS.md or docs/SESSION_NOTES.md heading
A test that fails only by timeout	docs/UNVERIFIED_TESTS.md row plus the phase's PROGRESS.md entry
The design	docs/DESIGN.md, src/lib/design/tokens/*, /dev/ui, and the "Phase status" design-status note
An agent's model or scope	.claude/agents/<agent>.md, CLAUDE.md workflow step, and the current WIP.md brief
An import directive or parser rule	docs/PROMPTS.md section 7, docs/DATA_MODEL.md (if the payload changes), the fixtures in tests/fixtures/import/ and the parser tests that use them
An event field	src/lib/db/schemas/event.ts, docs/DATA_MODEL.md section 3.6, and replay-card.ts or criterion-history.ts if it affects replay

The rule in one sentence: if a fact lives in two places, both must be edited in the same commit, and the commit message names both.
Appendix B — What spec-test-writer is allowed to do

Restated here so a fresh session has one place to look.

    Reads: the spec sections the brief names, the exported signatures of the module under test and of modules it depends on, existing tests, and tests/ fixtures. Never implementation bodies.

    Writes: tests only, under tests/. Never production code.

    Runs: the tests it writes, in its own session, per the user's instruction. The lead does not run them.

    Reports: a table of spec rule to test name, every SPEC-GAP it raised, and a summary of pass and fail. The report is a summary, not the test output. The test output itself stays in the agent's session; the lead relies on the summary and on test-results/summary.md.

    Caps: at most two files per launch, 400 lines of test code per file. If more than 8 SPEC-GAPs, stop and report.

    Model: spec-test-writer-haiku for transfer/, db/repos/, migrations and import data-mapping helpers; spec-test-writer (Sonnet) for the import parser, scheduling, replay and merge, grading, planning and simulation.

End of audit. When every checkbox is [x] with a commit hash and every Propagate edit has landed, delete this file in a commit named docs: complete project audit.