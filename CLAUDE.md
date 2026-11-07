# CLAUDE.md — Snowpack: Study & Cram

**App name:** "Snowpack: Study & Cram" (full/store name) · "Snowpack" (short name: PWA short_name, home-screen label, header) · brand "Snowpack Study". Companion: **Yuki**, the snow wolf. Never hard-code the name — use `APP_NAME` / `APP_SHORT_NAME` from `config/defaults.ts`.

An offline-first study app (SvelteKit PWA) for CS/IS students. Web in a laptop or phone browser is the priority; Android install is future work.

**Starting a session:** read `docs/HANDOFF.md` (current state, how data works here, and which sections each phase reads), then the Decisions log at the bottom of `BUILD_PLAN.md`, which overrides older text. Then read only the sections listed for the current phase. Don't read every doc in full; open others when a question needs them. The code and tests show what already exists.

The docs, for reference:

- `docs/CONCEPT.md` — what the app does and why (the source of truth for behaviour).
- `docs/BUILD_PLAN.md` — how to build it: stack, data model, engine specs, phases, defaults.
- `docs/DATA_MODEL.md` — every stored field, the ER diagram and the export format. The source of truth for data.
- `docs/DESIGN.md` — the look and feel: tokens, components, screens, and Yuki the wolf companion (reference art in `docs/design/`).
- `docs/PROGRESS.md` — what has been built so far and the latest test results. Read the last entry first.

## Toolchain traps (already solved; don't rediscover them)

- **SvelteKit 3:** import with `#lib/path/file.ts`, extension required; `$lib` is gone. Use `$app/env` (not `$app/environment`) and `@sveltejs/kit/hooks` for hook types. Config lives in `vite.config.ts` inside `withPwa`; there is no `svelte.config.js`.
- **Installing packages:** npm 11.2 crashes on resolving, so use `npx -y npm@latest install ...`. Installs remove Kit's generated `node_modules/$app`; `npm run check` restores it.
- **TypeScript stays on 6.0.x.** Scripts run through Node's type stripping, so they import with `.ts` and can't use parameter properties or enums.
- **ESLint import bans must use `regex`:** a `#lib` glob pattern is read as a comment and silently does nothing. `tests/unit/lint/boundaries.test.ts` guards this.
- **Preview:** `npm run preview` serves `build/`; Kit's own preview breaks the service worker.
- **Dexie transactions:** awaiting an async helper inside `db.transaction` can silently drop the transaction ("Transaction committed too early", or writes that don't roll back). For writes across tables, use `ContentStore.writeBatch`.
- **Output:** pipe long commands through `tail` or `grep`, and read `test-results/summary.md`. Tests are scripts, so running them costs little; reading their full output doesn't.

## Rules

1. **Work phase by phase** (`BUILD_PLAN.md` §10). Finish a phase — code _and_ its tests — before starting the next. Never leave stubs, TODO placeholders or mocked engine logic in place of the real thing. The only allowed stub is the interface step of the workflow below (`throw new Error('not implemented')`), and it must be gone before the phase ends — `verify` fails if any remain.
2. **The engine is pure.** Code in `src/lib/engine/` has no DOM, no IndexedDB, no network, no `Date.now()` and no `Math.random()`. Time is passed in; randomness comes from `engine/rng.ts` seeded by `(cardId, sessionId, attempt)`.
3. **Every engine change has unit tests.** Run `npm run test` before calling anything done. Simulation tests live in `tests/sim`.
4. **No magic numbers.** Every tunable value lives in `src/lib/config/defaults.ts`.
5. **Events are append-only.** Never update or delete a review event. Card scheduling fields (`fsrs`, `due`, `status`, `fragile`, `weak`, `daysCorrect`, `pathStep`, `accuracy`) are caches rebuilt by `replay()`; never write them from anywhere else.
6. **Content writes go through the repository classes in `db/repos/`**, which sets `updatedAt`, `deviceId` and tombstones (`deleted: true`) instead of hard deletes (except archive/replace import, which are explicit).
7. **IDs are `crypto.randomUUID()`.** Keep card IDs stable when regenerating cards from an edited note, so history survives.
8. **No AI at runtime.** Don't add AI SDKs or network calls to scoring, scheduling or planning. The only optional "AI" is the user's own chatbot, outside the app.
9. **Keep the shell small.** tesseract.js, elkjs and Svelte Flow are only imported from lazy-loaded diagram code; OCR and ELK run in Web Workers. Check the shell stays under `SHELL_JS_BUDGET_KB`.
10. **Mobile first.** Every interaction works by touch at 360 px wide; every drag has a tap alternative.
11. **Never lock the user out** (sleep is a reminder, not a block), and **never add an "I know this" skip**.
12. **Verify library APIs** listed in `BUILD_PLAN.md` §14 against the installed versions instead of assuming.
13. **Test continuously.** Run `npm run test` after every change set. Before saying a phase is done, run `npm run verify` and make it pass.
14. **Read the logs, don't guess.** When anything fails, read `test-results/summary.md` first, then the specific report it points to (sim scenario `.md`, Playwright trace, coverage). Fix the cause.
15. **Never weaken tests to pass.** Don't skip, delete, loosen or `.only` tests, lower coverage thresholds, or bypass git hooks (`--no-verify`). If the spec itself was wrong, fix the spec and record it in the Decisions log.
16. **Log progress.** At the end of each phase, append an entry to `docs/PROGRESS.md` using its template, with numbers from `summary.md`.
17. **Engine functions return traces** (`{ result, trace }`) explaining their decisions; the app logger stores them. Don't put `console.log` in the engine.
18. **Follow the architecture and conventions** in `BUILD_PLAN.md` §15: UI → services → engine/repos, never the other way; stored data as plain zod-typed records (no classes); classes only for repositories and stateful services; discriminated unions with exhaustive `switch`; no `any`; files ≤ 300 lines, functions ≤ 50; JSDoc with `@see` to the spec section.
19. **Data changes are one commit:** touching a stored field means updating `DATA_MODEL.md`, the zod schema and (if indexes change) a Dexie migration together.
20. **Design comes from tokens.** Components use only `src/lib/design/tokens.css` variables and the scales in `DESIGN.md` — no raw hex colours or one-off sizes. Every new component and state goes into the `/dev/ui` style guide. Build Yuki from `docs/design/wolf.svg`, keeping its named groups; motion only via `transform`/`opacity`; respect reduced motion; never use Yuki to guilt or block.

## Workflow for every phase (use the agents in `.claude/agents/`)

1. **Interface first.** Write the module's types and exported function/class signatures (bodies: `throw new Error('not implemented')`) and the zod schemas it needs. Commit.
2. **Tests from the spec.** For risky logic (scheduling, merge/replay, planning, grading), call the `spec-test-writer` agent with the module path and the exact spec sections to read; it reads only those. Read its report; resolve every `SPEC-GAP` (decide, record in the Decisions log, and have the test updated by the agent if needed). Plumbing (repos, schemas, simple services) gets tests written directly, with no agent.
3. **Implement** until those tests pass. Do not edit the agent's tests to make them pass; if a test contradicts the spec, fix the spec reading and re-run the agent on that test.
4. **Verify.** `npm run verify` must pass.
5. **Review.** Self-review as you go. Call the `reviewer` agent once at the end of Phase 4, scoped to that phase's engine files and the spec sections they implement, not the whole project. Otherwise call it only on a huge error or an error that repeats, again scoped to what's needed. Fix its `blocker` and `should-fix` findings.
6. **Hand off and log.** Update `docs/HANDOFF.md` as its last section describes, so the next session starts correct. Append the phase entry to `docs/PROGRESS.md`, with any reviewer verdict and any findings deliberately left as `nit`.

Agents are helpers giving a different point of view, not supervisors: give them the specifics they need so they don't read everything. Steps 1–3 repeat per module inside a phase; steps 4–6 run once at the end of the phase. UI-only work (screens, styling) skips step 2 but still gets e2e tests.

## Commands (set up in Phase 0)

- `npm run dev` — dev server
- `npm run test` — Vitest (unit + sim), writes reports to `test-results/`
- `npm run test:watch` — re-run affected tests on save
- `npm run test:e2e` — Playwright (mobile viewport)
- `npm run build && npm run preview` — production build, test the PWA offline
- `npm run check` — svelte-check + TypeScript
- `npm run test:report` — builds `test-results/summary.md`
- `npm run verify` — everything CI runs, locally; required before a phase is done

## When unsure

If the concept and the plan disagree, follow `CONCEPT.md` and update `BUILD_PLAN.md`. If neither covers a case, choose the option that keeps the engine deterministic and testable, and note the decision at the bottom of `BUILD_PLAN.md` under a "Decisions log" heading.
