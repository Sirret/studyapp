/**
 * The prompt the student pastes into their own chatbot, shipped word for word with a copy button.
 *
 * @see BUILD_PLAN §4.3
 */
export const CHATBOT_PROMPT = `You convert my lecture notes into import-ready study cards in a strict
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
[paste]`;
