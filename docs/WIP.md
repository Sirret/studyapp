# WIP — UX-review bug-fix step (before the UX/UI pass; before Phase 9)

**Not pushed:** the Pre-review step (commits 0ecff02…9ed20b2) and this step wait for the user's OK to push. Pushing deploys the live site.

## Checkpoint log

| Date | Phase | Step | Model | What was done | Files | Next | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-24 | Pre-review | verify + prune | Opus 5.5 | Pre-review step done (seed, revive, 1-worker verify) | 6 | this bug-fix step | 9ed20b2 |

## Task (user brief, 2026-11-24; source: UX review on build:test preview + /dev/seed)

Fix only these; no redesign, no new screens, no style changes beyond what a fix needs. Checkpoint like a phase step; push only after the user confirms.

1. **Figure cards unreachable.** A topic with only diagram/occlusion notes (seed "Database storage II (final)") shows Learn "Nothing to read", Practice "No cards yet", /practice "No cards to practise yet". Practice must include figure cards (flashcard deck + quick quiz, with their figure exercises). Learn: a topic's figure notes after its sections (or as their own step when no sections). Door counts include them. Tests.
2. **Exam plan contradicts itself.** "Networks and databases" Exam prep: "19 cards · ~6 min", then "8 min short…", then "Some new cards are left out (1 new cards wait…)"; Home "about 2 h short (68 min) … cut 0 pieces". Root cause (shortfall sign, which number, min vs h rounding). Fits → say so, cut nothing; doesn't fit → shortfall and cuts agree. Plurals. Unit tests fits / doesn't / exactly fits; Home and Exam prep show the same numbers.
3. **Delete one tap away** on every Shelf card. Move course delete to the course page (or a "…" menu); always confirm naming the course and what is lost (cards, history); existing Sheet, no browser dialog.
4. **Import pre-selects first course.** Default "New course" unless coming from a course page (then that course). Courses most recently used first. Test.
5. **Reader key terms empty** on the sample course (no key-term elements). Find why (likely "In <subject>, …" prefix). Strip prefix, case-insensitive, word boundaries; starred key words count. Also: desktop 3-column reader (≥1024 px) shows one column with the tip below — why. Tests for matching.
6. **Small:** "Exam date" label twice on /course/[id]/exam; Yuki "z z" read as text (hide decorative SVG text); mode doors announce ", has work" (proper accessible name); "Coming soon · Phase 11" stamp overflows the Play door.

Then: test tiers, `npm run build:test`, e2e for touched screens, PROGRESS entry, CHECKPOINT, stop.

## Decisions taken (to write into the Decisions log)

(none yet)

## Checklist

- [x] 1 figure cards: root cause isStudyable() pre-Phase-6 filter; Learn `figures` step; deck figure; flipAnswer whole-diagram; door counts; tests (learn-flow-topic, doors, practice-service, exercise-edges)
- [x] 2 exam plan: planner afterCuts + PlanFitView (fitOf/courseShares) for Home and Exam prep via ui/plan/fit-text.ts; cram share + all free minutes; durationText; tests; e2e planner.spec text updated
- [x] 3 delete: DeleteCourse.svelte on course page (Sheet), shelf × removed; e2e course-delete.spec.ts (not yet run)
- [x] 4 import picker: New course default, ?course= from course pages, recentFirst; unit (course-order, repos) + e2e import.spec (not yet run)
- [x] 5 reader: sectionTerms (prefix strip, keyWords, cloze answers); Learn Screen wide on read; Reader 2 columns from 700px container; reader-terms.test.ts
- [ ] 6 small a11y/layout fixes
- [ ] tests, build:test, e2e touched specs, PROGRESS, checkpoint
