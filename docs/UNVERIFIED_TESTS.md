# Unverified tests

Tests that fail intermittently on the development laptop (an HP 440 G6, slow for many parallel browsers) **only by running out of time**, while passing on their own. User's call (2026-11-08): log them here, keep going, and review the whole list **after Phase 10** (on CI or a faster machine).

## Rule for every phase

- A `verify` whose only failures are timeouts of the kinds below may be closed: log each one here and note it in that phase's PROGRESS entry.
- **Anything else is not loggable:** a check that gets a wrong value, an error in the app, a crash. Those are bugs; fix them.
- Before logging, run the test on its own (`npx playwright test <file> --project=<p> -g "<name>"`) and record the result.
- Local e2e already runs with 2 workers and no video (`playwright.config.ts`) to reduce the load.

## Log

| Date | Phase | Test (project) | What happened | Alone | Kind |
| --- | --- | --- | --- | --- | --- |
| 2026-11-08 | 5 | `import.spec.ts` › the course survives a reload, and a later import adds to its topic (mobile) | Once the course picker had no value within 5 s after the reload; once the whole test passed the 30 s limit, ending in the correct state ("Added 1 notes and 1 cards across 1 topics") | 4 of 5 passed (`--repeat-each 5`) | slow machine: two imports + a reload in 30 s |
| 2026-11-08 | 5 | `import.spec.ts` › resizes an occlusion image to WebP and stores it once (mobile) | Ran out of time while encoding under full-suite load (also seen once before Phase 5) | passes | slow machine: image encoding |
| 2026-11-08 | 5 | `logging.spec.ts` › records that the app started (laptop) | Closing the browser ("Tearing down context") exceeded the limit after its checks | passes | teardown under load |
| 2026-11-08 | 5 | `pwa.spec.ts` › shows the app name with no sideways scroll (laptop) | Teardown exceeded the limit after its checks | 5 of 5 passed | teardown under load |
| 2026-11-08 | 5 | `import.spec.ts` › is reached from the home screen; copies the chatbot prompt (mobile) | Teardown exceeded the limit after their checks, while the long session tests ran alongside | 14 of 14 passed | teardown under load |
| 2026-11-10 | 7 | `import.spec.ts` › resizes an occlusion image to WebP and stores it once (laptop) | In `verify` the "Attached: …" line didn't show within 5 s (encoding two 3200 px PNGs under full-suite load); with `--repeat-each 3` and 2 parallel workers it failed 3 of 3 the same way. Phase 7 changed no import code | passed alone 1 of 1 and 3 of 3 with `--workers 1`; also passes on mobile | slow machine: image encoding |
