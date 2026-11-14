import type { CourseMap, ImportGoal } from '#lib/db/schemas/course.ts';

/** Intake question 1: what the student gives the chatbot. @see docs/PROMPTS.md §2 */
export type Giving = 'lecture' | 'lectures' | 'course' | 'notes';

/** The intake answers that shape the prompt (the exam date feeds only the planner). */
export interface Intake {
	giving: Giving;
	goal: ImportGoal;
	/** Optional syllabus, past paper or "exam focus: …", used for priority. */
	syllabus?: string;
}

/** Shown on the intake screen. @see docs/PROMPTS.md §2 */
export const PDF_TIP =
	'Upload slides as PDF if you can (diagrams in .pptx files are often invisible to chatbots).';

/** PROMPTS §3, word for word. */
export const BASE_PROMPT = `You turn my course material into a study pack for an offline study app. The app
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
- An answer of 3 or more items is never a plain comma list. Make it a starred
  list @fact (above) when I must name the whole set, a @sequence when the items
  have an order, or else one card per item:
  In a DBMS, the storage manager part that caches disk pages :: buffer manager
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
  reply "continue". After the last topic, end with @end.`;

/** PROMPTS §4, word for word: one is added. */
export const GOAL_BLOCKS: Readonly<Record<ImportGoal, string>> = {
	learn: `GOAL: learn from scratch.
- Per topic: 2-3 sections for each lecture it merges (at most 7). Each @read is
  100-200 words, one idea, explained so someone who missed the lecture
  understands it. Sections are read on a phone.
- 2-4 cards per section (up to 6 in dense sections), at least one on the
  section's main idea; about 8-14 questions per merged lecture. 1-2 @link cards
  per topic, only to an earlier topic (none in the first), after the last
  section; they don't count toward the per-section cards.`,
	study: `GOAL: I already know the material; I want cards only.
- No @read. Keep @summary (3-5 lines) and @tip.
- 3-5 cards per section, about 12-20 per topic, plus 1-2 @link cards.`,
	cram: `GOAL: the exam is very soon; essentials only.
- No @read. @summary of 3 lines. Only priority-high material.
- 10-20 questions per topic (counted as in CARD RULES), favouring exam traps
  (@compare), lists to name, sequences and commonly confused definitions.
  Keep @tip; no @link.
- Put all topics in as few replies as possible.`
};

/** The intake labels (PROMPTS §2), also used in the prompt's "I'm giving you" line. */
export const GIVING_LABELS: Readonly<Record<Giving, string>> = {
	lecture: 'One lecture',
	lectures: 'Several lectures',
	course: 'A whole course',
	notes: 'Notes or a summary I already made'
};

const MATERIAL = 'Here is my material:';
const PARAGRAPH = '\n\n';

/**
 * The one prompt to copy: BASE (PROMPTS §3, word for word) + the GOAL block (§4) + what is being
 * given and any syllabus + "Here is my material:".
 *
 * @see docs/PROMPTS.md §2–§5 and Decisions log (Import v2: prompt)
 */
export function buildPrompt(intake: Intake): string {
	const syllabus = intake.syllabus?.trim();
	return [
		BASE_PROMPT,
		GOAL_BLOCKS[intake.goal],
		`I'm giving you: ${GIVING_LABELS[intake.giving].toLowerCase()}.`,
		...(syllabus ? [`What's examined (use it for priority):\n${syllabus}`] : []),
		MATERIAL
	].join(PARAGRAPH);
}

/** The stored map written back in the reply format, for the resume prompt. */
function mapText(map: CourseMap): string {
	const topics = map.topics.flatMap((topic) => [
		`@topic ${topic.key} ${topic.title}${topic.from.length > 0 ? ` | from: ${topic.from.join(', ')}` : ''}`,
		...topic.sections
	]);
	return ['@bigpicture', ...map.bigpicture, '@habit', ...map.habit, ...topics].join('\n');
}

/**
 * The resume prompt for a new chat (PROMPTS §5): "Continue this study pack…" with the stored map,
 * the topics already done and where to start, then BASE + GOAL and "Here is my material:".
 */
export function resumePrompt(input: {
	map: CourseMap;
	done: readonly string[];
	next: { topicKey: string; section?: string };
	goal: ImportGoal;
}): string {
	const start = input.next.section
		? `Start at @topic ${input.next.topicKey}, section "${input.next.section}"`
		: `Start at @topic ${input.next.topicKey}`;
	const done = input.done.length > 0 ? input.done.join(', ') : 'none';
	return [
		`Continue this study pack. Here is its @map. Topics already done: ${done}. ${start}, and follow the same rules.`,
		mapText(input.map),
		BASE_PROMPT,
		GOAL_BLOCKS[input.goal],
		MATERIAL
	].join(PARAGRAPH);
}
