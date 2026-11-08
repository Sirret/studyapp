/**
 * The prompt the student pastes into their own chatbot, shipped word for word with a copy button.
 *
 * @see BUILD_PLAN §4.3
 */
export const CHATBOT_PROMPT = `You convert my lecture notes into study cards in a strict import format.
Read my notes as a revision tutor: decide what an exam could test, and
turn only that into cards. Fewer, better cards beat many weak ones.

INPUTS
- My notes or slides (required).
- Optionally my syllabus, past papers, or a line like "exam focus: X, Y".
  Use them only to set priority.

WHAT TO MAKE
- Work through the material section by section, in order.
- Make a card only if a good exam question could ask it: core
  definitions, how something works and why, rules, formulas, methods,
  differences between similar things, causes and effects.
- Skip: course logistics (grading, schedule, objectives, learning
  outcomes, course or lecture outlines, overviews), introductions and
  motivation that only set the scene, examples given just for colour,
  and anything that only makes sense with the slide in front of me.
- Every card must make sense on its own, months later, with no slide:
  name the subject in the question ("In a B+ tree, ..." not "It ...").
  Never write "one objective is", "the lecture lists", "the slide
  shows" or similar.
- Test understanding, not wording: ask what something is, does, or why,
  rather than blanking a filler word out of a sentence.
- Use ONLY my material. Add no outside facts and invent no examples.
- Never write the same fact twice. A topic may need several cards when
  they test different things (the order of the steps vs what each step
  does), but each fact appears once, in the one format that fits.
  A term goes in @keyterms or @fact, never both.
- If my notes are unclear or contradict each other, decide yourself: use
  the lecturer's version and say so in the question ("According to the
  lecture, ..."). Never mark anything for me to check.

GROUPING
- @deck: one per lecture or chapter, the level at which I'd say "I've
  read that". Usually 1-3 per reply; never one per slide.
- @tag: the sub-headings inside it.
- When I say "continue", repeat the exact same @deck line you were in.

PICK THE FORMAT
- term -> meaning: @fact (or @keyterms for the few terms needed to
  follow a chunk)
- a key word inside a sentence: @cloze
- steps or stages in a fixed order: @sequence (never a cloze list)
- two or more things compared on the same attributes: @compare
- a distinction applied to a situation: @scenario
- a procedure or worked problem with solution steps: @example
- a box-and-arrow or layered diagram: @diagram, one arrow per line as
  A -> B : label. Never invent nodes or arrows you can't see.

ANSWER RULES (answers are typed or picked, so keep them short)
- Every answer is clear and short, and would earn the mark in an exam.
- One card per line. "::" appears once, between question and answer.
- @fact: the definition is one plain sentence, at most about 15 words.
- @cloze: each {{ }} hides 1-3 key words, at most 3 per line. Never hide
  a whole clause or a list of items.
- @scenario: describe the situation without naming the answer. The
  answer is the short name of one concept, worded exactly as my other
  cards name it. No yes/no answers and no explanation after the answer.
- @compare: at least 2 items across the top, one attribute per row,
  every cell a short real value from my material. Leave out a row you
  cannot fill; never write placeholders like "-", "n/a" or "see above".
- Every answer contains letters or digits: write a symbol-only answer
  in words (e.g. "intersection", "less than or equal").
- @sequence and @example need at least 2 steps.

CHUNKS (for learning from cold)
- Split the material you kept into chunks of one idea each (about
  150-400 words).
- For each chunk, in order: @keyterms (2-5 terms to learn first),
  @read (the chunk in clear sentences, paraphrased), then the cards
  that test it.

IF I GIVE YOU NO NOTES (only a syllabus, topic list or past papers)
- Stay strictly within what those sources name. Start every generated
  @read with [GENERATED] so I know to check it against my course.

PRIORITY
- With a syllabus/past paper/exam focus: matching cards -> @priority high.
- Otherwise infer: anything defined, named, bolded, repeated, or listed
  as a rule -> high; supporting detail -> normal.

OUTPUT
- Output ONLY the import text: nothing before or after it, no
  commentary, no list of what you skipped, no markdown fences. One
  directive or card per line, with the line breaks kept.
- If you run out of space, stop at the end of a section; I will reply
  "continue".
- When everything is done, end the reply with a line @end.

FORMAT
@deck <topic>
@tag <subtopic>
@priority high|normal
@keyterms
term :: short meaning
@read
chunk text
@fact
term :: concise definition (paraphrased)
@cloze
sentence with the key word in {{ }}
@sequence <name>
step
@compare
| | A | B |
| attribute | value | value |
@scenario
situation :: correct answer
@example <name>
subgoal label :: step
@diagram stack <name>      (one layer per line, top to bottom)
layer :: role
@diagram flow <name>       (one arrow per line)
A -> B : arrow label
@end

Here are my notes:
[paste]`;
