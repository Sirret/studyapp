# Design Spec — "Snowpack: Study & Cram"

The **look and feel** of the app. Behaviour is in `CONCEPT.md`, data in `DATA_MODEL.md`, build order in `BUILD_PLAN.md`. Reference files: `docs/design/wolf.svg` (the companion) and `docs/design/wolf-preview.html` (its animation states and colours — open it in a browser).

---

## 1. Direction

A **cozy study desk by day, a lofi desk by night.** Warm cream paper, lavender as the brand colour, peach for the main action, soft rounded cards, and **Yuki**, a small snow-white wolf companion who reacts to your studying. Cute and warm, but organised and calm — about two-thirds of the way from a polished wellness app towards a kawaii one.

## 2. Principles

1. **Calm in the session, cozy around it.** Home, planner and progress screens can be warm and illustrated. The study session is one card, lots of space, no clutter.
2. **Kind, never guilt.** No coins, shop, leaderboards, streak shaming or "Yuki is sad you missed a day". Yuki encourages and is honest; it never punishes or blocks.
3. **Readable first.** Every text/background pair meets WCAG AA. Correct/wrong is never shown by colour alone.
4. **One thumb.** Primary actions sit in the bottom half; touch targets ≥ 44 px; every drag has a tap alternative.
5. **Light on 3G.** Illustrations are small SVGs; no photos, no blur effects, at most two font files.
6. **Night is first-class.** The dark theme is a deliberate "lofi night desk", not an inverted light theme.

---

## 3. Design tokens

All colours, sizes and timings are CSS custom properties in `src/lib/design/tokens.css` (mirrored in `tokens.ts` for tests). **Components never use raw hex values or pixel numbers outside the scales below.** The values are starting points: the automated contrast test (§9) may darken or lighten a shade to pass AA — keep the hue.

### 3.1 Colour

| Token            | Light (day)             | Dark (night)          | Use                                            |
| ---------------- | ----------------------- | --------------------- | ---------------------------------------------- |
| `--bg`           | `#FBF7F0` cream         | `#1B1830` deep indigo | App background                                 |
| `--surface`      | `#FFFDF9`               | `#26223F`             | Cards                                          |
| `--surface-alt`  | `#F4EEFA` lavender tint | `#312B52`             | Inset areas, input backgrounds                 |
| `--border`       | `#E8E1D5`               | `#3A3460`             | Hairlines, dark-mode card edges                |
| `--text`         | `#2B2540`               | `#F3EFFF`             | Body text                                      |
| `--text-muted`   | `#6B6482`               | `#B7AFD6`             | Secondary text                                 |
| `--primary`      | `#6B5BC9` lavender      | `#A99BFF`             | Brand, links, selected states, progress        |
| `--primary-soft` | `#E9E4FB`               | `#3B3466`             | Selected backgrounds, progress track           |
| `--on-primary`   | `#FFFFFF`               | `#1B1830`             | Text on `--primary`                            |
| `--accent`       | `#F29E6D` peach         | `#F5A97F`             | Main action button ("Start", "Check")          |
| `--on-accent`    | `#2B2540`               | `#1B1830`             | Text on `--accent`                             |
| `--success`      | `#357A55` sage          | `#7BCB9C`             | Correct (with ✓ icon)                          |
| `--success-soft` | `#E3F1E8`               | `#21402F`             | Correct feedback panel                         |
| `--error`        | `#B44A61` rose          | `#F08AA0`             | Wrong (with ✕ icon) — soft rose, not alarm red |
| `--error-soft`   | `#FBE6EA`               | `#4A2433`             | Wrong feedback panel                           |
| `--warning`      | `#8A6100`               | `#F2C14E`             | Warning text/icons                             |
| `--warning-soft` | `#FDF3D6`               | `#4A3D17`             | Sticky-note warnings (shortfall, backup)       |
| `--focus`        | `#6B5BC9`               | `#A99BFF`             | 3 px focus ring, 2 px offset                   |

**Course colours** — each course gets one, assigned in order on creation and editable (`Course.color`):

| Name       | Fill (light) | Fill (dark, used at full strength for bars, 20% tint for backgrounds) |
| ---------- | ------------ | --------------------------------------------------------------------- |
| `lavender` | `#B9A9F5`    | `#8F7FE0`                                                             |
| `peach`    | `#F7BE9B`    | `#E59A6E`                                                             |
| `sage`     | `#A9D3B5`    | `#6FAF83`                                                             |
| `sky`      | `#A8CBEF`    | `#6E9FD6`                                                             |
| `rose`     | `#F2B3C2`    | `#D8849A`                                                             |
| `butter`   | `#F3DC92`    | `#CDB050`                                                             |

Course colours are always paired with `--text` (light) / `--bg` (dark) for text and always shown with the course name — never as the only identifier.

**Theme setting:** `system` (default) · `light` · `dark` · `auto-night` (switches to dark 2 hours before the sleep window starts). One-night mode always uses the dark theme.

### 3.2 Typography

| Role        | Font                                        | Notes                                                                                                     |
| ----------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Everything  | **Nunito** (variable, weights 400–800, OFL) | Rounded and friendly. Self-hosted `woff2`, Latin subset, `font-display: swap`                             |
| Accent only | **Caveat** (OFL)                            | Handwritten. Only for Yuki's speech bubble, sticky notes and the home greeting. Latin subset, lazy-loaded |

| Style         | Size / line height | Weight                                              |
| ------------- | ------------------ | --------------------------------------------------- |
| `display`     | 28 / 34            | 800                                                 |
| `title`       | 22 / 28            | 800                                                 |
| `heading`     | 18 / 24            | 700                                                 |
| `body`        | 16 / 24            | 400                                                 |
| `body-strong` | 16 / 24            | 700                                                 |
| `answer`      | 18 / 26            | 600 — exercise prompts and options (never below 16) |
| `small`       | 14 / 20            | 500                                                 |
| `caption`     | 12 / 16            | 600 — badges and labels only, never for content     |

Numbers that change (timers, counts) use `font-variant-numeric: tabular-nums`. Text scales with the system font size up to 200% without breaking layout.

### 3.3 Spacing, shape, elevation

- **Spacing scale (px):** 4, 8, 12, 16, 20, 24, 32, 40, 56. Screen side padding 16; gap between cards 12.
- **Radius:** `--r-sm` 10 (inputs, chips), `--r-md` 14 (buttons), `--r-lg` 20 (cards), `--r-xl` 28 (sheets, hero cards), `--r-pill` 999.
- **Elevation (light):** `--shadow-1`: `0 1px 2px rgba(43,37,64,.06), 0 6px 18px rgba(43,37,64,.08)` for cards; `--shadow-2` (sheets, floating button): `0 2px 4px rgba(43,37,64,.08), 0 12px 32px rgba(43,37,64,.12)`.
- **Elevation (dark):** no shadows; cards use `--surface` plus a 1 px `--border`.
- **Icons:** Lucide (`lucide-svelte`, tree-shaken), 2 px rounded stroke, 20 px in lists, 24 px in navigation.

### 3.4 Motion

| Token           | Value                       | Use                            |
| --------------- | --------------------------- | ------------------------------ |
| `--dur-fast`    | 120 ms                      | Press states, toggles          |
| `--dur-base`    | 200 ms                      | Fades, card changes            |
| `--dur-slow`    | 320 ms                      | Sheets, page transitions       |
| `--ease-out`    | `cubic-bezier(.2,.8,.2,1)`  | Most transitions               |
| `--ease-bounce` | `cubic-bezier(.3,1.6,.5,1)` | Correct-answer pop, Yuki's hop |

- **Correct:** the chosen option pops (scale 1 → 1.04 → 1, 240 ms) and turns `--success-soft` with a ✓.
- **Wrong:** a small horizontal shake (±6 px, 300 ms) then `--error-soft` with ✕ and the correct answer revealed.
- **Next card:** the old card slides out left and fades as the new one slides in (200 ms).
- Animate only `transform` and `opacity`. No layout-thrashing animations, no `backdrop-filter`.
- **`prefers-reduced-motion: reduce`:** all motion becomes instant cross-fades; Yuki shows static poses.

---

## 4. Layout and navigation

- **Mobile first:** designed at 360–430 px wide. Content max width 560 px, centred on larger screens. At ≥ 1024 px, Today and Planner use two columns; the study session stays single-column.
- **Bottom navigation** (4 tabs, 64 px plus safe-area inset): **Today** · **Courses** · **Plan** · **Settings**. Hidden during a study session.
- **Study session** is full-screen: top bar (close ✕, course chip, phase label, progress strip with Yuki), the exercise card centred, and the action button pinned to the bottom within thumb reach.
- Respect safe-area insets (`env(safe-area-inset-*)`) for notches and gesture bars.

---

## 5. Components

Each lives in `src/lib/ui/`, uses only tokens, and appears in the style guide (§10).

| Component                       | Purpose                           | Key specs and states                                                                                                                                                                                                                                           |
| ------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                        | Actions                           | Variants: `primary` (accent fill), `secondary` (primary-soft fill, primary text), `ghost`, `danger` (error text). Height 48 (56 for the session action). States: default, pressed (scale .98), disabled (40% opacity), loading (spinner, label kept for width) |
| `Card`                          | Group content                     | `--surface`, `--r-lg`, `--shadow-1`, 16 padding. Optional course-colour top stripe (4 px)                                                                                                                                                                      |
| `CourseChip` / `CourseTab`      | Identify a course                 | Course-colour fill + name; tabs on Today/Courses switch course filter                                                                                                                                                                                          |
| `StatusBadge`                   | Card status                       | Pill, `caption` text, icon + label always: New — retest tomorrow (sparkle), Needs work (refresh), Provisional (half-circle), Exam-ready (check), Long-term secure (shield), One-night triage (moon)                                                            |
| `ReadinessRing`                 | Course readiness                  | Ring in course colour showing % exam-ready (or % secure in long-term), number in the centre, label below                                                                                                                                                       |
| `ExamCountdown`                 | Upcoming exams                    | Horizontal chips: course colour, name, "in 3 days" / "Tomorrow" / "Today 14:00"                                                                                                                                                                                |
| `ProgressStrip`                 | Session progress                  | 10 px track (`--primary-soft`) and fill (`--primary`), moon at the end, Yuki trotting along the fill (§7)                                                                                                                                                      |
| `PhaseLabel`                    | Current phase                     | `caption` uppercase: WARM-UP · NEW · RECALL · COMPARE · CLEANUP                                                                                                                                                                                                |
| `ExerciseCard`                  | Shell for every exercise          | Prompt (`answer` style), body slot, feedback slot. Same frame for all 25+ exercise kinds                                                                                                                                                                       |
| `OptionButton`                  | MC / which-one / scenario options | Full width, min 56 px, `--r-md`. States: default, selected, correct (✓ + success-soft), wrong (✕ + error-soft), revealed-correct (outline success), disabled                                                                                                   |
| `ClozeInput`                    | Typed answers                     | Large input inside the sentence; first-letter hint shown as a faded letter; submit with Enter or the action button                                                                                                                                             |
| `WordBank`                      | Tap-to-answer chips               | Chips in a wrapping row; selected chip lifts and fills `--primary-soft`                                                                                                                                                                                        |
| `DragList` / `DropZone`         | Ordering, categorising, labels    | Handle on each item; drop targets highlight in `--primary-soft`; **tap-to-select then tap-target** works everywhere                                                                                                                                            |
| `FeedbackPanel`                 | After an answer                   | Slides up under the card. Correct: ✓ + short line. Wrong: ✕, the right answer, and the contrastive line ("You chose _X_ — that's _Y_"). Then "Try again" (redo-till-right) or "Continue"                                                                       |
| `StickyNote`                    | Warnings that need a decision     | Slightly rotated (−1.5°) `--warning-soft` note in Caveat heading + Nunito body: shortfall, backup reminder, split-this-chunk prompt                                                                                                                            |
| `Banner`                        | Passive status                    | Top-of-screen strip: offline, "Update available — reload", "Ready offline ✓"                                                                                                                                                                                   |
| `Sheet`                         | Secondary choices                 | Bottom sheet, `--r-xl` top corners, drag handle, `--shadow-2`                                                                                                                                                                                                  |
| `EmptyState`                    | Nothing here yet                  | Yuki (96 px) + one line + one action ("Import your first lecture")                                                                                                                                                                                             |
| `SpeechBubble`                  | Yuki talking                      | Caveat text, `--surface`, small tail pointing to Yuki, max 2 short lines                                                                                                                                                                                       |
| `Toggle`, `Segmented`, `Slider` | Settings                          | 44 px touch height, `--primary` when on                                                                                                                                                                                                                        |

---

## 6. Screens

For every screen implement **all** states: normal, empty, loading (skeleton cards, no spinners over content), offline (banner; everything still works), and error (StickyNote with a retry).

### Today

1. Greeting row: Yuki (96 px, idle) + speech bubble ("Morning! 3 exams this week — let's start with Databases."), date.
2. `ExamCountdown` chips.
3. Today's plan: one card per course in its colour — minutes planned, cards due, a `ReadinessRing`, and "Start" (accent).
4. Shortfall `StickyNote` if the planner reports one.
5. When today's plan is done: Yuki sleepy + "That's what today can hold. Rest now." (never blocks further study).

### Courses → Course

- Course list: cards with colour stripe, ring, next exam.
- Course page: header with ring and exam date/format; topics list with the **placement** toggle (read it / haven't read) and status counts; actions: Learn (acquisition), Cram, Review, Import, Edit diagrams.

### Study session

- Top bar: ✕, course chip, `PhaseLabel`, `ProgressStrip` with Yuki.
- Centre: `ExerciseCard`. Bottom: action button.
- **Phase interstitials** between phases (§7.3).
- **Acquisition chunks:** reading view uses `body` at 17 px, max 65 characters per line, generous line height; a step strip shows _Key terms → Guess → Read → Quiz_; the time cost is shown before starting ("~12 min · 4 steps").
- **End summary:** Yuki celebrating, cards practised, how many are now Exam-ready/Secure, what's next and when ("Retest tomorrow evening"). No scores against other people.

### Plan

- Week strip of date pills (today highlighted).
- One stacked bar per day in course colours (minutes), exam days marked with a flag.
- Feasibility per exam: ✓ fits / StickyNote with the shortfall and the suggested cuts.
- Availability editor: weekday minutes (sliders), date overrides (list + add), sleep window (time pickers).

### Import

- Course picker → large paste area styled as notebook paper (faint ruled lines) → attach images/zip → "Copy the chatbot prompt" button.
- Preview: counts per type, errors listed with line numbers (tap to jump), `[CHECK]` items flagged, coverage list. Commit button.

### Diagram editor

- Deliberately plain: neutral `--surface`, no illustrations, precise handles. Toolbar at the bottom: add box (occlusion) / add node, connect, delete, undo. OCR suggestions appear as dashed boxes to accept or dismiss.

### Settings

Grouped lists: Study (retention, spelling mode, exercise toggles, occlusion mode), Learning from cold (pretest, path, breadth/depth), Availability, Appearance (theme, **Yuki: full / quiet / off**), Data (export, import, archive, storage used, "Make available offline"), Debug (logging, log panel, export logs).

---

## 7. Yuki — the snow wolf companion

### 7.1 Character

A small, round, chibi **snow-white wolf pup**: white fur (`#FCFBFF`) with pale icy-blue mask and tail tip (`#DCE5F4`, `#D3E3F7`), pink inner ears and blush (`#F6B9C4`), big deep-blue eyes (`#2E3C78` / `#4A68B8`) with white highlights, soft indigo outline (`#3B3663`, 3 px). Gentle, curious, a bit sleepy at night. Name "Yuki" (snow) is a placeholder the user can rename.

### 7.2 Construction (keep this structure)

Start from `docs/design/wolf.svg`. It is built from named groups so parts can animate independently: `#tail`, `#body`, `#head` (containing `#ear-l`, `#ear-r`, `#eyes`). Alternate eye shapes (happy ^ ^, closed) and props (sparkles, zzz) are extra groups toggled per state — see `wolf-preview.html`. Implement as one Svelte component `Yuki.svelte` with a `state` prop and a `size` prop; all motion is CSS keyframes on `transform`/`opacity`. **Props** (small separate SVG groups): book, sticky note, moon, snowflakes, zzz, sparkles. No new full-body drawings are needed — new moods come from eye swaps, ear/head/tail rotation and props. **Budget:** whole component ≤ 15 KB gzipped; no animation library.

In dark mode Yuki gets a soft lavender glow (`drop-shadow(0 0 10px rgba(169,155,255,.35))`).

### 7.3 States, triggers and placement

| State          | Trigger                                                      | Motion (max duration)                                                        | Where / size                  |
| -------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------- |
| `idle`         | Default on Today                                             | Breathing, blink every ~5 s, tail sway                                       | Today greeting, 96 px         |
| `trot`         | Progress strip advances                                      | Bounces along to the new position (500 ms), then sits                        | Progress strip, 28 px         |
| `hop`          | First-attempt correct answer                                 | One hop (400 ms)                                                             | Session header, 32 px         |
| `sparkle`      | 3 first-attempt corrects in a row; a card reaches Exam-ready | Hop + sparkles (700 ms)                                                      | Session header                |
| `oops`         | Wrong first attempt                                          | Ears droop, slight head tilt, back to idle (600 ms) — encouraging, never sad | Session header                |
| `think`        | Phase interstitial before Compare/Recall                     | Head tilt + ear twitch                                                       | Interstitial, 120 px          |
| `read`         | Interstitial before New material / acquisition reading       | Holds a small book, blinks                                                   | Interstitial, 120 px          |
| `celebrate`    | End of session                                               | Happy eyes, hop, snowflake sparkles (loops ≤ 3 s)                            | End summary, 140 px           |
| `sleepy`       | Planned work done, sleep reminder, one-night mode end        | Eyes closed, slow breathing, floating zzz                                    | Today / reminder, 96 px       |
| `worried-kind` | Shortfall / infeasible plan                                  | Ears slightly back, holds the sticky note                                    | Next to the StickyNote, 72 px |
| `sniff`        | Empty states                                                 | Head down, tail wag                                                          | EmptyState, 96 px             |

**Phase interstitials:** between session phases show a 1.2 s card — Yuki in the matching state plus one line ("Warm-up done — new material next"). Tap anywhere to skip; never more than one per phase; skipped entirely if the student has set Yuki to _quiet_.

**Session rules:** inside the exercise card Yuki never appears. In the session header Yuki is still between reactions (no constant idle motion while you read a question). Reactions fire only on first attempts, never on redo-till-right attempts.

**Settings:** _full_ (everything above), _quiet_ (no interstitials, header reactions only), _off_ (no Yuki; progress strip without runner).

### 7.4 Voice

Short (≤ 2 lines), kind, honest, never guilt-tripping. Examples:

- Greeting: "Morning! Databases first — 25 minutes."
- Shortfall: "Not everything fits before Thursday. Here's what I'd cut."
- Wrong answer (header, optional bubble): "Close one — look at the difference."
- Sleep: "That's what tonight can hold. Sleep helps it stick."
- One-night end: "We covered the important bits. Quick check in the morning?"
- Never: "Yuki is sad", "You broke your streak", "Don't give up on me".

---

## 8. Copy and tone

Plain, warm, specific. Use numbers and next steps ("Retest tomorrow evening", "4 hours short for Networking"), not vague praise. Buttons are verbs ("Start", "Check", "Continue", "Try again"). Status labels exactly as in `DATA_MODEL §4.4`. No exclamation marks in warnings.

## 9. Accessibility

- **Contrast test:** a unit test computes WCAG contrast for every text/background token pair in both themes (≥ 4.5:1 for text, ≥ 3:1 for icons, borders and focus rings) and fails the build otherwise.
- Correct/wrong/status always use icon **and** text, not colour alone.
- Visible focus ring on every interactive element; full keyboard operation on laptop, including drag alternatives.
- Screen-reader labels on icon buttons, the progress strip ("12 of 30 cards"), rings ("62% exam-ready") and Yuki (decorative: `aria-hidden`, except its speech bubble text).
- Touch targets ≥ 44 px; session options ≥ 56 px.
- Reduced motion respected (§3.4).

## 10. Implementation notes

- `src/lib/design/tokens.css` (+ `tokens.ts`), `src/lib/ui/*` components, `src/lib/ui/yuki/Yuki.svelte` + props.
- **Style guide route** `/dev/ui` (dev builds only): every component in every state, both themes, and all Yuki states side by side. The reviewer agent checks new UI against it.
- Fonts in `static/fonts/` (subset `woff2`), preloaded: Nunito only; Caveat loaded on first use.
- Performance: no raster images in the UI; Yuki and illustrations inline SVG; the style guide and diagram editor are lazy routes.
