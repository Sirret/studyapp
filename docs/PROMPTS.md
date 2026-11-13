# Snowpack: import prompts (v2)

Replaces the single import prompt. Built from the import test (security lectures) and from the student's own data-comms summaries, which work for exams because they:
- **Connect first.** A big-picture chain that links the lectures.
- **Merge overlapping lectures.** II, V and VI become one "Models" topic.
- **Give a unifying exam habit.** "Which layer? Data unit? Address? Device?"
- **Name exam traps** (X vs Y).
- **Add mnemonics** and **worked examples** for formulas.
- **End with a cheat table and a self-test.**
- **Mark added material** (EXTRA).
- **Report missing lectures.**

---

## 1. Flow

1. **Intake.** The app asks 3-4 tap questions; nothing to type except an optional exam date and focus.
2. **The app assembles one prompt** from BASE + GOAL block and shows a single "Copy prompt" button. Students attach their slides (PDF recommended) and send.
3. **One continuous reply.**
   - The chatbot writes the course map first: it merges overlapping lectures into topics, explains how they connect, lists the sections of each topic, and names anything unreadable.
   - It then writes every topic without waiting.
   - A whole 8-lecture course fit in one free-Claude reply in testing.
4. **Only if it runs out of space** does it stop after a complete section with `@next <topic> <section>`. The student types `continue`, and pastes every reply into the import box one after another. The app shows the map as a checklist and ticks topics off, e.g. "4 of 7 imported".
5. **Resume.** If a chat dies or credits run out, the app offers a resume prompt built from the map, which works in a new chat or later.

## 2. Intake questions (app side)

| # | Question | Options | Feeds |
|---|---|---|---|
| 1 | What are you giving it? | One lecture · Several lectures · A whole course · Notes or a summary I already made | Size and stage (one reply vs map + topics) |
| 2 | What do you want? | **Learn it** (read + questions) · **Just study** (cards only) · **Cram** (essentials only) | GOAL block |
| 3 | Exam date? | Date (optional) | Planner only. Written exams are prepared for through spaced, mixed cards; nothing is written out or self-graded in the app |
| 4 | Anything that shows what's examined? (optional) | Paste a syllabus, past paper or "exam focus: …" | Priority |

**Tip on the intake screen:** "Upload slides as PDF if you can. Diagrams in PowerPoint files (SmartArt) are often invisible to chatbots." In testing, 40-75% of the words in these lectures were inside SmartArt, so a plain text extraction loses them.

## 3. BASE prompt (always included)

```
You turn my course material into a study pack for an offline study app. The app
reads your reply with a strict line format, so follow the FORMAT exactly.

YOUR JOB
Teach me the essence of the course without wasting my time. Keep what an exam
could ask and what I need to understand it; drop filler. Lectures are never
separate: show how the ideas connect.

READ EVERYTHING FIRST
- Work out the course's big picture: the chain of ideas that links the lectures.
- If two or more lectures teach the same thing, merge them into ONE topic and
  name the lectures it came from. Never repeat a fact in two topics.
- Every slide's content must land in some section, except course admin. Before
  you finish, check each lecture slide by slide.
- If a slide's content is unreadable (only a title, or a diagram you can't see),
  list it under @missing with the reason, unless the same content appears
  elsewhere in my material. @missing is ONLY for content you cannot read.
- Do not report gaps in lecture numbering; courses often skip numbers.

WHAT TO KEEP
- Definitions, how things work and why, rules, formulas, steps in a real order,
  differences between similar things, causes and effects, and anything repeated,
  bolded, or in a summary slide.
- Drop: course admin, outlines, scene-setting intros, decorative examples.

ADDING EXPLANATION
- Explain in plain words what my material says. Do not add new topics.
- If my material names something but never explains it (e.g. a type in a list),
  or a standard fact or formula would complete something it names, you may add a
  one-sentence explanation. Put ALL such additions in one last section of that
  topic: "@section Added by the chatbot (check these)", where the @read starts
  with [ADDED] and every card ends with [ADDED]. Never mix added material into
  the other sections. Worked examples may invent numbers.
- If my material is unclear or contradicts itself, follow the lecturer's version.

CARD RULES
- Every card makes sense alone, months later: name the subject ("In OSI, ...").
- One card per line. " :: " (space, two colons, space) appears once per card.
- Answers are short: a term, a number, or a phrase of at most ~12 words. Name
  things the same way every time ("Data Link", not sometimes "Data Link layer").
- Counts mean questions the app asks: @fact = 2, each {{ }} = 1, @sequence =
  1 + steps, each @compare cell = 1, every other card line = 1. Keep @compare to
  2-5 rows.
- Every list, formula and X-vs-Y that appears in a @read gets at least one card.
- Every answer a card asks for must appear in that section's @read (when there
  is one) and in my material. Never test something the reading doesn't say.
- Keep lists complete (all 8 malware types, not 4); the app can ask for "any N
  of them". Never write a list's items only in a card.
- @fact definitions: one plain sentence, max ~15 words, with each key phrase in
  one pair of *asterisks* (*broadcast domains*), usually 1-3; they are what my
  answer must contain. Use * only for this, never for maths.
- Lists to name: the question says how many, and every item is starred:
  Six network threats :: *malware*, *phishing*, *DoS*, *unauthorized access*, *eavesdropping*, *spoofing*
- Cards must drill every @habit question (e.g. "Port number: which layer?").
- @cloze hides 1-3 key words with {{ }}; never hide one item of a list (several
  answers would be right).
- @sequence only for a real order (process steps, layers top to bottom). An
  ordered list is always a @sequence, never a starred list @fact. Numbered
  bullets that aren't an order are not a sequence.
- @scenario: a short situation whose answer is the plain name of one concept.
  Scenarios may be invented; they apply my material.
- @compare for things contrasted on the same attributes (X vs Y, exam traps).
- Formulas: a @fact for the formula and an @example that starts from given
  numbers (don't restate the formula as a step).
- Each fact appears once, in the one format that fits best.

PRIORITY
- high: core definitions, models, processes, exam traps, a point a takeaway slide
  singles out (a slide that repeats the whole lecture doesn't make everything
  high), anything in my syllabus/past paper/focus. Everything else: normal.
  Mark at most half the sections high.

FORMAT (directives start a line; text after a directive belongs to it)
@map <course name>
@bigpicture
<2-5 lines: how the topics connect, in order>
@habit
<1-4 questions that solve most exam questions in this course, one per line>
@topic <id> <title> | from: <lectures>
<section title, one per line>
(id: one lowercase word; from: only lectures whose main subject this is,
 written exactly like "from: Lecture I, Lecture V")
@links
<topic id> -> <topic id> : <how they connect, no colon>
@cheat <name>
| | column | column |
| row | value | value |
(the ONE table that answers most exam questions across the course, e.g. every
layer with its data unit, address and device)
@missing
<slide and reason, one per line, or "none">

@topic <id> <title> | from: <lectures>
@summary
<3-5 lines: the essence of this topic>
@section <title>
@priority high|normal
@read
<the section, in clear explained sentences>
@tip
<a mnemonic or memory trick, if one helps>
@fact
term :: definition with *key* *words*
@cloze
sentence with {{key word}}
@sequence <name>
step
@compare <name>
| | A | B |
| attribute | value | value |
@scenario
situation :: concept
@example <name>
step label :: step
@link <topic id>
question that needs both topics :: short answer
(repeat @topic ... for every topic; NO @end between topics)
@end   (once, only at the very end of the whole pack)

OUTPUT
- Put the whole reply inside ONE code block, so I can copy it exactly. Nothing
  before or after the code block.
- Write the @map first, then every topic in order, without stopping or waiting
  for me.
- If you run out of space, stop after a complete @section, end the code block
  with the line @next <topic id> <section title> (where to resume), and I will
  reply "continue". After the last topic, end with @end.
```

## 4. GOAL blocks (one is added)

**Learn it**
```
GOAL: learn from scratch.
- Per topic: 2-3 sections for each lecture it merges (at most 7). Each @read is
  100-200 words, one idea, explained so someone who missed the lecture
  understands it. Sections are read on a phone.
- 2-4 cards per section (up to 6 in dense sections), at least one on the
  section's main idea; about 8-14 questions per merged lecture. 1-2 @link cards
  per topic, only to an earlier topic (none in the first), after the last
  section; they don't count toward the per-section cards.
```

**Just study**
```
GOAL: I already know the material; I want cards only.
- No @read. Keep @summary (3-5 lines) and @tip.
- 3-5 cards per section, about 12-20 per topic, plus 1-2 @link cards.
```

**Cram**
```
GOAL: the exam is very soon; essentials only.
- No @read. @summary of 3 lines. Only priority-high material.
- 10-20 questions per topic (counted as in CARD RULES), favouring exam traps
  (@compare), lists to name, sequences and commonly confused definitions.
  Keep @tip; no @link.
- Put all topics in as few replies as possible.
```

## 5. STAGE text (one is added at the end)

There is one flow now: the map, then all topics, without stopping (see OUTPUT in BASE). Students type `continue` only when the chatbot actually ran out of space.
- **Continue** (what the student types after a cut reply): `continue`
- **Resume in a new chat** (the app builds it after credits ran out or a chat was lost; includes the imported @map):
  `Continue this study pack. Here is its @map. Topics already done: <ids>. Start at @topic <id>, section "<title>", and follow the same rules.` + BASE + GOAL + the original material.

Then: `Here is my material:` followed by the paste or attachments.

## 6. What the app does with it

| Directive | App behaviour |
|---|---|
| @map / @bigpicture / @habit | Course page header: "How it connects" plus the exam habit questions |
| @topic in the map | A checklist of topics with section names; "3 of 6 imported"; un-imported topics greyed |
| @links | A "connected to" line on each topic; drives look-back and @link cards |
| @missing | A warning row: "Lecture VII wasn't included" / "Slide 4 looks empty; paste it as text" |
| @topic (content) | A unit; `from:` keeps the lecture names for search |
| @summary | The first screen of Learn and the last screen of a topic; also shown in Practice |
| @section | A Learn page: title, @read, then 1-2 questions, plus one look-back from an earlier section |
| @tip | Shown under the reading or on the answer screen; never a card |
| *key words* in @fact | Idea-unit checklist for typed definition answers (student ticks; app pre-ticks matches) |
| [ADDED] / "Added by the chatbot" section | Shown as its own review section at the end of each topic; the student keeps or deletes each item; never mixed into normal sections |
| @link | A card tagged with both topics; used in mixed review |
| @next / @end | The "next" button in the import screen, and import completeness |

## 7. Parser changes (Phase 8.6)

- **New directives:** @map, @bigpicture, @habit, @links, @missing, @topic (in both map and content form), @summary, @section, @tip, @link, @next.
- **@deck and @tag keep working.** @deck maps to @topic, and @tag maps to @section when no @section is present.
- **@compare <name>:** the title is optional.
- **[ADDED]** takes over the role of [GENERATED] for @read and is allowed at the end of a card. Keep [CHECK] as an alias.
- **`*key words*` in @fact answers:** strip them for display and store them as idea units.
- **@coverage is replaced by @missing.** Keep accepting @coverage, with its content on the following lines.
- **Robust parsing:**
  - Ignore everything before the first `@` line, and ignore ``` lines.
  - Treat @missing as the end of the map.
  - Split @links lines at the first " : " only.
  - Read `*…*` as key words only inside @fact answers.
  - Normalise a trailing "layer"/"protocol" when comparing answers across cards.
  - @cheat is a @compare shown on the course page.
- **Partial replies:** import every complete section; drop a half-written last line or section and mark that topic "partial"; @next <id> <section> tells the app where to resume.
- **Manual mode:** every directive has an in-app form, so students can build courses, topics, sections and every card type without any chatbot.
- **Topic merging on re-import:** a topic whose `from:` overlaps an existing topic offers "update this topic" instead of creating a duplicate.
