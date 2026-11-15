# WIP — Design reskin (before Phase 8.6)

## Checkpoint log
| Date | Phase | Step | Model | Done | Files | Next | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-15 | Design reskin | 0 Docs | Opus 5.5 | Phase row added, temp design notes removed, rule 20/reviewer → yuki-cozy.svg, wolf.svg deleted, screens/ committed | 8 | Step 1 Tokens + fonts + theme setting | 8c7ecb4 |

## Task
Reskin the app to the cozy design. **Spec: `docs/DESIGN.md` (read in full; authoritative).** Reference art: `docs/design/yuki-cozy.svg`, screenshots in `docs/design/screens/` (DESIGN.md wins over screenshots; numbers in screenshots are placeholders). Do not read old design notes. **No new features.** Base commit (reskin start): `5dfa380`.

Stop and ask the user if DESIGN.md is ambiguous or a value fails contrast in practice; never invent values. Push only after the user confirms.

## Checklist
- [x] 0. Docs (8c7ecb4): BUILD_PLAN §10 phase-status row "Design reskin | In progress | DESIGN.md" before 8.6; remove the temporary "DESIGN.md being rewritten / tokens-only with extra weight" notes (CLAUDE.md rule 20, HANDOFF, SESSION_NOTES §G, BUILD_PLAN §10 "Design status"); keep the tokens-only rule; rule 20 → `docs/design/yuki-cozy.svg`; delete `docs/design/wolf.svg`. Checkpoint.
- [ ] 1. Tokens: rewrite `src/lib/design/tokens/base.css`, `semantic.css`, `themes/light.css`; add `themes/lamp.css` (rename `dark.css`) with exactly DESIGN §3–§6 values. Theme setting: light / lamp-light / follow system. Self-host the four fonts (§5, Latin subset, listed weights only), precached by the SW; no Google Fonts at runtime; shell under `SHELL_JS_BUDGET_KB`. Checkpoint.
- [ ] 2a. Primitives (§2 layer 5, §7) in `src/lib/ui/primitives/`, in `/dev/ui` both themes first; visual-regression snapshots updated in the same commit. Checkpoint.
- [ ] 2b. Components (§7) in `src/lib/ui/components/`. Checkpoint.
- [ ] 2c. Delight (§8) in `src/lib/ui/delight/` + Yuki rebuilt from `yuki-cozy.svg` (§9 states; keep group ids `#tail #body #head #ear-l #ear-r #eyes #bandana #zz`). Checkpoint.
- [ ] 3. Reskin screens (no styles beyond grid placement; a needed style edit means a missing component). Checkpoint per group:
  - [ ] home/welcome
  - [ ] import
  - [ ] course page + map/cheat sheet (cheat-sheet overflow → collapsible)
  - [ ] learn + study screens
  - [ ] exam prep, planner, one-night
  - [ ] card list
  - [ ] desktop Sidebar layout (§10)
- [ ] 4. `npm run verify`; reviewer (Sonnet, fresh session, diff since `5dfa380`, spec = DESIGN.md, summary at `test-results/summary.md`); PROGRESS entry; phase table → Design reskin Done, 8.6 Next; HANDOFF updated; delete WIP. Push only after the user confirms.

## Notes not yet in the docs
- `docs/design/wolf-preview.html` (old wolf animation reference) is left in place; ask the user whether to delete it.
- `src/lib/ui/components/yuki/Yuki.svelte` and `yuki-motion.css` comments still name `wolf.svg` / `wolf-preview.html` until step 2c rebuilds Yuki.
- Old theme is `themes/dark.css`; `src/lib/design/tokens.css` is the entry that imports the layers; `tokens.ts` mirrors tokens (update in step 1).
