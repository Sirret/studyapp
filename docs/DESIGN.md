# DESIGN.md: Snowpack "Cozy — The Den"

**Status: authoritative (replaces the previous DESIGN.md completely).** Source of the values: the 42 mockups on the design canvas "Snowpack — Cozy Design" (SESSION_NOTES §G). The mockups are reference pictures; **this file is the spec.** Where a mockup and this file disagree, this file wins. Reference images, if added, live in `docs/design/screens/`. Yuki's drawing is `docs/design/yuki-cozy.svg` (this replaces `wolf.svg`).

---

## 1. The feeling, in one paragraph
A warm cabin on a snowy night: lamplight, a knitted blanket, kraft paper and stamped labels, a white wolf pup by the stove. **Calm first:** study screens (reader, questions, flashcards) are quiet, and the ornament (fire, snow, window, Yuki big) lives on Home, Welcome, summaries and empty states. Built for **3+ hour sessions**: warm low-glare paper, ink rather than black, a highly readable text face, slow small animations. **Kind, never guilt:** no streak shaming, no red alarms, and wrong answers are gentle.

**Ornament budget:**
- Study screens: at most one small motif (e.g. a paw-trail).
- Home, Welcome and summaries: one illustration plus small motifs.
- Never decoration inside an answer area.

---

## 2. Architecture (unchanged rule, new values)
The look changes by editing **tokens or one component file, never screens.**

| Layer | Folder | Rule |
|---|---|---|
| 1 Base tokens | `src/lib/design/tokens/base.css` | Raw values (the palettes in §3, the type scale, spacing, radii, durations) |
| 2 Semantic tokens | `src/lib/design/tokens/semantic.css` | Meaning names (§4) mapped to base tokens |
| 3 Themes | `src/lib/design/themes/light.css`, `lamp.css` | Semantic values per theme. **Lamp-light** is the dark theme (§4.2). "Follow system" picks lamp for `prefers-color-scheme: dark` |
| 4 Component tokens | Top of each component | e.g. `--btn-primary-bg: var(--ink)` |
| 5 Primitives | `src/lib/ui/primitives/` | Button, Card, Chip, Input, Toggle, Icon, Paw, Snowflake |
| 6 Components | `src/lib/ui/components/` | §7 |
| 7 Delight | `src/lib/ui/delight/` | §8 |
| 8 Layout | `src/lib/ui/layout/` | Screen, Stack, TopBar, BottomNav, Sidebar (desktop), SafeArea |
| 9 Exercises | `src/lib/exercises/` | Built only from layers 5-8 |
| 10 Screens | `src/routes/` | **No styles** except grid placement |

Stylelint `declaration-strict-value` stays on (no raw hex, off-scale px or ad-hoc durations outside layer 1). Every component and state appears in `/dev/ui`, in both themes. Visual-regression snapshots are refreshed in the reskin commit.

---

## 3. Base palette

### 3.1 Light ("cabin")
| Token | Hex | Used for |
|---|---|---|
| `--c-paper` | `#EFE4D0` | App background (with the grain texture) |
| `--c-paper-raised` | `#F3EADB` | Cards, option bubbles, inputs, secondary button fill |
| `--c-paper-sunk` | `#E6D8BE` | Bottom nav, insets, pressed areas |
| `--c-kraft` | `#EAD7B5` | Tags, hanging labels, the "selected" tint |
| `--c-wool` | `#EFE3CC` | Knit band background, light glyphs on dark |
| `--c-snow` | `#FBF8F0` | Yuki's fur, snow, the brightest highlight |
| `--c-ink` | `#1D2230` | Text, outlines, the primary button fill |
| `--c-ink-soft` | `#4A4238` | Secondary text (7.8:1 on paper) |
| `--c-ink-faint` | `#9C8B72` | **Decorative only** (dashes, empty rings): 2.6:1, never text |
| `--c-line` | `#D8C6A6` | Hairlines between rows |
| `--c-line-strong` | `#C9AE86` | Knit band borders, stronger dividers |
| `--c-oxblood` | `#7A2621` | Accent: links, the button lip, stamps, "NEXT", Exam prep, wrong answers |
| `--c-pine` | `#2E4A3B` | Learn mode; correct answers and done states |
| `--c-night` | `#1C2740` | Practice mode; night sky |
| `--c-brass` | `#D4B26A` | Gold rims and labels **on dark fills only** (7.8:1 on ink) |
| `--c-lamp` | `#E0913A` | Fire and lamp glow (illustration only) |
| `--c-keyterm` | `#C79E6E` | Key-term underline |
| `--c-blush` | `#E7B3A6` | Yuki's cheeks and inner ears |
| `--c-frost` | `#E4E8F0` | Yuki's face mask, snow shade |

### 3.2 Lamp-light (dark)
| Token | Hex | Used for |
|---|---|---|
| `--l-bg` | `#231C16` | App background |
| `--l-bg-deep` | `#14100C` | Behind the reader, the deepest areas |
| `--l-surface` | `#2C241C` | Cards, bubbles |
| `--l-line` | `#4A3D30` | Hairlines |
| `--l-text` | `#E3D5BC` | Body text (11.6:1) |
| `--l-text-strong` | `#EFE3CC` | Headings |
| `--l-text-soft` | `#B8A68A` | Secondary text (7.1:1) |
| `--l-text-faint` | `#7D6B55` | **Decorative only** (3.3:1) |
| `--l-accent` | `#D98C70` | Accent and stamps (6.4:1) |
| `--l-lip` | `#8A3A2E` | Primary button lip |
| `--l-amber` | `#E3A35C` | Lamp glow, progress, highlights (7.7:1) |
| `--l-brass` | `#B8964F` | Rims |
| `--l-keyterm` | `#8A6A45` | Key-term underline |
| `--l-correct` | `#9CC7A6` | Correct (8.9:1) |
| `--l-pine` | `#2A4034` | Learn mode fill |

Primary button in lamp-light: fill `--l-text`, label `--l-bg`, lip `--l-lip`.

---

## 4. Semantic tokens
| Semantic | Light | Lamp |
|---|---|---|
| `--bg` | paper | l-bg |
| `--bg-deep` | paper | l-bg-deep |
| `--surface` | paper-raised | l-surface |
| `--surface-sunk` | paper-sunk | l-bg-deep |
| `--surface-tag` | kraft | l-surface |
| `--text` | ink | l-text |
| `--text-strong` | ink | l-text-strong |
| `--text-soft` | ink-soft | l-text-soft |
| `--decor` | ink-faint | l-text-faint |
| `--line` | line | l-line |
| `--line-strong` | line-strong | l-line |
| `--outline` (borders of pressables) | ink | l-text |
| `--btn-primary-bg` / `-fg` / `-lip` | ink / paper-raised / oxblood | l-text / l-bg / l-lip |
| `--accent` | oxblood | l-accent |
| `--on-accent` | paper-raised | l-bg |
| `--mode-learn` | pine | l-pine |
| `--mode-practice` | night | l-bg-deep |
| `--mode-exam` | oxblood | l-lip |
| `--mode-play` | brass | l-brass |
| `--rim` | brass | l-brass |
| `--correct` | pine | l-correct |
| `--wrong` | oxblood | l-accent |
| `--keyterm` | keyterm | l-keyterm |
| `--glow` | lamp | l-amber |

**Correct and wrong never rely on colour alone:** correct = pine plus a paw stamp ✓ plus the word "Correct"; wrong = oxblood dashed border plus ✕ plus a gentle shake. No bright red anywhere.

---

## 5. Typography
| Role | Font | Size / line-height | Notes |
|---|---|---|---|
| Display (screen titles, section titles) | **IM Fell English**, italic | 30-34 px / 1.1-1.15 (desktop up to 44) | Short headings only. **Never body, answers or buttons** |
| Wordmark and small headings | **IM Fell English SC** | 17-19 px, letter-spacing 0.08-0.1em | "Snowpack", "How it works", "Topics" |
| Body, questions, answers, buttons | **Literata** (400/500/600, italic 400) | **17 px / 1.5** UI; **reader 17-18 px / 1.55**, measure 45-65 ch (desktop reader 60-70 ch) | The workhorse. Answers 18 px |
| Labels, stamps, counters, meta | **Courier Prime** (400/700) | 12-13 px UPPERCASE, letter-spacing 0.06-0.14em | "LEARN", "§2 of 3", "EXAM TRAP", counts. Never more than ~6 words |

**Type scale (px):** 12, 13, 15, 16, 17, 18, 20, 26, 30, 34, 44. Secondary body text no smaller than 15 px, and Courier labels no smaller than 12 px.

**Fonts must work offline.** Self-host them (e.g. `@fontsource/literata`, `@fontsource/im-fell-english`, `@fontsource/im-fell-english-sc`, `@fontsource/courier-prime`; verify the package names). Use the Latin subset only and only the weights listed. Have the service worker precache them. **No Google Fonts link at runtime.** Fallback stack: `Georgia, serif` (Courier: `'Courier New', monospace`).

---

## 6. Shape, spacing, depth, texture
- **Spacing scale (px):** 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32. Screen gutter 16 px (reader 20 px).
- **Radii:**
  - `--r-xs` 3 px (stamps and tags)
  - `--r-sm` 8 px (asides, small cards)
  - `--r-md` 12-14 px (cards, the hero frame)
  - `--r-pill` 30 px (buttons)
  - `--r-full` 50% (rings)
  - **Mode doors use an arch:** `56px 56px 6px 6px`
  - **Flashcards use a soft tab shape:** `26px 26px 20px 20px`
- **Borders:** pressables and cards get a 2 px `--outline`; dividers 1 px `--line`; dashed 1.5 px for "trap" asides, empty rings and stamps.
- **Depth is flat and printed, not blurred:**
  - Primary button: `box-shadow: 0 3px 0 var(--btn-primary-lip)` (the lip)
  - Raised paper: `2px 3px 0 rgba(29,34,48,.2)`
  - Mode doors and rims: `inset 0 0 0 3px var(--rim)`
  - No soft drop shadows, glass or gradients.
- **Textures** (layer-1 CSS classes, applied by Screen and Card, never by screens):
  - `.grain`: an SVG fractal-noise data URI over `--bg` (light theme at about 13% opacity, lamp theme about 8%).
  - `.knit`: a 12 px knitted zig-zag band (oxblood V stitches on wool), with a 1 px `--line-strong` above and below. Used once under the top bar.

---

## 7. Components (layer 6). Build each in `/dev/ui` first

**Paw glyph:** the shared motif, one path plus 4 toes, used everywhere:
```svg
<g><path d="M12,22 C7,22 5,18 7,15 C9,12 10,11 12,11 C14,11 15,12 17,15 C19,18 17,22 12,22 Z"/><circle cx="6" cy="9" r="2.3"/><circle cx="10" cy="5.5" r="2.4"/><circle cx="14" cy="5.5" r="2.4"/><circle cx="18" cy="9" r="2.3"/></g>
```

| Component | Spec |
|---|---|
| **PawButton (primary)** | Full width, min-height 56 (60 for the hero CTA), radius pill, fill `--btn-primary-bg`, label Literata 18/500 `--btn-primary-fg`, lip shadow. Left: a 40 px wool circle holding an oxblood paw. Optional right meta in Courier 13 (e.g. "2 questions"). **Press:** moves down 2 px, the lip shrinks to 1 px, and a paw-press appears (§8) |
| **Button (secondary)** | Same shape, fill `--surface`, 2 px outline, ink label. Leading paw in a dashed ring |
| **Link button** | Literata 17, `--accent`, min-height 44 |
| **ModeDoor** | Arch radius, 2 px outline plus brass inset rim, fill = mode colour. Icon, then Courier 14/700 tracked label (LEARN / PRACTICE / EXAM PREP / PLAY), then a 13 px hint. A 6 px brass dot as a "has work" indicator. **Door label colour follows the fill:** dark fills (pine, night, oxblood) use wool (`#EFE3CC`) text and icons; light fills (brass, and any snow/paper door) use ink (`#1D2230`). Expose it as a component token (`--door-label`) set per variant, never hard-coded in the screen. Same rule in lamp-light, using that theme's text-strong / bg values |
| **OptionBubble ("toe-bean")** | `--surface` with a 2 px outline, radius 14, min-height 56. Left: a round letter bean (A/B/C/D). States: selected (kraft tint plus thicker outline), correct (pine outline plus paw stamp), wrong (oxblood dashed plus ✕ plus shake), revealed-correct (pine outline) |
| **Chip** | Pill, `--surface`, 1.5 px outline, Literata 15. Selected: ink fill with a paper-raised label |
| **Input** | `--surface`, 2 px outline, radius 12, height 52, Literata 18. Focus: 3 px `--accent` ring. The first-letter hint shows as faded letters. Hint state shows the revealed letters underlined |
| **Card** | `--surface`, 2 px outline, radius `--r-md`, optional raised-paper shadow. At most one motif |
| **Flashcard** | Tab radius, a slight stacked-deck offset behind it (two cards peeking), Literata 22-26 for the front term. Flips in 3D (§8). "Hint" is a link button that reveals the first 3 words |
| **PawTrail (progress)** | A row of small paws: done = solid ink, current = oxblood (gently pulsing opacity), upcoming = dashed `--decor` outline. Plus Courier meta "§2 of 3 · 3 min". It replaces bars everywhere |
| **PawRing (section status)** | 22-28 px circle: done = solid fill plus paw, current = outline paw (pulse), not started = dashed `--decor` ring |
| **Stamp** | Courier 12-13/700 uppercase, 1.5 px solid or dashed `--accent` border, radius 3, rotated −2° to 4°, on `--surface`. "EXAM TRAP", "NEXT", "ADDED", "Coming soon · Phase 11" |
| **TrapAside** | A dashed accent box, radius 8, with a Stamp label overlapping the top edge |
| **KeyTerm** | `<dfn>`: weight 600, normal style, 2 px `--keyterm` underline |
| **HangingTag** | A kraft label with a punched hole, rotated about 4°, raised-paper shadow. Hero greetings only |
| **TopBar** | 44 px icon buttons (back, settings), centre wordmark (IM Fell SC 19) or Courier breadcrumb, then the knit band |
| **BottomNav (mobile)** | `--surface-sunk`, 1.5 px top outline. Tabs: Den (home), Shelf (courses), Import notes, plus Play when Phase 11 lands. Active tab: weight 600 plus a 10 px oxblood paw under the label. Min-height 60 |
| **Sidebar (desktop ≥ 1024 px)** | 260 px, the same items, plus Yuki small at the bottom |
| **ReadinessMeter** | A paw-trail of 10 paws (filled = ready share) plus Courier "68% exam-ready"; per-topic rows reuse PawRing |
| **ChecklistRow** (import map, scope picker) | PawRing plus a title, a 44 px row, an indented section list |
| **Toggle** | 52×32 track; on = ink with a paw on the knob |
| **Sheet / Dialog** | `--surface`, 2 px outline, radius 14 at the top, a knit band at the top edge |
| **EmptyState** | Yuki (napping, waiting or curious), one line in Literata, one action. From the "Empty & error states" mockup |
| **Yuki** | §9 |

---

## 8. Motion and delight (layer 7)
All motion uses **only `transform` and `opacity`**, never blocks input, and is **off under `prefers-reduced-motion`** (`* { animation: none !important }` inside delight and the Yuki styles). The session controller triggers it; exercise components never do.

| Name | Where | Spec |
|---|---|---|
| `paw-press` | Any PawButton or OptionBubble tap | A paw at the touch point, 20 px, scale .6 → 1, fades out, 300 ms |
| `stamp` | Correct answer, a card reaching exam-ready, "Know it" | Scale 1.7 → .9 → 1 with rotate −20° → −8°, opacity 0 → 1, about 450 ms |
| `pawstep` | PawTrail advancing | The new paw drops in: translateY −6 → 0, scale 1.25 → 1, 400 ms |
| `pawin` | The current paw or ring | Opacity .35 → 1, 2.4-2.6 s alternate, infinite |
| `card-flip` | Flashcard | rotateY 0 → 180°, 450 ms ease, `backface-visibility: hidden` |
| `card-fly` | Still learning / Know it | translateX ±120% plus rotate ±12°, 350 ms; the next card rises (`riseA`/`riseB`: translateY 12 → 0, opacity) |
| `nudge` / shake | Wrong answer | translateX 0, −6, 6, −3, 0 over 300 ms (once) |
| `press` | Button press | translateY 3 px while pressed; the lip disappears (`pshadow`) |
| `fall` | Snow on Welcome, Home, empty states | Flakes translateY −20 → 110 px, opacity 0 → 1 → .2, 9 s linear infinite, staggered delays. ≤ 8 flakes |
| `flicker` | Stove fire and lamp glow | Opacity .78 ↔ 1, 3.6 s |
| `sway` | Hanging tag | rotate 4° ↔ 1.5°, 5 s |
| `count-up` | Summary numbers | 600 ms (opacity and transform only; the number text updates via JS) |
| `march` / `slot` | Put-in-order drag | A dragged item lifts (`lift`: translateY −4, raised shadow); the slot pulses |

**Sounds** (from SESSION_NOTES §D7): a soft paw tap, a snow crunch on correct, a low soft note on wrong, a stamp sound on exam-ready. They have their own toggle and never play during reading.

---

## 9. Yuki
- **Source:** `docs/design/yuki-cozy.svg`. Keep the group ids: `#tail #body #head #ear-l #ear-r #eyes #bandana #zz`. A white wolf pup: tall ears with blush, a frosted face mask, a cheek ruff, a bushy tail and an **oxblood bandana**. Never a cat.
- **States** (animate only those groups, transform/opacity only):

  | State | When | Motion |
  |---|---|---|
  | idle | Home, reader footer | `breathe` (scaleY 1 ↔ 1.018, 4.5 s) plus a slow `wag` (rotate 0 ↔ −11°, 2.4 s) |
  | happy | Correct streaks, summary | `wagup` (−14° ↔ −30°) plus `hop` (translateY −6 px) |
  | thinking | Waiting for an answer, loading | `ear` tilt on one ear, blink |
  | sleepy | Nothing due, late night, one-night mode | slow breathe plus `zz` drifting up |
  | celebrate | Topic done | happy plus a stamp nearby |

- **Placement:** big (about 100-180 px) on Welcome, Home, summaries and empty states; small (32-64 px) in the reader footer and sidebar. **Never inside the question or answer area.**
- **Settings:** Yuki = full / quiet (small and static, no hops) / off (no Yuki; functional feedback stays). No guilt copy, ever.

---

## 10. Layout and breakpoints
- **Mobile first** at 360-430 px. Gutter 16; bottom nav; one column.
- **Tablet 768+:** two columns where useful (course: topics plus modes).
- **Desktop ≥ 1024:**
  - Sidebar (260) plus content, max-width 1280, centred. A `flex-wrap` row so it stacks on phones.
  - **Reader:** section outline (left) · text at 60-70 ch (centre) · key terms and tip (right).
  - **Flashcards:** big centred card plus a deck panel, with keyboard hints (Space flip, ← still learning, → know it, H hint).
- Every drag has a tap alternative (up/down buttons, or tap-to-place). Touch targets ≥ 44 px.

---

## 11. Accessibility (non-negotiable)
- Text contrast ≥ 4.5:1 in both themes (the values in §3 already pass). `--decor` is never used for text.
- Real `<button>`, `<a>` and `<label>`. Icon-only buttons get `aria-label`. Decorative SVG gets `aria-hidden`. Progress paws have one `role="img"` with an `aria-label` ("Section 2 of 3").
- State is never shown by colour alone (icons and words alongside).
- Reduced motion disables all decorative animation; essential feedback becomes an instant state change.
- Focus ring: 3 px `--accent`, offset 2 px, always visible on keyboard focus.

---

## 12. Screens and phases
Each screen is built when its phase arrives, from these components. The mockup names match the canvas.

| Mockup | Route / feature | Phase |
|---|---|---|
| Welcome, Home, Today | `/`: first visit (sample course), returning home | **Reskin** (exists) · Welcome refinements 8.6 |
| Courses | Shelf / course list | 8.6 (SESSION_NOTES A11) |
| Import · questions, Import · preview | `/import` | **Reskin** (built in Import v2) |
| Course, Cheat sheet | `/course/[id]`, course map panel | **Reskin** |
| Pick what to study | Scope picker → mode | 8.6 |
| Meet the terms, Match check | Learn: terms plus matching | 8.6 |
| Reader, Question + look-back, Topic done | Learn reader flow | 8.6 (reader exists → rework) |
| Flashcards, Quiz typed / list / order, Session summary | Practice | 8.6 |
| Exam prep, Planner, One-night mode | Exam prep, planner, one-night | **Reskin** (built in 7/8) |
| Make a card by hand, Browse & edit, Review "Added by the chatbot" | Manual cards, card list (8.5), added review | 8.6 (the card list exists → reskin) |
| Settings | `/settings` | 8.6 (SESSION_NOTES A11) |
| Backup & export, Install & offline | Transfer, PWA | 9 |
| Empty & error states | Across the app | 10 (polish) |
| Play hub | `/play` | 11 |
| Dark mode screens | The lamp theme | **Reskin** (tokens) |
| Desktop screens | The layouts in §10 | Every phase builds its screens responsively; Reskin adds the Sidebar |

**Known mockup issues to correct when building:** the cheat sheet's "How it connects" paragraph overflows on mobile (make it collapsible); all numbers in the mockups are placeholders.
