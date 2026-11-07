# Snowpack: Study & Cram — Concept & Design Reference

_A flashcard and cram-study app for Computer Science & Information Systems students_

Version 1 concept · 6 November 2026 · grounded in the research report “Cramming science for CS students”

# 1. What this app is

**In one line:** you enter your notes as cards, the app tests you with the exercise that fits each kind of material, it always makes you recall from memory and always shows the answer when you miss, and a scheduler — not you — decides when a card is learned and when you see it next.

The aim is to learn a subject fast for a deadline _and_ keep it long-term, using study methods that have evidence behind them. Two design rules shape everything: **no AI runs inside the app** (so it costs nothing to run), and **typing is kept minimal** (so spelling errors never corrupt the scoring). Anything the app scores is machine-checkable; anything open-ended is self-rated and kept out of the scoring.

There are **three modes** over the same cards: **acquisition** (learn it the first time, from cold), **cram** (peak recall for an exam within a week), and **long-term** (keep it for months). A card moves through them in that order.

This is a concept reference, not a build spec. Every number in it (the “3 corrects”, the 35% gap, the new-card caps) is a **starting default** taken from research on non-CS material, to be logged and tuned against real results. The evidence caveats are collected in section 17.

# 2. The parts

The app is only four moving pieces, plus an input system and a side lane:

- **Cards.** Your content. Each card carries its material type (chosen as a template when you create it), tags from your course structure, and a priority.

- **Exercises.** The ways it tests you. The card’s template decides which exercises are available; you never pick one mid-review.

- **Grader.** Deterministic. Checks right/wrong and handles spelling. It never judges open text, so it needs no AI.

- **Scheduler.** The brain that decides, per card, whether it is learned and when it reappears. Long-term and cram are two schedulers over the same cards and exercises (section 7); acquisition mode sits in front of them (section 8).

- **Import / quick-entry.** How notes become cards fast, with an optional AI prompt you run in your own chatbot (section 14).

- **Self-rated lane.** Conceptual “explain it”, blurting, and covert recall. Useful, but un-gradeable — so it is tracked separately and never feeds the scoring (sections 4 and 12).

# 3. Material types and card templates

The app can’t read your material, so it learns the type from the template you pick when you make the card — and the template is obvious from what you enter. One template switches on the exercises that fit it.

| **Material type**   | **Example**                         | **Template → exercises**                                                          |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| Fact / terminology  | TCP = connection-oriented; port 443 | Fact → cloze, multiple choice, matching                                           |
| Concept / theory    | Why TCP uses a 3-way handshake      | Concept → explain-it + checklist (self-rated), cloze over structure               |
| Procedure / problem | Normalization steps; Dijkstra       | Procedure → worked example, fade, sequence, Parsons, subgoal labels, new instance |
| Diagram / structure | OSI stack, ER diagram, query plan   | Diagram → image occlusion, node-edge build, hotspot                               |
| Comparison / class. | TCP vs UDP; 2NF vs 3NF              | Comparison → table rebuild, which-one, scenario, categorize, pick-the-principle   |

**One topic becomes several cards.** A topic is rarely one type. Normalization, for example, needs a sequence card for the 1NF→BCNF order _and_ separate cards for what distinguishes each form — because knowing the order isn’t the same skill as telling 2NF from 3NF on a real table. See the worked example in section 15.

# 4. The full exercise catalog

Grouped by the action each one demands. The last column is what matters most: only **auto-graded** exercises count toward the “3 corrects” that drive the scheduler. The self-rated lane never does.

## Recall — you produce the answer

| **Exercise**              | **What it does**                                                                                  | **Counts?**     |
| ------------------------- | ------------------------------------------------------------------------------------------------- | --------------- |
| Cloze / fill-in-the-blank | Key term hidden; type it (spell-check) or use first-letter mode                                   | Yes             |
| Worked-example fade       | A shown procedure has a step blanked; supply it (progressive)                                     | Yes             |
| Solve a new instance      | A fresh problem with an exact checkable answer (Dijkstra distances, resulting tables, DFA states) | Yes — strongest |

## Choose — you pick

| **Exercise**    | **What it does**                                             | **Counts?** |
| --------------- | ------------------------------------------------------------ | ----------- |
| Multiple choice | Wrong answers pulled from sibling cards so they’re plausible | Partly\*    |
| Multiple-select | “Select all that apply” — harder than single MC              | Partly\*    |
| Matching        | Pair terms to definitions; light warm-up only                | No          |
| True / false    | Excluded — 50% guess, and it plants false statements         | Dropped     |

_\* Choose-type answers can help a card climb while accuracy is low, but the final, criterion-meeting correct must come from a Recall or Arrange exercise. The target is recall, not recognition._

## Arrange — you order or build

| **Exercise**           | **What it does**                                                                          | **Counts?**                                       |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Sequencing             | Drag steps into the right order                                                           | Yes                                               |
| Parsons-style          | Order steps with extra wrong ones to reject (standard procedures only)                    | Yes                                               |
| Subgoal-label matching | Drag labels like “relax edges” onto the steps they describe                               | Yes                                               |
| Image occlusion        | A label on a diagram is hidden; type it, drag it onto the box, or tap it from a word bank | Yes if typed or dragged; word bank counts like MC |
| Structure assembly     | Rebuild the nodes and connections of a diagram                                            | Yes                                               |
| Hotspot                | Tap the correct region of an image                                                        | No (warm-up)                                      |

## Sort & discriminate — you compare or classify

| **Exercise**                    | **What it does**                                                                                    | **Counts?** |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | ----------- |
| Categorize                      | Drag items into the right buckets                                                                   | Yes         |
| Odd-one-out                     | Pick the item that doesn’t belong                                                                   | Yes         |
| Which one? (property → concept) | Given a property, pick the concept it describes                                                     | Yes         |
| Scenario → category             | “A video call needs low latency → which protocol?” Applies the distinction to a situation           | Yes         |
| Table-row rebuild / cell cloze  | Reconstruct a comparison table                                                                      | Yes         |
| Pick the principle              | After a comparison set, choose the trade-off that explains the difference (shown after, not before) | Yes         |

## Self-rated lane — never counts toward the criterion

| **Exercise**            | **What it does**                                                 | **Counts?** |
| ----------------------- | ---------------------------------------------------------------- | ----------- |
| Flip-card covert recall | Think, flip, rate yourself — fallback for anything un-checkable  | No          |
| Explain-it + checklist  | Recall the “why”, reveal key points, tick what you hit           | No          |
| Blurt triage            | Recall a whole topic; tap what you missed; those cards resurface | No          |
| Redraw-and-compare      | Sketch on paper, check against the reference                     | No          |
| Worked-example study    | See the full solution with labels once, before the first fade    | No (setup)  |
| Pretest (guess first)   | Unscored multiple choice before you study a topic                | No          |

# 5. Scoring — the “3 corrects” rule

**Successive relearning.** A card needs 3 correct recalls in its first session, then 1 correct in each of about three later spaced sessions. In a real course this lifted grades by roughly a letter.

**Recall-weighted.** Choose-type (MC) answers can advance a card while its accuracy is below ~75%, but at least the final correct must be Recall or Arrange. Matching, hotspot, pretests and warm-ups never count.

**Wrong first try.** You see the answer and redo the card until right (options reshuffled so you can’t just re-tap), but only the _first_ attempt is logged. A miss resets that card’s progress toward the 3 and re-queues it a few cards later.

**The scheduler decides, not you.** There is no “I know this” skip — the single most important rule, because when students chose when to drop cards the benefit vanished.

**Feedback always.** Every item ends with the correct answer shown, including the ones you got right. Feedback roughly doubles the benefit of being tested.

# 6. How a study session is organized

Variety helps, but a random exercise type every card is both weak (mixed-format quizzes scored lowest) and annoying. Two things are kept apart:

- **Content interleaving** — mixing confusable topics (2NF and 3NF cards near each other) — is good and is kept.

- **Format churn** — a random format each card — is dropped. Each card climbs a fixed format path (e.g. MC → cloze → recall).

So a session runs in phases, not a shuffle:

1.  Warm-up (uncounted): matching or a pretest.

2.  New material: worked-example study, then progressive fades.

3.  Recall drilling: the fixed format paths toward the 3 corrects.

4.  Discrimination: compare, scenario and pick-the-principle, with confusable topics interleaved.

5.  Cleanup: the weakest cards, lowest predicted recall first.

# 7. Long-term and cram modes

Both modes use the same cards, exercises and grader. The only thing that changes is the scheduler on top. Both assume the material is already learned; for a cold start, acquisition mode (section 8) comes first.

## Long-term mode (FSRS)

The background engine, for durable memory. It spreads reviews out, widens the gap each time you prove you still know a card, shows only what’s due, and feeds in a few new cards a day. This is what runs all semester so nothing rots, and what carries knowledge to a cumulative final.

## Cram mode (deadline, ≤ 1 week)

For peak recall on exam day, not long-term memory. It throws out the “stretch over months” logic and instead:

- Triage — find which cards would survive to the exam unaided; those get only the final pass.

- Feasibility check — does the work fit the time? If not, show the shortfall honestly (“14 hours of work, 6 available — here’s what to cut”) and degrade in a fixed, visible order.

- Cap new cards per day, introduce them in evening sessions, none on exam day.

- Review weakest (lowest predicted recall) first. This is for material you already know; from cold, acquisition mode orders easy and high-value first instead.

- Within a session, re-show a card at growing gaps until it hits the criterion.

- Set the next session about 35% of the remaining days away (wider for recall/essay exams, tighter for MC), capped by FSRS’s own interval.

- Full pass the evening before; short top-up of the weakest cards on exam morning; the plan never schedules an all-nighter (it reminds, it never locks you out).

- Afterward, hand every card back to the long-term engine.

## Cram-fragile decay

A cram pass is not durable memory, and the app encodes that directly. A correct earned in a **massed/cram** session grants only a small, capped stability, so the card is flagged **cram-fragile** and given a short half-life — it decays fast on purpose. It stays fragile until it survives **one genuine spaced interval** in long-term mode (a correct recall after a real gap of a day or more), at which point it converts to the normal, widening cycle. So cram builds exam-readiness and almost no durability; only spaced success builds durability.

## Card states

Because of this, each card shows one plain status, so a cram pass is never mistaken for lasting knowledge: **“New — retest tomorrow”** (just met in acquisition mode), **“Provisional”** (one correct on a later day), **“Exam-ready”** (correct on at least two different days, or cram criterion met — good for Friday, says nothing about next month) and **“Long-term secure”** (FSRS has watched you hold it across widening gaps — this is the one that survives).

# 8. Acquisition mode (learning from cold)

**When it runs.** When the student hasn’t read the material yet. Cram and long-term both assume the content is already in your head; this stage gets it in, then hands the cards on. It reuses the existing exercises — it adds a reading step and orders things differently.

## The flow, per chunk

The material is split into small chunks (one idea each). Every chunk goes through the same steps:

1.  **Pre-train.** Meet just the key terms and components first, as quick cards. Teaching the vocabulary before the full idea is one of the better-supported moves (about 0.75 in the research).

2.  **Pretest (optional).** Up to 3 covert “tap when you have a guess, then reveal” items, framed as “warm-up, not graded”. One tap skips it; after two skips it hides for the session. It helps only the exact facts it asks about, so it is a small primer, not a teaching step, and it earns no scheduler credit.

3.  **Read.** The chunk itself is shown.

4.  **Chunk quiz.** Recall formats first (fill-in-the-blank, drag-to-order), multiple choice only as a fallback, each with contrastive feedback explaining why the wrong choice was wrong. It earns _no_ scheduler credit: at short delay it barely beats rereading. Its job is engagement and boosting the next chunk.

5.  **Retest tomorrow.** The chunk’s cards appear as the first block of tomorrow’s session. Mastery is judged here, never on the day you first meet a card.

Before a chunk starts, the app shows its cost (e.g. “~12 min, 4 steps”) and a progress strip, so the student knows what they’re signing up for.

## Ordering: easy and high-value first

From cold, grinding the hardest items is wasted effort — in the research, hard-item recall stayed at 0–3% while easy items climbed. So acquisition orders by value (syllabus or past-paper priority) and by what the student can get a foothold on, and leaves the hardest for later. This is the opposite of cram’s weakest-first rule, because cram is for material you already know.

## Chunk size and splitting

About one coherent idea: 150–400 words, or one diagram. If first-attempt accuracy on a chunk is below 75%, the chunk is flagged, not split mid-session (that feels like punishment and adds reading). It is re-quizzed tomorrow and split only if it is still below 75% then — which also avoids trusting same-day accuracy, which is inflated right after reading.

## Procedures

Pre-train the components → study one worked example with subgoal labels (e.g. “initialise distances”, “relax edges” on Dijkstra’s steps) → fill in the next state on a different instance → fade steps. Parsons-style ordering is offered as a fallback, labelled untested for non-code procedures, and dropped if students keep failing it. No self-explanation prompts in the scored path; the latest evidence says they can reduce the worked-example benefit. “Explain it” stays in the optional self-rated lane.

## Full path and quick path

The feasibility check (the same one cram uses) chooses. When time allows, the full path runs. When it doesn’t, the **quick path** drops the pretest and keeps pre-train → read → quiz → retest tomorrow. Under a deadline the default is a breadth pass first (pre-training plus one example per high-value topic), then deepening by priority, shown on a “you are here” coverage map. This is a soft default the student can override — whether breadth beats depth under a deadline has never been tested.

## Handoff to cram and long-term

Invisible. The student never picks a mode for cards acquisition owns; tomorrow’s retest is simply the first block of tomorrow’s session, and each card shows its status (section 7). A card needs correct answers on two different days before it counts as exam-ready.

## Placement: have you read it?

When a topic is imported, one tap per topic tells the app where to start: “haven’t read” sends its chunks into acquisition; “read it” sends its cards straight to review (cram or long-term). Useful when you’ve read some topics and not others.

## AI-generated chunks

When there are no notes and the student’s chatbot supplies the content, every generated chunk carries a visible banner, a “check against your syllabus” nudge, and a one-tap “report wrong” button that hides it. A wrong generated fact costs a student far more than the setup it saves.

# 9. One-night mode (exam tomorrow, from cold)

Acquisition needs a next-day retest, so with the exam tomorrow nothing can reach “exam-ready”. Instead of pretending, the app runs a defined damage-control plan, labelled “one-night triage” on screen. The overnight gap stands in for the “next day”: learning in the evening and then sleeping beats learning followed by a full day awake, and the exam-morning check comes after that gap.

1.  **Triage.** The feasibility check says honestly how much one evening can cover, and the app takes only the highest-value chunks (syllabus or past-paper priority). The hardest material from cold is skipped on purpose.

2.  **Evening block 1.** Pre-train → read → quiz on each chosen chunk (the quick path).

3.  **Short break, then block 2.** A mixed re-quiz across everything from block 1, so there is a real gap inside the evening.

4.  **Sleep reminder.** Once the planned work is done, the app shows a clear “you’ve covered what tonight can hold — sleep now” message. It never locks you out; you can keep going. Losing a night’s sleep before learning is one of the most damaging things in the research, so the reminder is firm, but the choice is yours.

5.  **Exam-morning check.** A re-quiz of everything from the evening. This acts as the delayed retest: cards passed both evening and morning get the best status possible for one night, and anything missed gets one last look.

_Flag: using the morning check as the delayed retest is reasoning from the sleep findings, not a directly tested design._

# 10. Several exams at once

With several exams close together, separate cram plans would each assume they own your whole day and overbook you. So all courses share one planner:

- **Availability calendar, not a fixed budget.** A default number of minutes per weekday, per-date overrides (“Tuesday: work 9–5, only 30 min”), and your sleep window.

- **One combined feasibility check.** For every exam date, the work due by that date must fit in the time available up to that date. The first date that fails is named in the shortfall message (“Thursday’s networking exam is 4 hours short”).

- **Daily split by urgency.** Each day’s minutes go mostly to the exam with the least slack (time left minus work left), while the others keep ticking over so nothing goes cold.

- **Re-planned every morning.** It plans minutes per course for today plus a rough forecast, not a rigid hour-by-hour timetable. If you miss a day or work runs late, tomorrow’s plan absorbs it and the feasibility check updates.

- **After each exam,** that course drops to long-term mode and its time goes to the rest.

# 11. Algorithms

No new research was needed here: round one found that no study app publishes a principled exam-date planner, so these are established computer-science algorithms applied to studying.

## The feasibility check

**Work.** For each card, FSRS predicts the current chance of recall, p. Reaching 3 correct takes on average about 3 ÷ p attempts; each later relearning session adds about 1 ÷ p. Multiply by seconds per attempt, measured per user and material type (defaults: 10–20 s for facts, longer for procedures). Acquisition chunks add reading time (word count ÷ about 200–250 words per minute). Add a safety margin, since the estimates run optimistic.

**Time.** Available minutes from the availability calendar.

**Several deadlines.** Grand totals aren’t enough: the test is that for every exam date, the work due by then fits the time available up to then (the “processor demand” condition from deadline scheduling).

## Every part and its algorithm

| **Part**                        | **Algorithm**                                                                       | **Why**                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| When a card is due (long-term)  | FSRS                                                                                | State of the art, open source                                                  |
| Recall chance at exam time      | FSRS forgetting-curve formula                                                       | Deterministic, comes with FSRS                                                 |
| Feasibility                     | Expected attempts + per-deadline check                                              | Correct for multiple deadlines, cheap                                          |
| What to cut when short          | Greedy by value per minute (knapsack)                                               | Priority × expected recall gain ÷ minutes; near-optimal and explainable        |
| Splitting each day across exams | Least-laxity-first, re-planned daily                                                | Later exams aren’t starved, unlike plain earliest-deadline-first               |
| Order within a session          | Priority queue                                                                      | Lowest recall first (cram); value/ease first (acquisition)                     |
| Re-showing a card               | Fixed reinsertion lags 3 → 5 → 10 → 20                                              | Simple, already designed                                                       |
| Gap to next session             | α × days remaining, clamped                                                         | Already designed                                                               |
| Cram-fragile cards              | Cap on FSRS stability update                                                        | A rule, not a new algorithm                                                    |
| Spelling                        | Damerau–Levenshtein edit distance                                                   | Counts swapped letters as one typo; tolerance scales with word length          |
| Distractors                     | Same-tag/column siblings, first-letter + length filter, ranked by logged confusions | Plausible, and ones you’ve actually mixed up                                   |
| Concept-map / diagram check     | Set difference on nodes and edges                                                   | Shows exactly which links you missed                                           |
| Suggesting hide-boxes           | OCR (Tesseract.js, on-device)                                                       | Finds label positions on any printed image; free and offline                   |
| Diagram layout                  | ELK.js layered layout                                                               | Places boxes and arrows automatically for flowcharts, plans and state machines |
| Drag-label check                | Point-in-box hit test                                                               | Was the label dropped inside the right box?                                    |
| Phone ↔ laptop sync             | Append-only event log, merged by event ID, replayed                                 | No conflicts: history is only added, never overwritten                         |
| Card status                     | Small rule-based state machine                                                      | Transparent                                                                    |

**Deliberately not used in v1: an exact optimiser (integer linear programming).** It would find the provably best plan by searching every combination of which chunk gets studied on which day, under the time, deadline and spacing rules. It is avoided because it needs a solver library, can be slow on a phone with thousands of cards, is hard to explain to a student, and its inputs are estimates anyway — so a good plan re-made every morning captures most of the benefit.

# 12. Challenges and how they’re handled

| **Challenge**                         | **How it’s handled**                                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spelling wrecking the score           | Two modes: (a) type with fuzzy match + a grow-as-you-go accept list; (b) first-letter mode, where a missed card next shows its first letter and a word bank whose options all start with that same letter (so the letter isn’t a giveaway). |
| Knowing when a card is done           | The scheduler decides, never the student. No skip button.                                                                                                                                                                                   |
| A big drag being punishing            | It doesn’t force a full redo; the wrong links are peeled off as small focused cards, drilled uncounted until known.                                                                                                                         |
| Conceptual “why” can’t be auto-graded | It lives in the self-rated lane, tracked separately, and never feeds the scoring. Whether it should later influence scheduling is an open question (section 17).                                                                            |
| Running cost                          | Nothing open-ended ever counts, so the app is fully deterministic — no AI, no API bill.                                                                                                                                                     |
| Guessing                              | Recall is preferred over recognition; MC distractors come from sibling cards; first-letter options share a letter; true/false is dropped.                                                                                                   |
| Bulk entry being tedious              | The import system and the optional AI prompt (section 14) turn a lecture into cards in one paste.                                                                                                                                           |
| Evidence is from non-CS material      | Parameters ship as defaults; the app logs delayed results so they can be tuned to CS theory.                                                                                                                                                |

# 13. Diagrams

Diagrams are all different — an ER diagram, the OSI stack and a SQL-to-relational-algebra query plan share nothing — so there’s no per-course template. Two kinds of diagram card cover them all, and the same diagram can be both.

## 1. Image occlusion — for any picture

- **Getting the image in.** Through the app: upload a file, paste a screenshot, or take a photo. The import screen also accepts images alongside the AI’s text, which can refer to them by file name (“@occlusion slide12.png”), and accepts a .zip of a text file plus its images. The chatbot is never asked to produce images or zips; the images are already on your device.

- **Hide-boxes suggested automatically (OCR).** Tesseract.js reads the text on the image inside the browser and returns where each word sits; the app turns those into suggested hide-boxes, which you confirm or adjust. It runs on the device, is free, and works offline once its language file (a few MB) is downloaded. It only helps you make the card — scoring stays deterministic. Good on printed text, poor on handwriting (place those boxes yourself).

- **Rendering.** The image is shown as-is, with the boxes drawn on top as an SVG overlay. Each box is stored as a fraction of the image’s width and height, so it lines up on any screen size.

- **Review modes.** Hide one (one box covered, the others visible as context) or hide all (everything covered, revealed one at a time).

- **Answering, and how it counts.** Typing the label (fuzzy spelling) or dragging it onto the box is recall, so it counts fully and can be the final correct; the drop is checked by whether it lands inside the box. Tapping it from a word bank is recognition and counts exactly like multiple choice: it helps a card climb but can’t be the final correct.

## 2. Structured diagrams — for box-and-arrow concepts

- **Stored as data, shown as a picture.** The diagram is kept as nodes and labelled arrows, which is what lets the app quiz its structure. On screen it is always a drawn diagram, never text.

- **Made by AI from a screenshot.** Paste the lecture diagram into your own chatbot with the import prompt; it writes a @diagram block with one arrow per line (“Parser -\> Optimizer : relational algebra”). The app lays it out automatically and draws it, and you check and fix it in the editor (drag, rename, add a missing arrow).

- **Layout and drawing.** ELK.js computes the layout (the standard layered method for flowcharts, query plans and state machines; a simple vertical stack for layered models like OSI). Svelte Flow draws it as SVG with draggable nodes, drag-to-connect arrows, zoom and pan.

- **Exercises.** Hide a node’s label, hide an arrow’s label, remove arrows and reconnect them, or reorder layers. Rebuilds are marked by comparing your arrows with the reference as sets, so it shows exactly which you missed or added.

- **Keeps the original.** Each structured diagram stores the source screenshot, with a “show original” button after you answer, so you still see the lecture’s picture.

- **Accuracy.** AI transcription is good on clean diagrams and weaker on dense or messy ones, where it can miss an arrow, flip a direction or invent a label — which is why you check it in the editor before studying.

## Which to use

Lecture slides, handwritten or visual-heavy diagrams → image occlusion. Concepts you want to be able to rebuild → a structured diagram. The same diagram can be both.

## Why SVG, not three.js

three.js is a 3D engine (WebGL) for 3D scenes and games. These diagrams are 2D, and SVG is the right tool: sharp at any zoom, every shape is its own element so tapping and dragging are easy, and it is light enough for cheap phones and 3G. three.js would add a large download and battery drain for no benefit.

# 14. Import & quick-entry

Bulk entry is the real friction, so the app ingests a simple text format — and the heavy lifting can be done by **your own** chatbot, which keeps AI out of the app and off your bill. The app only ever parses clean text.

## The import format

A line-based format; each @block maps to a card template, so the type is declared, not guessed. For acquisition mode, @keyterms (pre-training), @read (the chunk text) and @example (a worked example as subgoal label :: step) come before the cards that test each chunk:

```
@deck Networking
@tag osi
@priority high
@keyterms
TCP :: Transmission Control Protocol
@read
TCP sets up a connection before sending and guarantees ordered,
reliable delivery. UDP sends without a connection, faster but
with no delivery guarantee.
@fact
TCP :: connection-oriented, reliable, ordered delivery
UDP :: connectionless, unreliable, low-latency
@cloze
A {{2NF}} table removes partial dependencies on a composite key.
@sequence Normalization
1NF
2NF
3NF
BCNF
@compare
|            | TCP                 | UDP            |
| connection | connection-oriented | connectionless |
| reliability| reliable            | unreliable     |
@scenario
A video call needs low latency :: UDP
@diagram stack OSI
Application
Transport :: end-to-end delivery
Network :: routing
@diagram flow Query processing
SQL query -> Parser : parsed into
Parser -> Optimizer : relational algebra
Optimizer -> Executor : query plan
@occlusion slide12.png
@example Dijkstra
initialise distances :: set source to 0, all others to infinity
pick closest unvisited :: choose the node with the smallest distance
relax edges :: update each neighbour if a shorter path is found
```

**Images.** Images come in through the app, not through the chatbot: on the import screen you paste the text and attach images (upload, paste a screenshot, or take a photo), and text blocks refer to them by file name. The import also accepts a .zip of a text file plus its images — the same format the app’s own export uses.

## The AI prompt you paste into your own chatbot

Rewritten to be exhaustive and to group by your course structure — the earlier version optimized for format and would silently drop material. It can’t know your exact exam unless you also paste the syllabus or a past paper; given those, it marks matching cards high priority.

```
You convert my lecture notes into import-ready study cards in a strict
format. Completeness and accuracy matter more than brevity.

INPUTS
- My lecture notes (required).
- Optionally my syllabus, past papers, or a line like "exam focus: X, Y".
  If given, use them to set priority.

COVERAGE
- Work through the notes section by section, in order. Skip nothing.
- One card per distinct testable unit: every definition, term, named
  theorem/law, process step, property, distinction, cause/effect.
- Do not summarize detail away; do not merge separate facts.
- Use ONLY what is in my notes (and syllabus/papers). Add no outside
  knowledge and invent no examples.
- If something is unclear, still make the card and append " [CHECK]".
- Drop exact duplicates; keep distinct-but-similar cards.

GROUPING
- Use my notes' own headings: top-level topic -> @deck, sub-topic -> @tag.
- Keep each card under the section it came from.

DECOMPOSITION (one topic -> several cards)
- A process: a @sequence for the order AND @fact/@cloze for what defines
  each stage AND @compare/@scenario for how adjacent stages differ.
- A comparison: a @compare table AND @scenario cards (situation -> which).
- A multi-part definition: one @cloze per part, not one long card.
- A diagram (in my notes or a screenshot I attach): a @diagram block,
  one arrow per line as A -> B : label. Never invent nodes or arrows
  you can't see; append [CHECK] if a label is unreadable.

CHUNKS (for learning from cold)
- Split the notes into chunks of one idea each (about 150-400 words).
- For each chunk output, in order: @keyterms (the terms to learn first),
  @read (the chunk text, in clear sentences), the cards that test it,
  and for a procedure one @example as "subgoal label :: step" lines.

IF I GIVE YOU NO NOTES (only a syllabus, topic list or past papers)
- Stay strictly within what those sources name. Start every generated
  @read with [GENERATED] so I know to check it against my course.

PRIORITY
- With a syllabus/past paper/exam focus: matching cards -> @priority high.
- Otherwise infer: anything defined, named, bolded, repeated, or listed
  as a rule -> high; supporting detail -> normal.

OUTPUT
- Output ONLY the format below, no commentary, except the final @coverage.
- End with @coverage and the list of section headings you processed, so
  I can confirm nothing was missed.

FORMAT
@deck <topic>
@tag <subtopic>
@priority high|normal
@fact
term :: concise definition (paraphrased)
@cloze
sentence with the key term in {{ }}
@sequence <name>
step
@compare
| | A | B |
| attribute | value | value |
@scenario
situation :: correct answer
@diagram stack <name>      (one layer per line, top to bottom)
layer :: role
@diagram flow <name>       (one arrow per line)
A -> B : arrow label
@keyterms
term :: short meaning
@read
chunk text
@example <name>
subgoal label :: step
@coverage
<section>, <section>, ...

Here are my notes:
[paste]
```

# 15. Worked example: one topic, many cards

“Normalization” shows why a topic isn’t one card. It spawns:

- **Sequence** — order 1NF → 2NF → 3NF → BCNF.

- **Cloze/concept** — “2NF removes \_\_\_ dependencies on part of a composite key”; “3NF removes \_\_\_ (transitive) dependencies”.

- **Comparison table** — rows = the forms, columns = rule / what it removes / example violation → row rebuild and which-one.

- **Scenario → category** — given a table that violates a form, pick which form.

- **New instance** — normalize a fresh table and check the resulting tables.

The sequence card proves you know the order; the comparison, scenario and new-instance cards prove you can actually _tell the forms apart on real data_ — the skill a bare 1-2-3 drill never builds.

# 16. Settings

Everything is meant to be tuned by the student, per deck:

- Enable/disable any exercise type.

- Spelling: fuzzy-match typing vs first-letter mode.

- Exam date, daily time budget, and sleep window (for cram mode).

- Priority and tags per deck, carried from import.

- Which scheduler is active: long-term, or cram toward a date.

- Availability calendar: minutes per weekday, per-date overrides, sleep window.

- Placement per topic: read it / haven’t read.

- Image occlusion: hide one or hide all.

- Export (all courses or chosen ones, with or without progress) / import (replace or merge), and a backup reminder.

- Make available offline (persistent storage); archive a finished course.

- Acquisition: pretest on/off; full or quick path (or let the feasibility check choose); breadth-first or depth-first under a deadline.

# 17. Evidence caveats & open questions

**CS-domain transfer (the weakest link).** Almost all the evidence comes from word pairs, trivia, intro psychology and CS1 code — not proofs, normalization or protocol design. Treat the parameters as defaults and let the app’s own delayed-test data correct them.

**Covert retrieval (worth a quick check).** The “no typing” path leans on think-flip-rate and short answers. Whether covert retrieval equals written production, and how well minimal formats carry conceptual understanding, would firm up the self-rated lane.

**New-instance authoring (the practical gap).** Fresh problems with checkable answers are the strongest procedural stage, but without AI they must be authored — via your import prompt, or later via built-in generators for a few classic algorithms.

**Acquisition mode.** Breadth-first under a deadline, Parsons-style ordering for non-code procedures, the 75% split threshold, and the forward testing effect outside the lab are all untested. Chunk size has no evidence-based optimum. The app’s own logs (pretested vs not, same-day vs next-day accuracy) can settle these over time.

**One-night mode and the multi-exam planner.** The morning check as a delayed retest is inferred from sleep research, and the planner’s daily split and value-per-minute cuts are sensible heuristics, not tested study designs. The minutes-per-card estimates start as defaults and improve as the app measures you.

**Diagram generation.** AI transcription of a diagram can miss or flip arrows on dense or messy images, and OCR struggles with handwriting — both are authoring aids, always checked by the student before studying.

**The self-rated lane.** Conceptual “explain it” is deliberately walled off from scoring for now; whether and how to let it influence scheduling is left open.

# 18. Moving data between devices (export & import)

Until automatic sync exists, each device keeps its own data. Export and import let you move everything across by hand — and the exported file doubles as a backup.

## What to export: everything, or chosen courses

- **All courses.** A full backup: every course plus device-wide things (settings, the availability calendar).

- **Chosen courses.** Tick one or more courses; only those go in the file — their decks, cards, images, exam dates and history. Device-wide settings stay out, so importing it never overwrites someone’s preferences.

- **Include my progress (on by default).** Turn it off to export just the cards with no review history — the way to share a course with a classmate, who starts fresh with their own schedule.

## What the file contains

A full export holds everything: decks, cards, tags, settings, exam dates, the availability calendar, diagram images, and the full review history (the append-only event log); a course export holds the same for just the chosen courses. Scheduler states aren’t stored separately — they are rebuilt by replaying the history, so they always come out consistent. The file is a .zip — the data as one structured text file (JSON) plus the images as ordinary image files — and carries a format version so future versions of the app can still read old backups. Audio is not included (it is a later feature).

**The rule that makes it work:** every card and every review gets a globally unique ID from day one. That is what lets two devices’ data be combined without conflicts — and it means real sync later needs no rework.

## Two import modes

- **Replace.** Restores the file exactly. A full file replaces everything on the device; a course file replaces only the courses in it and leaves every other course untouched. Use it for a first move to a new device, or to restore a backup.

- **Merge.** Combines the file with what’s already here: the two histories are joined, duplicates (same ID) are dropped, and every schedule is rebuilt from the combined history. Use it when you’ve studied on both devices — nothing is lost and nothing is double-counted.

After either, the app shows what came in (e.g. “1,240 cards and 3,812 reviews imported”) so you can confirm it worked.

## A full transfer, step by step

1.  **Export.** On the first device: Settings → Export, then choose all courses or tick the ones you want, and whether to include progress. On Android the share sheet can send the file straight to another app; otherwise it saves to Downloads.

2.  **Move the file.** Quick Share (Android’s nearby sharing), Google Drive, emailing it to yourself, a messaging app, or a USB cable — anything that moves a file.

3.  **Import.** On the other device: Settings → Import → pick the file → choose Replace (first move) or Merge (you’ve used both).

4.  **Check.** Confirm the counts shown match, then study as normal.

_The file contains all your study data, so treat it like any personal file. The app also nudges you to export a backup now and then, since data lives only on the device until sync exists._

# 19. Offline and storage

## The “Make available offline” switch

The app is offline-first: it caches itself on the first visit and keeps every card on the device, so studying never needs the internet. A switch in settings makes that explicit and protects it:

- Asks Android for persistent storage, so the browser won’t clear the app’s data when the phone runs low on space.

- Confirms the whole app is cached.

- Shows a clear status: “✓ Ready offline”. Later, audio downloads use the same switch.

## How much space it uses

Text is tiny; only images (and later audio) take real space. Rough estimate for a heavy year:

| **What**       | **Size each**       | **Heavy year**          | **Total**     |
| -------------- | ------------------- | ----------------------- | ------------- |
| Cards (text)   | ~0.5 KB             | 2,000 cards (4 courses) | ~1 MB         |
| Review history | ~0.15 KB per review | 200 reviews/day × 365   | ~11 MB        |
| Diagram images | ~100 KB compressed  | 200 diagrams            | ~20 MB        |
| Total          |                     |                         | ~30 MB / year |

**Why the history grows with every review.** Each review is kept as its own record (card, time, outcome, format, time taken) rather than only the card’s current state. That history is what lets FSRS tune itself to you, lets export/merge and sync combine devices without conflicts, lets schedules be rebuilt exactly, and lets the app measure things like pretest gains. At ~0.15 KB per review it costs very little, so it is kept in full.

## Keeping it small

- **Compress images on import** — resize to a sensible maximum and save as WebP. The biggest saving by far.

- **Archive finished courses** — after the semester, export a course to a file and remove it from the device; re-import it if you ever need it.

- **Never trim the review history** — it is small, and deleting it would make the scheduling worse.

_The real risk was never size but the phone clearing the app’s data — which the offline switch and the backup reminder handle together._

# 20. Future improvements

- **Weekly routine flow.** A daily time-boxed “today’s set” mixing retests, due reviews and new lecture chunks; how a new lecture enters acquisition without burying you; and “catching up” framing (not a red overdue count) with new cards paused after missed days. Lower priority because few students study every day.

- **Calendar import.** Pull work shifts and classes into the availability calendar automatically.

- **Automatic sync.** Phone and laptop kept in step in the background, built on the same event log and unique IDs as export/import.

- **Audio section.** Listen to or download audio (e.g. made in another tool) for offline listening; speech compressed with the Opus codec to keep files small on slow networks.

- **Learned reminder times.** From your own study logs (no tracking): remind you when you usually start, and quietly correct the availability calendar when your real study time differs from what you entered.

- **Exact optimiser (ILP).** Only if the app’s logs show the greedy plans wasting real time.

# 21. Source

The evidence behind every rule here is in the research report _“Cramming science for CS students”_ (and its visual PDF). That report flags which findings are strong, contested, unverified or inferred; those flags carry into this document — nothing here is firmer than the evidence under it.
