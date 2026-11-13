# Snowpack: running notes (everything decided since the tech check)

Single place to collect decisions, fixes and open questions. This becomes the Phase 8.6 spec for Claude Code.
Status key: **DECIDED** · **FIX** (prompt or app change to make) · **OPEN** (needs thought or a stress test) · **NOT APPLIED** (agreed but not yet in code)

---

## A. Tech-check fixes: NOT APPLIED (still pending in code)
1. planOneNight returns an empty plan after sleep start → give one minimum block plus the sleep reminder.
2. SAFETY_MARGIN is applied twice → apply it once. Estimator: first attempt at p0, later attempts at about 0.8, relearning at R(t).
3. "Minutes used today" counts only responseMs → use session wall time with idle gaps capped.
4. A course with an exam more than 7 days away gets long-term new/day that ignores the planner → let the planner share set new/day.
5. D=1: check that read-but-unseen cards get into the final pass (sim test).
6. One shared valueOf() for cram degrade and planner cuts.
7. Collision guard: reject a fuzzy match that is as close or closer to another card's answer.
8. Multiple choice with fewer than 3 options → skip to the next path step.
9. Same card twice in a row when fewer than 3 remain → test.
10. Replay: order events from the same device by seq; store tzOffsetMin per event.
11. Add Settings and Courses screens; add "installed on Android and used offline" to Phase 10's done-when.

## B. Bugs found by using the live app (Nov 13)
- **FIX:** typed term→definition answers need a word-for-word match, so correct paraphrases are marked wrong (see D3).
- **FIX:** "Meet the key terms" quizzes before teaching (see D2).
- **FIX:** a definition was offered as a term option ("record activity").
- **FIX:** too much ceremony: 2 key terms took about 6 answers and 3 summary screens. No round or session summaries inside Learn.
- **FIX:** @tag titles are ignored ("part 1, 2…"); the reader heading just says "Read".
- **FIX:** no "Start studying" after import.
- **FIX:** the planner's weekday inputs overflow at 1024 px.
- **FIX:** plurals ("1 comparison tables", "1 sequences").
- **FIX:** the Course card says "0% exam-ready / Keep it fresh" with no exam date; a disabled "Start review" is shown prominently.
- **FIX:** typo-accepted answers don't show the correct spelling.
- **FIX:** the parser needs @coverage content on the next line (superseded by @missing).

## C. App structure and modes: DECIDED
- **Hierarchy:** Course → Topic (may merge lectures; `from:` keeps the lecture names) → Section → Cards.
- **Three doors per course:**
  - **Learn:** section-by-section reader. 1-2 questions after each section, plus 1 look-back from 2+ sections back (favouring misses), and a mixed quiz at the end of the topic.
  - **Practice:** Quizlet-style flashcards and quick quiz. No timer. Never moves FSRS.
  - **Exam prep:** the planner, cram, readiness.
- **Timing, budgets and "today is done" exist only in Exam prep.** Learn and Practice have no clock; rounds pause by count (about 20 cards) with a "keep going / break" choice.
- **No written or "explain" answers in the app.** Exams are written theory, but they're prepared for through spaced, mixed cards, with the student talking it through themselves. No @exam. Anything self-rated never touches the algorithm.
- **Everything works without AI:** manual forms for course, topic, section and every card type, and every exercise works on manual cards. The chatbot is only a shortcut.
- **Course page shows:** the big picture ("how it connects"), the exam habit questions, the cheat table (@cheat) for last-minute review, the topic checklist with sections, and links between topics.
- **Phase order:** a new Phase 8.6 (Learn & Practice + prompt system + design) before Phase 6 (diagrams).

## D. Exercises: DECIDED and FIX
1. **Matching (draw lines or tap term then meaning):** 4-5 pairs; counts as recognition, like multiple choice; used in Meet the terms and Practice.
2. **Meet the terms rework:** one screen of 3-4 term cards (term, plain meaning, tiny example), then one matching check. No pre-quiz.
3. **Definitions:**
   - Typed answers are for definition → term only.
   - Term → definition is multiple choice or an idea-unit check: the student types, then ticks the *key words* (from the prompt's `*asterisks*`), and the app pre-ticks keyword matches.
   - Research: typing beats thinking (d = 0.43); idea-unit standards cut overconfident self-scoring from about 55% to 15-28%.
4. **List cards** (an answer that is a set: "Name the six network threats"):
   - Graded as a checklist of starred items (typed or tap-pick). Ordered lists are sequences instead.
   - **DECIDED (user):** keep long lists (e.g. 8 malware types) and add a **"name N of M"** variant ("name any 4 of the 8"): correct if at least N valid items. It's gradable, so it counts like any card. Students focus on different items, so full lists stay available.
   - **FIX:** never generate a reverse card from a list fact.
5. **Reverse cards:** a @fact makes two cards, term → definition and definition → term. For lists the reverse ("malware, phishing, … → ?") is meaningless, so skip it.
6. **Sequences:** use the arrange exercise; the diagram/stack version comes in Phase 6.
7. **Sounds (DECIDED):** soft paw tap, snow crunch on correct, a low soft note on wrong, a stamp when a card becomes exam-ready. Own toggle; never during reading. Music: instrumental only, off by default, low volume (research: about zero effect; lyrics hurt).

## E. Prompt system (PROMPTS.md): DECIDED, plus fixes from the real tests
**Flow:**
- Tap-question intake: what you're giving it / Learn · Just study · Cram / exam date / optional syllabus.
- One assembled prompt; one continuous reply: @map, then every topic, without stopping.
- `continue` only if it really ran out of space; @next <topic> <section> marks where to resume.
- Every reply goes inside one code block, copied with the copy button.
- Claude only for now; ChatGPT and Gemini untested and unsupported.

**Real test 1, data comms (8 lectures):**
- One reply, 5.4k words, 7 topics, 2.8k reading words, 114 questions.
- About 25 of the 31 self-test questions carded. Fixed: dense sections allow up to 6 cards; every list, formula and X-vs-Y in a @read gets a card; @compare 2-5 rows; ordered lists → @sequence; consistent naming.

**Real test 2, info security (9 lectures):**
- One reply, 6.6k words, 8 topics, 27 sections, 3.7k reading words, 167 questions, 0 invented.
- Coverage against the slides is very high. Dropped:
  - Lecture VIII "Security Awareness and Policy Enforcement" (Educate → Communicate → Enforce → Improve, measuring awareness), the whole slide
  - Lecture V segmentation examples (guest vs corporate Wi-Fi, DMZ for public services, microsegmentation, management networks), firewall stateful inspection, VPN tunnels
  - DoS resilience (traffic baselines, redundancy)
- **FIX 1:** every answer a card asks for must appear in its section's @read (the forensics "six best practices" were only in the card). The importer flags starred items missing from the reading.
- **FIX 2:** list cards: keep full lists (see D4).
- **FIX 3:** "@end appears once, at the very end" (it wrote @end after all 8 topics). The parser treats an early @end as end-of-topic and keeps reading.
- **FIX 4:** "A term the slides name but don't explain: explain it in one sentence, marked [ADDED]. @missing is only for content you cannot read."
- **FIX 5 (user flagged as important):** `from:` came back as "I, V" instead of "Lecture I". The prompt must give one exact example (`from: Lecture I, Lecture V`); the parser accepts both; re-import matching goes by lecture names because topic names and ids differ between runs.
- **FIX 6 (user decided):** [ADDED] content is **collected in its own review section** per topic ("Added by the chatbot: check these"), not mixed into normal sections, so the student decides whether it matters (e.g. adware).
- **FIX 7:** "every slide's content lands in some section unless it's admin": add a coverage self-check line to the prompt.
- **Free Claude used about 90% of its usage on one 9-lecture run.** PDFs are expensive (each page is read as an image + text). See F.

**Parser rules:**
- Ignore anything before the first @ line and ``` lines.
- @missing ends the map.
- Split @links at the first " : ".
- `*…*` is a key word only inside @fact.
- Normalise a trailing "layer"/"protocol" when comparing answers.
- Accept `from:` with or without "Lecture".
- An early @end means end of topic, not end of import.
- **Partial reply:** import complete sections, drop a half-written last line or section, mark the topic "partial", resume from @next.
- **Resume prompt:** built from the stored @map ("Topics done: …; start at topic X, section Y") for a new chat, another account or after credits reset.

## F. Getting slides to the chatbot: OPEN, needs a stress test
- **Problem:** PowerPoint SmartArt holds 40-75% of the words in these decks, and chatbots reading .pptx miss it. In the first real test, free Claude reported about 20 slides "empty".
- **PDF export works** (the second test reported only 1 truly unreadable slide), but it uses a lot of free-tier usage.
- **Idea:** a "Prepare my slides" tool in the app: pptx → text in the browser (slide text + SmartArt + notes; done with a script here).
- **User concern:**
  - Later features (diagram fill-ins, drag-and-drop, image occlusion) need the slide images.
  - Some lecturers' slides may not make sense as plain text.
- **Possible directions to stress test:**
  - (a) Text extract for the chatbot plus slide images kept in the app for diagrams. Images never go to the chatbot.
  - (b) A combined "PDF + text" bundle.
  - (c) Text plus images of only the diagram slides.
- **Test across several lecturers' decks:** token cost, coverage, diagram usefulness.
- **Note:** a pptx → PDF + zip converter in the app was suggested; a browser can't render pptx to PDF reliably, so it probably needs (a) or (c) instead. Decide after the stress test.

## G. Design: DECIDED direction, details OPEN
- **Canvas "Snowpack — Vintage Direction":**
  - Row 1: vintage (field-guide/letterpress; IM Fell English + EB Garamond + Courier Prime; paper #F1E8D6, ink #1D2230, night #1C2740, oxblood #7A2621, pine #2E4A3B, brass #D4B26A).
  - Row 2: "Cozy — The Den" (Today, Course, Meet the terms, Match, Reader day and night, Question, Motion sheet).
- **User:** the vintage look is "way better than current". Wants vintage kept, plus cozy, plus its own character: paw-print buttons, snow-wolf theme, animations.
- **Reading comfort for 3+ hours:**
  - Decorative faces only for headings; body and answers in a legible text face at 17-19 px, line-height about 1.55, measure 45-65 characters.
  - Warm low-glare paper; a lamp-light night mode.
  - Quiet reading and question screens.
  - Slow animations that respect reduced motion.
- **Research:** warm "emotional design" gives a modest learning gain (d ≈ 0.3-0.4) and lowers perceived difficulty. Avoid streak guilt, leaderboards and expected rewards.
- **Row 3, "Trail Markers"** (Claude's own direction, alpine wayfinding):
  - Fonts: Schibsted Grotesk for headings, Atkinson Hyperlegible for body.
  - Palette: ground #EDF0EE, ink #1D2A33.
  - Each mode has its own ski-trail marker colour: Learn green #2A6E4C, Practice blue #2B5C9E, Play orange #B04A18, Exam prep diamond in ink.
  - A redrawn Yuki (bandana); contour-line ornament only on Home and Play.
  - Interactive swipe flashcards with a hint.
  - **Known issues:** reader measure about 40-44 characters, and some 14-16 px secondary text.
- **All three rows now have Welcome (first visit) and Home screens.**
- **OPEN:** the user compares the three rows → pick or merge one direction → tokens and components for Claude Code.

## H. Research (reports/Study app engagement evidence.md)
- **Sections:** about 150-350 words in theory. The real chatbot output landed at 73-170, which works on a phone.
- **Questions:** 1-2 per section with feedback (g 0.54 vs 0.37).
- **Look-back:** about 1 per section, from 2+ sections back.
- **Interleaving:** introduce new cards lecture by lecture, mix lectures in review.
- **Cards per day:** about 20 new/day leads to about 200 reviews/day (Anki rule of thumb). Cap reviews; pause new cards when there's a backlog.
- **Streaks:** if used at all, they must be repairable (a broken streak reduces engagement).

## J. Choosing what to study, hints, answer formats: DECIDED
- **Pick, then mode (like Quizlet):**
  1. Choose a course.
  2. Optionally narrow it to specific topics or sections. "Study all" is the default.
  3. Choose a mode: Learn, Practice, Play or Exam prep.

  Every mode respects that selection. Exam prep can also be narrowed, e.g. "only Lectures III-V".
- **Micro hint** (Quizlet-style): reveal the first few words or letters of the answer. A hinted answer never counts as a first-attempt correct; at most it's a recognition-level success, and it doesn't count toward the criterion.
- **Any card type can show in several formats:**

  | Card | Formats |
  |---|---|
  | List | type all · name N of M · select all that apply · which one is NOT in the list (multiple choice) · drag items into the list's bucket (with sort) |
  | Fact | type term · multiple choice · matching · flashcard flip |
  | Sequence | arrange · fill the missing step · which comes after X (multiple choice) |
  | Compare | fill a table cell · which item has property Y (multiple choice) |

  Typed and recall formats count as recall. Choice and select formats count as recognition (weaker). Flashcard flip is self-rated and never scored.

## K. First visit and home: DECIDED (designing)
- **The first visit must not push "add a course"** (the user said it feels like being pushed to a payment page). Instead:
  - Yuki welcomes the student.
  - A 3-step "how it works".
  - **Try a sample course** (a built-in demo deck) is the primary action, then "Bring my lectures", then "Make cards by hand".
- **Returning home:** continue where you left off, your courses, a gentle suggestion for today, entry to Play. No streak guilt.
- **Design canvas:** Welcome and Home screens for the vintage and cozy styles, plus a third direction (row "Direction 3": Welcome, Home, Course + pick what to study, swipe flashcards (interactive), Play hub, Match game, Reader, Motion sheet).

## L. Play section: moved to GAMES.md (Phase 11). Bad ideas removed.

## M. Prompt fixes applied (Nov 13, after the security test)
@end only once at the very end; the exact `from: Lecture I, Lecture V` example; a slide-by-slide coverage rule; @missing only for unreadable content; named-but-unexplained terms are explained in a separate "Added by the chatbot (check these)" section per topic; every answer must appear in its section's @read; lists kept complete (the app does "N of M").

## I. Other open points
- **Data safety:** no backup until Phase 9. Keep the chatbot replies saved.
- **Card editing (8.5)** matters more now: fixing a bad card must take seconds.
- **The prompt is tested only on Claude.**
- **Scope versus remaining weekly usage:** decide the order before handing work to Claude Code.
