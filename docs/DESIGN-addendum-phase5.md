# DESIGN addendum — wolf touches, button look, and UI layering

Merge into `docs/DESIGN.md` before starting Phase 5 (new §11–13; update §3.1, §5 and Settings as noted). Everything here follows the existing principles: calm in the session, kind never guilt, readable first, light on 3G, reduced motion respected.

---

## 11. The wolf theme: accents, not everywhere

The theme lives in four motifs only — **Yuki, paw prints, snow, the moon** — used as small accents. Rule: **at most one decorative element per card**, and none inside the exercise card except feedback effects. Surfaces, text and layout stay clean.

### 11.1 Motif assets (inline SVG, `src/lib/ui/motifs/`)

**Paw print** (`Paw.svelte`, 24 × 24, fill `currentColor`):
```svg
<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M12 11.2c2.9 0 5.4 2.2 5.4 4.6 0 1.8-1.4 2.6-3 2.6-.9 0-1.6-.4-2.4-.4s-1.5.4-2.4.4c-1.6 0-3-.8-3-2.6 0-2.4 2.5-4.6 5.4-4.6z"/>
  <ellipse cx="6.6" cy="9.6" rx="1.7" ry="2.2" transform="rotate(-20 6.6 9.6)"/>
  <ellipse cx="10" cy="6.6" rx="1.7" ry="2.3"/>
  <ellipse cx="14" cy="6.6" rx="1.7" ry="2.3"/>
  <ellipse cx="17.4" cy="9.6" rx="1.7" ry="2.2" transform="rotate(20 17.4 9.6)"/>
</svg>
```

**Snowflake** (`Snowflake.svelte`, 24 × 24, stroke `currentColor`, width 2, round caps):
```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
  <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>
  <path d="M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5M4 10.4l2.6.1 1.2-2.4M20 13.6l-2.6-.1-1.2 2.4M4 13.6l2.6-.1 1.2 2.4M20 10.4l-2.6.1-1.2-2.4"/>
</svg>
```

**Moon** (`Moon.svelte`): a 3/4 crescent in `#F2C14E` (already used at the end of the progress strip).

Status badge icons use these motifs where they fit: *Exam-ready* = paw, *Long-term secure* = snowflake, *One-night triage* = moon. Other icons stay Lucide.

### 11.2 Delight catalogue (reinforcement and small touches)

All effects live in `src/lib/ui/delight/`, are triggered by the session controller (never by exercise components directly), run **in parallel** with the next interaction (never block input or delay the next card), animate only `transform`/`opacity`, and are disabled under reduced motion.

| Effect | Trigger | Look & motion | Duration | Limit |
|---|---|---|---|---|
| **Paw press** | Tap on any `Button` or `OptionButton` | A paw print (20 px, `--primary` at 35% on light, white at 35% on dark) appears at the touch point, scales 0.6 → 1, fades out | 300 ms | Every tap |
| **Check draw + snow burst** | First-attempt correct | The ✓ draws itself (stroke animation, 220 ms), then 4–5 small snowflakes burst out from it and fade | 450 ms total | Every first-attempt correct |
| **Haptic tick** | First-attempt correct | `navigator.vibrate(12)` on Android | 12 ms | Setting `haptics` (default on) |
| **Paw trail** | Progress strip fills | The filled part shows a faint repeating paw-print pattern behind Yuki (CSS background, `--on-primary` at 18%) | static | — |
| **Snow flurry** | 3 first-attempt corrects in a row | A light flurry of ~10 flakes drifts down across the top of the card | 800 ms | At most once per 3 corrects |
| **Paw stamp** | A card reaches Exam-ready or Long-term secure | Its status badge appears with a "stamp" (scale 1.3 → 1, rotate −8° → 0°) | 300 ms | Once per card per status |
| **Count-up** | Session summary | Numbers count up | 600 ms | — |
| **Paw walk** | Session summary | A line of paw prints walks across the bottom of the summary card to Yuki (celebrate) | 1.2 s | Once per summary |
| **Paw loader** | Any loading > 300 ms | Three paw prints appear in sequence and loop (replaces spinners) | loop | — |
| **Paw checkbox** | Explain-it / blurt checklist ticks, settings checkboxes | Box fills `--primary` with a white paw instead of a plain ✓ (keeps checkbox semantics and an accessible label) | 160 ms | — |
| **Paw toggle** | Toggles | The knob shows a tiny paw when on | 160 ms | — |

Wrong answers keep their gentle shake and Yuki's ear droop — **no** negative bursts, sounds or red flashes. No sounds in v1.

**Settings mapping:** `companion: full` → everything above; `quiet` → paw press, check draw, haptic tick, paw checkbox/toggle only; `off` → no motifs except status-badge icons (functional feedback animations from §3.4 remain). Add setting `haptics: boolean` (default `true`) to `DATA_MODEL §5 Settings`.

---

## 12. What controls look like (complements §5)

**Overall feel:** soft and slightly tactile — rounded shapes with a small darker "lip" at the bottom of pressable things, so pressing feels physical, like a soft clay button. Not full claymorphism (no heavy 3D shading).

| Control | Look |
|---|---|
| **Primary button** (`accent`) | Height 52 (56 in the session), radius `--r-md`, Nunito 700 17 px, `--on-accent` text, 3 px bottom lip (`inset 0 -3px 0 rgba(43,37,64,.14)`). **Press:** moves down 2 px, lip shrinks to 1 px, paw press appears. Optional leading icon 20 px |
| **Secondary button** | Same shape, `--primary-soft` fill, `--primary` text, lip in `--primary` at 20% |
| **Ghost button** | No fill, `--primary` text, `--primary-soft` background on press |
| **Option button** | `--surface`, 2 px `--border`, radius `--r-md`, min height 56. Left "letter bubble" (A/B/C/D) — 28 px circle in `--primary-soft` with `--primary` letter. Selected: 2 px `--primary` border + `--primary-soft` fill. Correct: `--success-soft` + ✓ (draws in). Wrong: `--error-soft` + ✕. Revealed correct: 2 px `--success` border |
| **Card** | `--surface`, radius `--r-lg`, `--shadow-1`; optional 4 px course-colour top stripe; at most one motif (e.g. a tiny snowflake by a "secure" count) |
| **Chip / course tab** | Pill, course-colour fill, Nunito 700 13 px, 32 px tall; selected tab gets a 2 px `--text` underline bar |
| **Input** | `--surface-alt`, radius `--r-sm`, 48 px tall, 2 px `--primary` border on focus, first-letter hint as a faded letter |
| **Toggle** | 52 × 32 track, `--primary` when on, knob with tiny paw (§11.2) |
| **Bottom nav** | `--surface`, top hairline; active tab: icon + label in `--primary` with a small `--primary-soft` pill behind the icon |
| **Sticky note** | `--warning-soft`, rotated −1.5°, a small "tape" strip at the top (`--surface-alt` at 70%), Caveat heading |
| **Progress strip** | 10 px pill track, paw-trail fill (§11.2), Yuki runner, moon at the end |

All values come from tokens; this table just fixes the choices.

---

## 13. UI architecture: layers so the look can change later

The goal: **change the look by editing tokens or one component file, never by editing screens.**

### 13.1 Styling approach

- **Svelte scoped component styles + CSS custom properties.** No Tailwind. Each component owns its styles in one file; screens contain no visual styles.
- **No raw values outside the token layer**: lint (Stylelint `declaration-strict-value` for colour, spacing, radius, shadow, font, z-index, duration) fails on hex colours, px sizes not in the scale, or ad-hoc timings in components and routes.

### 13.2 The layers (each may use only the layers above it)

| Layer | Folder | Contains | May style? |
|---|---|---|---|
| **1. Base tokens** | `src/lib/design/tokens/base.css` | Raw palette, type scale, spacing scale, radii, shadows, durations | Defines values |
| **2. Semantic tokens** | `src/lib/design/tokens/semantic.css` | Meaning-based names mapped to base tokens: `--bg`, `--text`, `--primary`, `--success`… | Maps only |
| **3. Theme files** | `src/lib/design/themes/light.css`, `dark.css` | Semantic token values per theme (auto-night reuses dark). A future theme (e.g. seasonal) is just another file here | Maps only |
| **4. Component tokens** | Top of each component file | Component-level knobs mapped to semantic tokens, e.g. `--button-primary-bg: var(--accent)`; `--card-radius: var(--r-lg)` | Maps only |
| **5. Primitives** | `src/lib/ui/primitives/` | Button, Card, Chip, Input, Toggle, Icon, Paw, Snowflake, Moon | Yes — via their component tokens |
| **6. Components** | `src/lib/ui/components/` | OptionButton, ProgressStrip, ReadinessRing, StatusBadge, StickyNote, FeedbackPanel, Sheet, EmptyState, Yuki | Composition + their own tokens |
| **7. Delight** | `src/lib/ui/delight/` | PawPress, SnowBurst, SnowFlurry, PawStamp, PawWalk, PawLoader, haptics | Own effects only |
| **8. Layout** | `src/lib/ui/layout/` | Screen, Stack, Grid, TopBar, BottomNav, SafeArea | Spacing/layout props only |
| **9. Exercises** | `src/lib/exercises/` | One component per exercise kind, built only from layers 5–8 | No new visual styles |
| **10. Screens** | `src/routes/` | Compose layout + components with data | **No styles** except grid placement |

**How a change flows:** recolour the app → edit a theme file. Make every card rounder → change `--card-radius` in Card. Redesign the option buttons → edit `OptionButton.svelte` once; every exercise updates. Add a new theme → add one theme file.

### 13.3 Variants, not copies

New looks are **props on the existing component** (`<Button variant="secondary" size="lg">`), never a copied component. If a variant needs more than a few token overrides, it gets reviewed as a design change first.

### 13.4 Protecting the look when it changes

- **Style guide `/dev/ui`** lists every primitive, component, delight effect and Yuki state, grouped by layer, in both themes.
- **Visual regression tests:** Playwright screenshots of each `/dev/ui` section (`toHaveScreenshot`, light and dark, 360 px wide). Any visual change shows up as a diff to accept or reject, so future updates can't silently break other screens.
- The reviewer agent checks: no styles in routes, no raw values, variants instead of copies, every new piece added to `/dev/ui`.
