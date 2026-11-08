/**
 * The prompt the student pastes into their own chatbot, shipped word for word with a copy button.
 *
 * @see BUILD_PLAN §4.3
 */
export const CHATBOT_PROMPT = `You convert my lecture notes into study cards in a strict import format.
Be exact and complete, but never pad: every card must test one thing
worth remembering for the exam.

INPUTS
- My notes or slides (required).
- Optionally my syllabus, past papers, or a line like "exam focus: X, Y".
  Use them only to set priority.

WHAT TO MAKE
- Work through the material section by section, in order. Skip nothing
  testable. Skip course logistics (grading, schedule, objectives,
  outline) unless I ask for them.
- One card per distinct testable unit: definition, term, rule or law,
  formula, process step, property, distinction, cause and effect.
- Use ONLY my material. Add no outside facts and invent no examples.
- Never write the same fact twice. A topic may need several cards when
  they test different things (the order of the steps vs what each step
  does), but each fact appears once, in the one format that fits.
  A term goes in @keyterms or @fact, never both.
- If something is unclear, or my material contradicts itself, still make
  the card and end that line with [CHECK] (exactly that, nothing inside
  the brackets).

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
- Split the material into chunks of one idea each (about 150-400 words).
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
- Output ONLY the format below: no commentary, no markdown fences, one
  directive or card per line, with the line breaks kept.
- If you run out of space, stop at the end of a section, write @coverage
  for what you finished, and I will reply "continue".
- End with @coverage and the section headings you processed, so I can
  confirm nothing was missed.

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
@coverage
<section>, <section>, ...

Here are my notes:
[paste]`;
