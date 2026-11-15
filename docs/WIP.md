# WIP — Design reskin (before Phase 8.6)

## Checkpoint log
| Date | Phase | Step | Model | Done | Files | Next | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-15 | Design reskin | 0 Docs | Opus 5.5 | Phase row added, temp design notes removed, rule 20/reviewer → yuki-cozy.svg, wolf.svg deleted, screens/ committed | 8 | Step 1 Tokens + fonts + theme setting | 8c7ecb4 |
| 2026-11-15 | Design reskin | 1 Tokens | Opus 5.5 | DESIGN §3–§6 tokens, light/lamp themes + legacy aliases, 4 self-hosted fonts precached, style guide tokens section; unit 1856/1857 (1 timeout logged), layout+pwa e2e 18/18 | 33 | Step 2a Primitives | 4110b89 |
| 2026-11-15 | Design reskin | 2a Primitives | Opus 5.5 | PawButton/secondary/link Button, Card, Chip, Input, Toggle, Checkbox, Select, TextArea, FileButton, Segmented on §4 names; Paw (§7 glyph) + Snowflake → primitives; 4 legacy aliases gone; unit 1857/1857, layout+session+import e2e 30/30 | 20 | Step 2b Components (ask ModeDoor label colour) | 6f410db |

## Task
Reskin the app to the cozy design. **Spec: `docs/DESIGN.md` (read in full; authoritative).** Reference art: `docs/design/yuki-cozy.svg`, screenshots in `docs/design/screens/` (DESIGN.md wins over screenshots; numbers in screenshots are placeholders). Do not read old design notes. **No new features.** Base commit (reskin start): `5dfa380`.

Stop and ask the user if DESIGN.md is ambiguous or a value fails contrast in practice; never invent values. Push only after the user confirms.

## Checklist
- [x] 0. Docs (8c7ecb4): BUILD_PLAN §10 phase-status row "Design reskin | In progress | DESIGN.md" before 8.6; remove the temporary "DESIGN.md being rewritten / tokens-only with extra weight" notes (CLAUDE.md rule 20, HANDOFF, SESSION_NOTES §G, BUILD_PLAN §10 "Design status"); keep the tokens-only rule; rule 20 → `docs/design/yuki-cozy.svg`; delete `docs/design/wolf.svg`. Checkpoint.
- [x] 1. Tokens (4110b89): rewrite `src/lib/design/tokens/base.css`, `semantic.css`, `themes/light.css`; add `themes/lamp.css` (rename `dark.css`) with exactly DESIGN §3–§6 values. Theme setting: light / lamp-light / follow system. Self-host the four fonts (§5, Latin subset, listed weights only), precached by the SW; no Google Fonts at runtime; shell under `SHELL_JS_BUDGET_KB`. Checkpoint.
- [x] 2a. Primitives (§2 layer 5, §7) (6f410db) in `src/lib/ui/primitives/`, in `/dev/ui` both themes first; visual-regression snapshots updated in the same commit. Checkpoint.
- [ ] 2b. Components (§7). Split in two checkpoints (too many files for one):
  - [ ] 2b-i. Existing components in `src/lib/ui/components/` restyled to §7 and moved off legacy names: OptionButton (= OptionBubble toe-bean), TapChip, Slot, FeedbackPanel, ExerciseCard, DayBar, StatusBadge, Session/RoundSummary, StickyNote, SpeechBubble, Sheet + ConfirmDialog (knit top edge), PhaseInterstitial, PhaseLabel, Banner, StepList, Disclosure, EmptyState, ProgressDots/ProgressStrip, ReadinessRing. Style guide updated. Checkpoint.
  - [ ] 2b-ii. New §7 components (in `/dev/ui` both themes): ModeDoor (`--door-label` per variant), Stamp, TrapAside, KeyTerm, HangingTag, PawTrail, PawRing, ReadinessMeter, Flashcard, ChecklistRow; TopBar + BottomNav (`src/lib/ui/layout/`) reskinned. Not wired into screens yet (step 3). Checkpoint.
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
- Step 2a: Paw and Snowflake moved from `ui/motifs/` to `ui/primitives/` (Moon stays in motifs). Paw uses the DESIGN §7 glyph and has an `outline` prop. Button: primary = PawButton (wool bean + accent paw, outer lip, `meta` prop, new `size="hero"` 60 px, `paw={false}` for compact buttons, an `icon` snippet goes in the bean); secondary = paper + 2 px outline + dashed-ring bean; ghost = link button (accent, underlined, 44 px); danger = link button in `--wrong`. Card dropped the unused `radius` prop and gained `raised`. Chip selected = `--btn-primary-bg/-fg`. Toggle off-knob uses `--text-soft` (UI state needs 3:1; `--decor` is 2.6:1). Legacy aliases `--warning --focus --lip --lip-secondary` deleted.
- The repo has no Playwright visual-regression snapshots (no `toHaveScreenshot`), so "snapshots updated in the same commit" had nothing to update; the style guide is checked by layout e2e and by eye. Ask the user in step 4 whether to add snapshots.
- `docs/design/wolf-preview.html` (old wolf animation reference) is left in place; ask the user whether to delete it.
- `src/lib/ui/components/yuki/Yuki.svelte` and `yuki-motion.css` comments still name `wolf.svg` / `wolf-preview.html` until step 2c rebuilds Yuki.
- Step 1 layout: base `src/lib/design/tokens/base.css` (`--c-*` light, `--l-*` lamp palettes, type scale, spacing, radii incl. `--radius-arch`/`--radius-tab`, grain noise URI); `tokens/semantic.css` (font roles `--font-display/-wordmark/-body/-label`, type roles, `--r-*`, `--shadow-raised`, `--border-width`, `--border-dashed`, control sizes); themes in `src/lib/design/themes/` (not tokens/themes): `light.css`, `lamp.css` (selects `[data-theme='dark']`), `legacy.css` (old names → §4 meanings, delete in step 4). `.grain` and `.knit` texture classes are in `tokens.css`. `tokens.ts` mirrors the §4 colours; `tests/unit/design/tokens.test.ts` checks values and contrast.
- Decided and logged in BUILD_PLAN Decisions log: "Design reskin: theme setting" (stored values unchanged; `dark` = lamp-light, labelled "Lamp-light"; auto-night kept, user's call) and "Design reskin: legacy token aliases".
- For 2a–2c, move each component off the legacy names (`--primary`, `--surface-alt`, `--border`, `--text-muted`, `--success*`, `--error*`, `--warning*`, `--focus`, `--moon`, `--shadow-1/2`, `--card-edge`, `--lip*`, `--tape`, `--paw-*`, `--yuki-glow`, `--font-hand`, `--r-lg`, `--r-xl`, `--space-40/56`, `--gap-3xl`) and delete them from `legacy.css` / base as they go unused.
- Resolved (user, 2026-11-15): ModeDoor label colour follows the fill — wool on pine/night/oxblood, ink on brass (and any snow/paper door); component token `--door-label` per variant; lamp-light uses text-strong / bg. Written into DESIGN §7 ModeDoor.
- The settings screen (8.6) must label `dark` as "Lamp-light". Course colours are unchanged (DESIGN doesn't define them).
- Fonts: `static/fonts/` holds 8 woff2 files plus licences, copied from `@fontsource/{literata,im-fell-english,im-fell-english-sc,courier-prime}` (devDependencies); all are precached by the SW; shell 89.7 KB gzipped.
