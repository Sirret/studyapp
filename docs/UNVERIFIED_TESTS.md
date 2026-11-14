# Unverified tests

Tests that failed by **timeout or under load** and passed on a rerun, so a real bug isn't proven or ruled out. A test failing on a wrong value or a missing element is a bug: fix it in its phase, never log it here. This list is rerun and fixed in the final phase.

**Logging an entry:** add a row when a timeout-type failure isn't reproducible in its phase. Note what was checked (e.g. "also fails on the previous commit"). Never skip, delete or loosen the test (rule 15); it keeps running as normal.

**Final phase:** rerun only these, e.g. `npx playwright test -g "<name>" --repeat-each=5`. Read the trace, fix the cause, and delete the row in the commit that fixes it.

| First seen | Phase | Test (file › name) | Project | Failure | What was checked | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-14 | 8.5 | `course-map.spec.ts` › sample course opens with its course map | both | Test timeout 30 s; "Tearing down context exceeded the test timeout" | Also fails on base commit `acf4307` (stash check); fails on the 2nd `--repeat-each` | Open |
| 2026-11-14 | 8.5 | `import.spec.ts` › resizes an occlusion image to WebP and stores it once | mobile | "Attached: slide.png, copy.png" not visible within 5 s | Also fails on base commit `acf4307` | Open |
| 2026-11-14 | 8.5 | `import.spec.ts` › works with no network once the app has loaded | both | Test timeout 30 s waiting for the "Added 1 note" status | Also fails on base commit `acf4307`; fails on the 2nd `--repeat-each` | Open |
| 2026-11-14 | 8.5 | `tests/unit/services/study-service.test.ts` › plays the harness session to the end | unit | Failed once in a full run (likely a timeout under load); name not captured the 2nd time | Passed 20+ reruns | Open |
