# WIP — Phase 5: Design system & exercises UI

Live checkpoint (CLAUDE.md rule 21). Delete in the commit that finishes Phase 5, after HANDOFF.md absorbs what Phase 6 needs.

## Task and where the spec lives

User's request (2026-11-07): merge the design addendum (done, `65bc10f`), then do Phase 5 following the CLAUDE.md workflow, **building the layers in order (tokens → themes → primitives → components → delight → layout → exercises) and adding each piece to `/dev/ui` as you go**.

Spec: `BUILD_PLAN` §3.3, §5, **§5.1 (new: exercise specs)**, §9, §10 row 5; `DESIGN` in full (esp. §3, §5, §7, §11–13); `CONCEPT` §4–6. Decisions log rows marked "Phase 5".

Done when (§10): contrast test passes in both themes; `/dev/ui` shows every component and Yuki state; Playwright completes a session on a mobile viewport using each exercise kind (non-diagram kinds; diagram kinds are Phase 6), with reduced motion on and off. Plus DESIGN §13.4 visual regression screenshots of `/dev/ui`.

No reviewer this phase (Decisions log: reviewer only at the end of Phases 7–9).

## Architecture decided (see Decisions log rows "Phase 5")

- `engine/exercise-spec.ts` builds an `ExerciseSpec` (discriminated on `shape`) from the current card; `engine/exercise-check.ts` grades an `ExerciseResponse`. UI can't import the engine, so `services/study-service.ts` (`StudyService`) builds the spec for the current item, grades, logs through `SessionService`, and re-exports the types for UI.
- `SessionService.answer` logs `selfRated` events for self-rated kinds and `pretest` events for `pretest`, applying them to the queue as `none` weight.
- "I was right": `acceptAdded` with `reviewEventId` re-judges that review as correct in replay; `note.accept[variant]` grows via `NoteRepo`.
- Styling: Svelte scoped styles + CSS custom properties; layers per DESIGN §13.2. Stylelint guards raw values.
- Visual regression: `toHaveScreenshot` locally; `ignoreSnapshots` on CI until Linux baselines exist.

## Checklist

- [x] Docs: addendum merged, haptics setting (`65bc10f`). Icons side task (`ff41e1e`).
- [x] BUILD_PLAN §5.1 written; config values added (`PARSONS_EXTRAS`, `MATCHING_PAIRS`, `ITEM_ROWS_SHOWN`, `BLURT_TITLE_CHARS`, `PRACTICE_SESSION_CARDS`).
- [x] Step 1 interfaces (`908b7e7`).
- [x] Step 2: agent wrote 219 tests (`exercise-spec.test.ts` 165, `exercise-check.test.ts` 45, `replay-accept.test.ts` 9, helper `exercise-fixtures.ts`); all fail only on not-implemented. 13 SPEC-GAPs settled in the Decisions log (only change: new `TypeSpec.otherPrompts`). UNCOMMITTED: the pre-commit hook runs these failing tests, so commit them with the implementation.
- [x] Step 3: engine implemented, all agent tests pass unchanged (`639c373`).
- [x] SessionService selfRated/pretest events; StudyService + study-wiring.ts + dev-wiring.ts (startSampleSession) + dev-sample.ts; study-service.test.ts plays all 22 kinds (`3919e76`).
- [x] Layer 1–3: tokens (base, semantic), themes light/dark (+ auto-night), `tokens.ts` mirror, contrast unit test, fonts (Nunito, Caveat) self-hosted.
- [x] Layer 4–5: primitives (Button, Card, Chip, Input, Toggle, Checkbox, Icon) + motifs (Paw, Snowflake, Moon).
- [x] /dev/ui skeleton: `src/routes/dev/ui` (404 unless __DEV_ROUTES__), sections in `src/lib/ui/styleguide/` (GuideSection renders light+dark panes, data-guide-section ids). Tokens + Primitives sections done. Screenshot helper: scratchpad shot.mjs (copy into repo root to run; serve with `node scripts/serve-build.ts --port 4173` after `npm run build:test`).
- [x] Layer 6 components + Yuki (components/yuki/: Yuki.svelte, YukiProps.svelte, yuki.ts YUKI_STATES) and their /dev/ui sections. Extra components: TapChip, Slot (tap-to-place), PhaseInterstitial (timer PHASE_INTERSTITIAL_MS), SessionSummary (figure/footer snippets for count-up and paw walk). Deferred: ExamCountdown (Phase 8 Today), Segmented/Slider (Settings screen). Was: components (OptionButton, ProgressStrip, ProgressDots, PhaseLabel, ReadinessRing, StatusBadge, StickyNote, FeedbackPanel, Sheet, EmptyState, SpeechBubble, Banner, RoundSummary, ExerciseCard, WordBank, Yuki + states).
- [x] Layer 7 delight: delight.ts (effectOn(effect, companion), hapticTick), SnowBurst, SnowFlurry, PawStamp, CountUp, PawWalk, PawLoader, PawPressLayer; DelightGuide in /dev/ui.
- [x] Layer 8 layout (`0b02a45`): Screen (top/bottom snippets, safe areas), Stack, Row, Grid, TopBar, BottomNav (fixed prop). SafeArea folded into Screen. Was: layout (Screen, Stack, Grid, TopBar, BottomNav, SafeArea).
- [x] Layer 9 (`3919e76`): src/lib/exercises/{Type,Choose,ChooseMany,Order,Pair,Sort,SelfRate,Study}Exercise.svelte + Exercise.svelte dispatcher: props { spec, verdict, response (bindable, null until complete), onsubmit }; data-option-index / data-item-index / data-slot-index / data-check-index / data-rating / data-reveal / data-exercise-input hooks for e2e. Added StepList component (layer 6; add to ComponentsGuide).
- [x] Screens: `/study/[sessionId]` (+page.svelte controller, SessionTop.svelte), Today `/` (course list → Practise), `/dev/session` harness. Smoke-tested in a browser at 360 px. Button gained size="icon".
- [~] e2e tests/e2e/session.spec.ts written (dev hooks window.__snowpackExercise + __snowpackStep). Fixed two real bugs it found: empty sticky bottom bar covering feedback (study page passes bottom only when checkable) and ProgressStrip runner widening the page (now cqw + overflow-x: clip). LAST RUN NOT CONFIRMED: rerun > snowpack-study@0.0.1 build:test
> vite build --mode test

[36mvite v8.3.6 [32mbuilding ssr environment for test...[36m[39m
transforming...
✓ 4700 modules transformed.
rendering chunks...
computing gzip size...
.svelte-kit/output/server/.vite/manifest.json                                     8.53 kB │ gzip:  1.18 kB
.svelte-kit/output/server/_app/immutable/assets/Paw.DYV2z3bY.css                  0.04 kB │ gzip:  0.06 kB
.svelte-kit/output/server/_app/immutable/assets/Screen.CAa4yJhW.css               0.95 kB │ gzip:  0.37 kB
.svelte-kit/output/server/_app/immutable/assets/_page.BdjDGBL1.css                0.95 kB │ gzip:  0.36 kB
.svelte-kit/output/server/_app/immutable/assets/Card.CfkjH0R5.css                 1.40 kB │ gzip:  0.49 kB
.svelte-kit/output/server/_app/immutable/assets/Button.CDG55BWT.css               2.20 kB │ gzip:  0.72 kB
.svelte-kit/output/server/_app/immutable/assets/_page.CMXUoic2.css                7.26 kB │ gzip:  1.84 kB
.svelte-kit/output/server/_app/immutable/assets/Chip.9LQLd5_5.css                 8.29 kB │ gzip:  1.96 kB
.svelte-kit/output/server/_app/immutable/assets/_layout.Do65wn2b.css             11.53 kB │ gzip:  3.26 kB
.svelte-kit/output/server/_app/immutable/assets/PhaseInterstitial.VNCRer9Q.css   16.35 kB │ gzip:  3.46 kB
.svelte-kit/output/server/chunks/index-server.js                                  0.03 kB │ gzip:  0.05 kB
.svelte-kit/output/server/chunks/paths.js                                         0.03 kB │ gzip:  0.05 kB
.svelte-kit/output/server/entries/pages/_layout.ts.js                             0.13 kB │ gzip:  0.12 kB │ map:   0.29 kB
.svelte-kit/output/server/entries/pages/study/_sessionId_/_page.ts.js             0.19 kB │ gzip:  0.16 kB │ map:   0.37 kB
.svelte-kit/output/server/entries/pages/dev/ui/_page.ts.js                        0.20 kB │ gzip:  0.20 kB │ map:   0.37 kB
.svelte-kit/output/server/chunks/server.js                                        0.21 kB │ gzip:  0.14 kB │ map:   0.56 kB
.svelte-kit/output/server/entries/pages/dev/session/_page.ts.js                   0.22 kB │ gzip:  0.19 kB │ map:   0.39 kB
.svelte-kit/output/server/env.js                                                  0.29 kB │ gzip:  0.18 kB │ map:   0.57 kB
.svelte-kit/output/server/chunks/navigation.js                                    0.59 kB │ gzip:  0.28 kB │ map:   1.19 kB
.svelte-kit/output/server/chunks/Paw.js                                           0.80 kB │ gzip:  0.46 kB │ map:   1.13 kB
.svelte-kit/output/server/chunks/Screen.js                                        0.86 kB │ gzip:  0.37 kB │ map:   2.18 kB
.svelte-kit/output/server/chunks/Card.js                                          0.97 kB │ gzip:  0.50 kB │ map:   3.62 kB
.svelte-kit/output/server/entries/fallbacks/error.svelte.js                       1.06 kB │ gzip:  0.42 kB │ map:   2.58 kB
.svelte-kit/output/server/chunks/preferences.svelte.js                            1.37 kB │ gzip:  0.71 kB │ map:   3.71 kB
.svelte-kit/output/server/entries/pages/dev/session/_page.svelte.js               1.45 kB │ gzip:  0.60 kB │ map:   1.19 kB
.svelte-kit/output/server/chunks/tokens.js                                        1.50 kB │ gzip:  0.71 kB │ map:   5.24 kB
.svelte-kit/output/server/chunks/Button.js                                        1.56 kB │ gzip:  0.67 kB │ map:   4.67 kB
.svelte-kit/output/server/entries/pages/_page.svelte.js                           1.63 kB │ gzip:  0.66 kB │ map:   3.85 kB
.svelte-kit/output/server/index.js                                                2.28 kB │ gzip:  0.90 kB │ map:   3.32 kB
.svelte-kit/output/server/entries/pages/_layout.svelte.js                         2.28 kB │ gzip:  0.92 kB │ map:   5.56 kB
.svelte-kit/output/server/chunks/app.js                                           6.48 kB │ gzip:  2.92 kB │ map:  31.85 kB
.svelte-kit/output/server/chunks/Chip.js                                          9.31 kB │ gzip:  2.78 kB │ map:  20.37 kB
.svelte-kit/output/server/entries/pages/import/_page.svelte.js                   12.43 kB │ gzip:  4.05 kB │ map:  20.05 kB
.svelte-kit/output/server/chunks/server-errors.js                                23.96 kB │ gzip:  4.49 kB │ map:  34.73 kB
.svelte-kit/output/server/entries/pages/study/_sessionId_/_page.svelte.js        29.03 kB │ gzip:  5.42 kB │ map:  39.41 kB
.svelte-kit/output/server/chunks/PhaseInterstitial.js                            29.52 kB │ gzip:  7.18 kB │ map:  64.62 kB
.svelte-kit/output/server/entries/pages/dev/ui/_page.svelte.js                   43.32 kB │ gzip:  8.23 kB │ map:  63.05 kB
.svelte-kit/output/server/chunks/server2.js                                      48.01 kB │ gzip: 13.45 kB │ map: 127.70 kB
.svelte-kit/output/server/remote-entry.js                                        54.27 kB │ gzip: 11.81 kB │ map:  89.76 kB
.svelte-kit/output/server/chunks/import-wiring.js                                59.02 kB │ gzip: 17.18 kB │ map: 124.50 kB
.svelte-kit/output/server/chunks/internal.js                                     92.52 kB │ gzip: 25.29 kB │ map: 196.98 kB
.svelte-kit/output/server/chunks/dev-wiring.js                                  114.22 kB │ gzip: 33.44 kB │ map: 238.94 kB
.svelte-kit/output/server/chunks/instance.js                                    117.97 kB │ gzip: 31.90 kB │ map: 240.02 kB

[32m✓ built in 30.32s[39m
Analysing routes
Building app
[36mvite v8.3.6 [32mbuilding client environment for test...[36m[39m
transforming...
✓ 4878 modules transformed.
rendering chunks...
computing gzip size...
.svelte-kit/output/client/_app/version.json                                       0.02 kB │ gzip:  0.04 kB
.svelte-kit/output/client/manifest.webmanifest                                    0.71 kB
.svelte-kit/output/client/.vite/manifest.json                                    11.31 kB │ gzip:  1.64 kB
.svelte-kit/output/client/_app/immutable/assets/Paw.DYV2z3bY.css                  0.04 kB │ gzip:  0.06 kB
.svelte-kit/output/client/_app/immutable/assets/Screen.CAa4yJhW.css               0.95 kB │ gzip:  0.37 kB
.svelte-kit/output/client/_app/immutable/assets/5.BdjDGBL1.css                    0.95 kB │ gzip:  0.36 kB
.svelte-kit/output/client/_app/immutable/assets/Card.CfkjH0R5.css                 1.40 kB │ gzip:  0.49 kB
.svelte-kit/output/client/_app/immutable/assets/Button.CDG55BWT.css               2.20 kB │ gzip:  0.72 kB
.svelte-kit/output/client/_app/immutable/assets/4.CMXUoic2.css                    7.26 kB │ gzip:  1.84 kB
.svelte-kit/output/client/_app/immutable/assets/Chip.9LQLd5_5.css                 8.29 kB │ gzip:  1.96 kB
.svelte-kit/output/client/_app/immutable/assets/0.Do65wn2b.css                   11.53 kB │ gzip:  3.26 kB
.svelte-kit/output/client/_app/immutable/assets/PhaseInterstitial.VNCRer9Q.css   16.35 kB │ gzip:  3.46 kB
.svelte-kit/output/client/_app/immutable/chunks/D2YFI6FJ.js                       0.02 kB │ gzip:  0.04 kB
.svelte-kit/output/client/_app/immutable/chunks/GXgP2X73.js                       0.03 kB │ gzip:  0.05 kB
.svelte-kit/output/client/_app/immutable/chunks/DfgPz6zH.js                       0.05 kB │ gzip:  0.06 kB
.svelte-kit/output/client/_app/immutable/entry/payload.DSmR2FwN.js                0.06 kB │ gzip:  0.07 kB
.svelte-kit/output/client/_app/immutable/chunks/DYrviY11.js                       0.08 kB │ gzip:  0.09 kB
.svelte-kit/output/client/_app/immutable/chunks/CfVfbrRA.js                       0.30 kB │ gzip:  0.21 kB
.svelte-kit/output/client/_app/immutable/nodes/1.y8Lub40E.js                      0.32 kB │ gzip:  0.24 kB
.svelte-kit/output/client/_app/immutable/chunks/DOn_up09.js                       0.32 kB │ gzip:  0.23 kB
.svelte-kit/output/client/_app/immutable/entry/start.BX6fXps_.js                  0.65 kB │ gzip:  0.36 kB
.svelte-kit/output/client/_app/immutable/chunks/DJYhtmlD.js                       0.66 kB │ gzip:  0.38 kB
.svelte-kit/output/client/_app/immutable/chunks/C5l9ChPi.js                       0.70 kB │ gzip:  0.45 kB
.svelte-kit/output/client/_app/immutable/chunks/XKyaHtl9.js                       0.72 kB │ gzip:  0.42 kB
.svelte-kit/output/client/_app/immutable/chunks/B7eYof1F.js                       0.72 kB │ gzip:  0.42 kB
.svelte-kit/output/client/_app/immutable/chunks/BxirXaGE.js                       0.78 kB │ gzip:  0.46 kB
.svelte-kit/output/client/_app/immutable/chunks/BoZfHtGN.js                       0.97 kB │ gzip:  0.47 kB
.svelte-kit/output/client/_app/immutable/chunks/jBuxq2wr.js                       1.01 kB │ gzip:  0.61 kB
.svelte-kit/output/client/_app/immutable/chunks/BwDV1Xb8.js                       1.21 kB │ gzip:  0.65 kB
.svelte-kit/output/client/_app/immutable/chunks/BV-1ALok.js                       1.26 kB │ gzip:  0.41 kB
.svelte-kit/output/client/_app/immutable/chunks/Bjy-W4x2.js                       1.36 kB │ gzip:  0.65 kB
.svelte-kit/output/client/_app/immutable/chunks/CtAP2k9Z.js                       1.51 kB │ gzip:  0.65 kB
.svelte-kit/output/client/_app/immutable/nodes/3.DQnx-GoU.js                      1.57 kB │ gzip:  0.79 kB
.svelte-kit/output/client/_app/immutable/chunks/DclECHGd.js                       1.63 kB │ gzip:  0.83 kB
.svelte-kit/output/client/_app/immutable/nodes/0.EK_ioEKw.js                      2.32 kB │ gzip:  1.26 kB
.svelte-kit/output/client/_app/immutable/entry/app.B03qsQY-.js                    2.88 kB │ gzip:  1.22 kB
.svelte-kit/output/client/_app/immutable/chunks/gNPPyla9.js                       2.90 kB │ gzip:  1.45 kB
.svelte-kit/output/client/_app/immutable/nodes/2._YZCFSo4.js                      3.43 kB │ gzip:  1.51 kB
.svelte-kit/output/client/_app/immutable/chunks/D56Uz5Co.js                       3.68 kB │ gzip:  1.57 kB
.svelte-kit/output/client/_app/immutable/chunks/DdQhk6cm.js                       7.29 kB │ gzip:  2.64 kB
.svelte-kit/output/client/_app/immutable/chunks/BGq3z9Wx.js                       7.89 kB │ gzip:  2.94 kB
.svelte-kit/output/client/_app/immutable/nodes/5.CJj7c6ja.js                     13.56 kB │ gzip:  5.79 kB
.svelte-kit/output/client/_app/immutable/nodes/6.B8ikIHcP.js                     17.66 kB │ gzip:  5.58 kB
.svelte-kit/output/client/_app/immutable/chunks/BCkhdaKc.js                      20.43 kB │ gzip:  7.52 kB
.svelte-kit/output/client/_app/immutable/nodes/4.DhcC70NM.js                     24.79 kB │ gzip:  7.83 kB
.svelte-kit/output/client/_app/immutable/chunks/CChcWfls.js                      24.94 kB │ gzip:  9.63 kB
.svelte-kit/output/client/_app/immutable/chunks/n_rMDW4u.js                      42.05 kB │ gzip: 15.46 kB
.svelte-kit/output/client/_app/immutable/chunks/BRPdx2z7.js                      52.10 kB │ gzip: 19.89 kB
.svelte-kit/output/client/_app/immutable/chunks/B0tYZsGW.js                      73.49 kB │ gzip: 23.72 kB
.svelte-kit/output/client/_app/immutable/chunks/DgJx_BD9.js                      95.38 kB │ gzip: 27.41 kB
.svelte-kit/output/client/_app/immutable/chunks/BlLU7fzC.js                     108.47 kB │ gzip: 34.94 kB

[32m✓ built in 30.34s[39m

Run npm run preview to preview your production build locally.

> Using @sveltejs/adapter-static

Vite PWA v8.0.14 [Vite 8.3.6]
strategy  generateSW
precache  56 entries (748.87 KiB)

✓ files generated:
  .svelte-kit/output/client/sw.js                3.56 kB
  .svelte-kit/output/client/workbox-7bcbb5c2.js 18.17 kB

✓ built in 1112.4694ms
Wrote site to "build"
✔ done; if it fails, run the Pixel 7 debug loop (see git log for the e2e helper) and read error-context.md.
- [ ] Stylelint: stylelint.config.js exists (not yet in npm run lint). Remaining 11 hits: /import page + ImportPreviewPanel raw rem values (fix with the /import restyle) and Button box-shadow 'inset' (add ignoreValues '/^inset /'). Then add  to the lint script.
- [ ] DEFERRED by user (usage limit) unless cheap: /dev/ui visual regression (toHaveScreenshot, ignoreSnapshots on CI), /import restyle + ImportPreviewPanel in /dev/ui. Log both as Phase 10 known issues if skipped.
- [ ] Finish: npm run verify (stub-check: no stubs left), HANDOFF.md, PROGRESS.md entry, delete WIP.md.
- [ ] Stylelint + `npm run lint` wiring; boundary lint for `src/lib/exercises`.
- [ ] e2e: session with each kind (reduced motion on/off), `/dev/ui` screenshots light/dark at 360.
- [ ] Verify, HANDOFF, PROGRESS, delete WIP.

## Agent brief: spec-test-writer (step 2)

Owns only: `tests/unit/engine/exercise-spec.test.ts`, `tests/unit/engine/exercise-check.test.ts`, `tests/unit/engine/replay-accept.test.ts` (and a fixtures file `tests/unit/engine/exercise-fixtures.ts` if needed).

> Write tests from the spec, before implementation, for `src/lib/engine/exercise-spec.ts` (`exerciseKindFor`, `promptFor`, `buildExercise`) and `src/lib/engine/exercise-check.ts` (`checkResponse`). Their signatures and types are in those files (bodies throw `not implemented`). Read ONLY: BUILD_PLAN §5 and §5.1, §6.10, §6.11, §6.4 (the contrastive-feedback bullet), DATA_MODEL §4.2–§4.3, and the Decisions log rows whose text starts "Phase 5" plus the rows about `cardAnswer`, answer kinds, distractor tiers and first-letter banks. Existing helpers they build on (read signatures only): `cardAnswer`/`answerEntries` (engine/answers.ts), `pickDistractors`/`firstLetterBank` (engine/distractors.ts), `gradeTyped`/`normalizeAnswer` (engine/grading.ts), `gradeSequence` (engine/grading-shapes.ts), `rngFor`/`createRng` (engine/rng.ts), `currentKind`/`currentStep` (engine/exercise-kinds.ts). Config names: `MC_OPTIONS`, `BANK_SIZE`, `PARSONS_EXTRAS`, `MATCHING_PAIRS`, `ITEM_ROWS_SHOWN`, `BLURT_TITLE_CHARS`. Test behaviour, not exact shuffles: assert sets, that `correctIndex`/`pairs`/`bucketOf`/`correctOrder` point at the right texts, determinism for the same seed, and every fallback in the §5.1 table (the spec's `kind` must be the fallback kind). Cover every non-diagram kind and every non-diagram note type, and `checkResponse` for every shape (correct, wrong, contrast and `chosenFromCardId` on a sibling pick, typed collision, marks, placed parsons extra, self-rated returns correct). Also write `tests/unit/engine/replay-accept.test.ts` for the Decisions-log row "Phase 5: I was right": `replay` treats a review event as correct when an `acceptAdded` event has `reviewEventId` equal to its id, whatever order they arrive in; an `acceptAdded` without `reviewEventId` changes nothing; use the existing replay fixtures in `tests/unit/engine/fixtures.ts`/`replay.test.ts` style. Run the tests: they must fail only on `not implemented` (or, for replay, on the missing behaviour). Report: tests written per function, and every SPEC-GAP (an ambiguity you had to resolve) with the reading you chose.

## Decided but not yet in the docs

- e2e harness: `/dev/session` seeds a sample course (services/dev-sample.ts text covering every non-diagram note type) via ImportService, starts StudyService with forceKinds (one card per kind, 22 kinds) + explicit cardIds (bypass PRACTICE_SESSION_CARDS). forceKinds applies to a card's FIRST showing only (item.attempt===0); later showings follow the path, so recognition-forced cards can still meet the criterion. Dev builds set window.__snowpackExercise = current spec so e2e computes the right response and drives the real UI. Log this in Decisions log.

- Dev routes: `__DEV_ROUTES__` (vite define) is true unless mode is production; `build:test` (`vite build --mode test`) is what verify and e2e use; deploy uses `build`. Gate `/dev/*` pages with it (404 otherwise).
- Effects follow `data-companion` on <html> (set by `ui/layout/AppRoot.svelte`); pressables carry `data-paw`; one `delight/PawPressLayer` draws paws.
- Display prefs: `services/preferences.svelte.ts` ($state, lazily loads settings via `preferences-wiring.ts` so zod stays out of the shell); theme hint in localStorage; inline script in app.html.
- Components may read semantic tokens and the `--space-*`/`--size-px-*` scales; never `--palette-*`, `--ms-*`, `--curve-*`, `--radius-*`, `--layer-*`. Stylelint to enforce.
- Arrange/sort/pair exercises: tap-to-select then tap-target (works by touch, mouse, keyboard); pointer drag gestures deferred to Phase 10 polish.
- Contrast-adjusted light shades already written into DESIGN §3.1.
