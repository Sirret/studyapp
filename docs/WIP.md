# WIP — Pre-review step (before the UX review; before Phase 9)

## Checkpoint log

| Date | Phase | Step | Model | What was done | Files | Next | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-24 | Pre-review | 1–4 | Opus 5.5 | docs/memory, 1-worker verify + e2e-verify.json, occlusion revive, /dev/seed | 27 | verify, prune UNVERIFIED rows, checkpoint | 25a7ade |

## Task (user brief, 2026-11-24)

A small step before the user's UX review. Checkpoint like any phase step; **push only after the user confirms.**

1. **Docs:** Android install IS in Phase 10's done-when (fix the BUILD_PLAN Decisions row ~1039 that says otherwise); BUILD_PLAN §10 row 10 deploy = GitHub Pages; mark SESSION_NOTES §A11 and §B D2/D3 as shipped in 8.6; memory notes (reviewer runs every phase per CLAUDE.md; drop the Phase 6 note).
2. **Tests:** e2e with 1 worker in verify (and CI). Verify's e2e writes its own results file (`test-results/e2e-verify.json`) so a later partial run (`test-results/e2e.json`) can't overwrite verify counts in summary.md. Re-run the UNVERIFIED_TESTS rows at 1 worker and remove the ones that pass.
3. **Bug:** clearing an occlusion box label must not restart that card's history (box ID stays, card kept). Test it.
4. **/dev/seed** (test builds only, `__DEV_ROUTES__`): "Rich" seed (~6 courses from golden texts incl. figures: occlusion with `box:` lines, a stack and a flow diagram; staggered exam dates; a few days of synthetic events from a fixed seed), "Shelf stress" seed (50 small courses, varied/very long titles, varied exam dates, some none), "Wipe local DB" button. Own e2e test.
Then print start commands + URL and CHECKPOINT.

## Decisions taken (to write into the Decisions log)

- Bug 3: card regen revives the tombstoned `box:<id>` card of an occlusion note when that box is named again (same card ID, replayed), instead of a new card. Only occlusion: its variants carry stable box IDs; positional variants (cloze `c2`, …) are not revived.

## Checklist

- [x] 1 docs + memory (memory: reviewer note rewritten, phase-order note deleted, Android note updated)
- [x] 2 playwright workers=1 via E2E_VERIFY, e2e-verify.json, summary lists partial run apart, CI timeout 35
- [x] 3 occlusion revive + tests (card-regen.test.ts tombstones block; figure-services.test.ts relabel test)
- Decisions rows written (3 "Pre-review step" rows at the end of BUILD_PLAN); HANDOFF 6-review line updated
- [x] 4 /dev/seed + e2e: `services/dev-seed-plan.ts` (pure, `tests/unit/services/dev-seed-plan.test.ts`), `services/dev-seed.ts`, `routes/dev/seed/`, `tests/e2e/seed.spec.ts` (2 passed, 45 s, 1 worker); deploy build checked: no seed module or golden text in `build/`. Decisions row + HANDOFF line written.
- verify run 1 (after 25a7ade) stopped at unit: diagram-text stack property drew ["a","A"] → generator distinct by nodeKey (Decisions row); scope-service timeout → UNVERIFIED row
- [ ] full `npm run verify` run 2 (1 worker) (log: scratchpad verify.log; if lost, just rerun `npm run verify`); its results = the 1-worker rerun of UNVERIFIED rows
- [ ] rerun UNVERIFIED rows at 1 worker, prune
- [ ] commit, checkpoint
