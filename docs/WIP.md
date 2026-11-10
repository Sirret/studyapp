# WIP — Phase 7 (Modes)

**Task:** Phase 7 of `BUILD_PLAN.md` §10: long-term, cram (incl. fragile), acquisition (full/quick, pretest, chunk quiz, handoff, split flag), one-night. Done when: sim tests for D = 1…7; acquisition handoff produces next-day retests; statuses correct.
**Spec:** BUILD_PLAN §6.6–§6.8 (and the estimator formula in §6.9), CONCEPT §7–§9, Decisions log. Phase order is 5 → 7 → 8 → 8.5 → 6 → 9 → 10.

## Already in place (don't rebuild)

- Replay already caps massed-mode stability and sets/clears `fragile` (`engine/replay-card.ts`, Decisions rows on fragile), and `credited: false` events give no FSRS or criterion credit.
- The queue counts every answer toward the session's `required`, whatever `credited` says; credit only matters to replay.
- `StudyService.startCourse` runs a Phase 5 practice session (`practiceCards`); the modes replace that.

## Design decided (write into BUILD_PLAN §6.6–§6.8 + Decisions log at the end)

1. **Estimator** `engine/estimate.ts` built now (Phase 8 reuses it): §6.9 per-card formula; `materialOf(noteType)`; seconds per attempt from calibration, else `SEC_PER_ATTEMPT` via a kind → key map, else `SEC_PER_ATTEMPT_DEFAULT`.
2. **Cram plan** `planCram`: days are relative, today = 0, exam day = D. Sessions on days 0..D−1 are evening sessions that end at the sleep window's start; day D−1 is the final pass (every in-scope card); day D has the morning top-up starting at the sleep window's end, `examMorningMinutes` long. **D = 1 shape:** one final-pass evening (new cards included, since D < 3) + morning top-up. **D = 2 shape:** day 0 evening (at-risk + new), day 1 final pass, day 2 morning top-up. At-risk and newly introduced cards come back after `nextGap` days, weak cards every day, at most K sessions before the final pass. New cards: `newPerDay`, introduced on days 0..D−2 when D ≥ 3, else on day 0. NEW_SHARE_MAX cap: new trials (new × criterion) ≤ NEW_SHARE_MAX × the session's trial capacity (minutes × 60 / seconds per attempt). Feasibility per day: session minutes × SAFETY_MARGIN ≤ that day's minutes. Degrade in order: criterion 3 → 2, K down to 1, then defer new cards by lowest value/minute (ties by ID). Still short → `feasible: false` with the shortfall.
3. **nextGap** upper bound is `max(1, daysRemaining − 1)` (the spec's clamp is empty at 1 day).
4. **Acquisition units:** one per chunk (its notes' cards), plus one per topic for notes with no chunk (no read step), after the topic's chunks. Steps: pretrain (keyterm cards) → pretest (full path, setting on, not hidden; up to PRETEST_MAX fact then cloze cards) → read (if a chunk) → quiz (non-keyterm cards; `cloze` if on the path, else `sequence`, else the path's current kind; recall-format cards first). Pretrain and quiz cards need `ACQ_STEP_REQUIRED` (1) correct; all `mode: 'acquisition'`, `credited: false`.
5. **Handoff in replay:** a card with acquisition reviews and no FSRS state gets `due` = start of the next study day after its last acquisition review (fsrs stays null; the retest is its first FSRS review).
6. **Ordering:** unread topics, not reported chunks; depth = priority high first, then topic order, then chunk order; breadth (deadline + setting) = first unit of each high-priority topic first, then the rest in depth order.
7. **Mode choice** `engine/mode-select.ts` → review mode + learn mode for today: no exam, past exam, or > `CRAM_MAX_DAYS` (7) away → longterm; 1..7 days → cram; exam tomorrow with unread material → learn = onenight; else unread → acquisition.
8. **Long-term session cards:** due (`due ≤ now`, not unseen) by due then ID, plus up to `LONGTERM_NEW_PER_DAY` unseen cards of read topics in course order.
9. **One-night:** units by value/minute (PRIORITY_WEIGHT / minutes) desc, ties easier first (higher p0), then ID; greedy fit within available − break − block-2 cost; block 2 and morning = all chosen cards, round-robin across units.

## Checklist

- [x] 1. Interfaces + config + WIP + spec text in BUILD_PLAN §6.6–6.8 and Decisions rows — written and staged, **not committed**: the pre-commit hook failed on two load timeouts (merge commutativity property, study-service list). Commit together with step 2–3 (CLAUDE.md trap about `vitest --changed`).
- [x] 2. spec-test-writer (report in: 215 tests / 10 files + `tests/unit/engine/cram-fixtures.ts`; 214 passed first run; 16 SPEC-GAPs settled in one Decisions row; gap 6 changed §6.6 to drop empty evenings — agent re-asked to update only that sim test; gap 7 fixed in code: minutes summed in card-ID order)
- [x] 3. (commit 37a66d1, with steps 1–4) Engine implemented; all 215 agent tests + sim pass (agent updated the 2 tests after gaps 6/7). Agent is done; no relaunch needed.
- [x] 4. Services written (not yet tested): `StudyService.startPlanned` + `credited` from session mode (acquisition → false), `StudyView.mode`; `services/course-plan.ts` (engine inputs), `course-learn.ts` (units, one-night, split prompts), `course-plan-service.ts` (`CoursePlanService`: today, setExam, startReview, learnUnit, startLearnStep, startBlockTwo, finishQuiz), `course-types.ts` (UI view types), wired as `coursePlanService` in `study-wiring.ts`; `isStudyable` in study-course; `DEFAULT_AVAILABILITY` in kv.ts; date helpers in time.ts. TODO: service unit tests.
- [x] 4b. Services tests: tests/unit/services/course-plan-service.test.ts (5) mode wiring (review/learn per course, credited false for acquisition), split flag write
- [~] 5. UI written (no e2e yet): `/course/[courseId]` (+ `ExamForm`, `PlanCards`), `/learn/[courseId]/[unitKey]` (steps via `?step=`, `?quiz=<sessionId>` → `finishQuiz`), study page `?back=` + mode-specific summary line, Today has "Plan and learn" link. Sleep reminder on course page after `?done=`. e2e tests/e2e/modes.spec.ts (2, pass on mobile); session loop moved to tests/e2e/play-session.ts. No new shared components, so no /dev/ui entries. UI: course page (exam date/format, Review / Learn / One-night buttons), learn flow (cost + progress strip, read step), one-night labels + sleep reminder; `/dev/ui` entries; e2e
- [ ] 6. Docs: BUILD_PLAN §6.6–6.8 + Decisions, DATA_MODEL `due` note
- [ ] 7. `npm run verify`; reviewer (Sonnet, diff since 05ba8e5); HANDOFF, PROGRESS; delete WIP

## Agents

- `spec-test-writer` launched (background) for estimate, cram (+ sim `tests/sim/cram-plans.test.ts`), acquisition, onenight, mode-select, replay handoff (`tests/unit/engine/replay-handoff.test.ts`). It owns those test files under `tests/`. Brief: test from BUILD_PLAN §6.6 (incl. "The plan, concretely"), §6.7 (Units, Steps, Handoff, Mode choice), §6.8 (Concretely), §6.9 estimate block, DATA_MODEL §4.1, CONCEPT §8, Decisions rows "Phase 7: …"; constants by name; ties by ID; determinism incl. trace; files ≤ 300 lines; SPEC-GAP comments + list; don't commit.
- Implementing in parallel (bodies only, not reading the agent's tests until it reports): **all engine bodies written** — `estimate.ts`, `cram-basics.ts` (types, triage, order, gap, newPerDay, morningTopUp; `cram.ts` re-exports it), `cram.ts` (`planCram` + degrade), `acquisition.ts`, `onenight.ts`, `mode-select.ts`, `time.startOfStudyDay`, replay handoff in `replay-card.ts` (`dueOf`). Typecheck + lint clean. Phase 4 test `replay-caches.test.ts` "never touches FSRS with uncredited answers" updated to the handoff rule (due = next study day; Decisions row covers it).
