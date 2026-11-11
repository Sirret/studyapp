# WIP — Phase 8: Planner

**Task:** BUILD_PLAN §10 row 8 — availability calendar, estimator (exists: `engine/estimate.ts`), processor-demand check, cuts, least-laxity split, daily re-plan, shortfall UI. Done when: §6.9 tests; a 4-exams-in-one-week simulation gives a feasible-or-flagged, deterministic plan.
**Spec:** BUILD_PLAN §6.9 (+ §6.6 "The plan, concretely", which the planner now feeds), CONCEPT §10–§11, DATA_MODEL §5 (`availability` kv already exists with `AvailabilitySchema` and `DEFAULT_AVAILABILITY`; no stored-field changes planned). DESIGN §6 Today and Plan.
**After Phase 8:** tell the user Phase 8.5 is next before starting anything else (HANDOFF).

## Design (decided, record in the Decisions log at the end)

1. Engine, pure, `Traced`: `planner-work.ts` (types; `itemMinutes`, `itemValue`, `courseWork`, `demandCheck`), `planner-cuts.ts` (`planCuts`), `planner-split.ts` (`dailySplit`), `planner.ts` (`planDays`, re-exports).
2. Items per course: review **card** (standing from cram `triage`, `rExam`) or acquisition **unit** (`learnMinutes` = unit cost, plus its cards as `new` cards: the next-day retest still needs k corrects).
3. Value = `PRIORITY_WEIGHT × max(0, retention − R_exam)`; a unit = weight × retention × its card count (R_exam = 0). Ratio = value ÷ minutes at the current knobs. Ties by course ID, then item ID.
4. Work per course = ceil(Σ item minutes × `SAFETY_MARGIN`); day minutes floored to whole minutes.
5. Processor demand: exams sorted by (exam day, course ID); supply_k = Σ day minutes for days today..examDay_k − 1 + `examMorningMinutes`.
6. Cuts: for the first failing exam, courses with exam day ≤ it: criterion → `CRITERION_FIRST_DEGRADED`, then K down by one (all of them) to 1, then remove lowest-ratio items until it passes; then the next failing exam. Cuts are **suggestions** shown in the UI; sessions still use the cram plan's own degrading.
7. Split: days today..last exam day − 1. Active = exam day > d and remaining > 0. Floor = min(`DAILY_FLOOR_MIN`, floor(cap/|active|), remaining). Blocks = min(`BLOCK_MIN`, cap left, remaining) to least laxity (laxity = cap left today + Σ later caps before its exam − remaining); ties earlier exam, then ID. Uses work after cuts.
8. Only courses with an exam today or later are planned; long-term courses (no exam ahead) stay outside the split (CONCEPT §10 "its time goes to the rest").
9. Today's capacity = availability − minutes already studied today (Σ `responseMs` of today's events). Nothing stored: the plan is re-derived on every read, which is the daily re-plan.
10. Cram per course gets `dayMinutes[d]` = its split minutes + the day's free minutes; acquisition/one-night use the same share.

## Steps

- [x] 1. Interface: engine signatures (stubs) + WIP + §6.9 "The planner, concretely" — committed (see git log)
- [ ] 2. `spec-test-writer` on planner engine + 4-exam sim
- [ ] 3. Implement engine until green
- [ ] 4. `PlannerService` (+ tests), feed CoursePlanService
- [ ] 5. Screens: Today rewrite, `/planner` (availability editor, week bars, feasibility), components in `/dev/ui`; e2e
- [ ] 6. `npm run verify`
- [ ] 7. `reviewer` (Sonnet) on diff since 2be30c1
- [ ] 8. Docs: Decisions log, HANDOFF, PROGRESS; delete WIP

## Agent briefs

(filled in when launched)
