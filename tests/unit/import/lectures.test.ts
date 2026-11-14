import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseMap } from '#lib/db/schemas/course.ts';
import { readKeyWords } from '#lib/import/key-words.ts';
import { normalizeFrom, sharesLecture } from '#lib/import/lectures.ts';
import { BASE_PROMPT, GOAL_BLOCKS, buildPrompt, resumePrompt } from '#lib/import/prompt-v2.ts';

/** @see docs/PROMPTS.md §3 FORMAT, §7 */
describe('normalizeFrom', () => {
	it('keeps "Lecture I, Lecture V" as two lectures', () => {
		expect(normalizeFrom('Lecture I, Lecture V')).toEqual(['Lecture I', 'Lecture V']);
	});

	it('writes bare "I, V" the same way as "Lecture I, Lecture V"', () => {
		expect(normalizeFrom('I, V')).toEqual(normalizeFrom('Lecture I, Lecture V'));
		expect(normalizeFrom('3')).toEqual(['Lecture 3']);
	});

	it('ignores case, so "lecture v" is "Lecture V"', () => {
		expect(normalizeFrom('lecture v')).toEqual(['Lecture V']);
	});

	it('drops empty parts and gives nothing for empty text', () => {
		expect(normalizeFrom('I,, ,V')).toEqual(['Lecture I', 'Lecture V']);
		expect(normalizeFrom('')).toEqual([]);
	});
});

describe('sharesLecture', () => {
	it('is true when two topics have a lecture in common', () => {
		expect(sharesLecture(['Lecture I', 'Lecture V'], ['Lecture V', 'Lecture X'])).toBe(true);
	});

	it('is false for disjoint lectures and for empty lists', () => {
		expect(sharesLecture(['Lecture I'], ['Lecture II'])).toBe(false);
		expect(sharesLecture([], ['Lecture I'])).toBe(false);
		expect(sharesLecture([], [])).toBe(false);
	});
});

/** @see docs/PROMPTS.md §3 (CARD RULES), §7 */
describe('readKeyWords', () => {
	it('strips the asterisks for display and keeps the phrases in order', () => {
		expect(readKeyWords('the exchange of *data* over a *communication medium*')).toEqual({
			text: 'the exchange of data over a communication medium',
			keyWords: ['data', 'communication medium'],
			list: false
		});
	});

	it('leaves a definition with no stars alone', () => {
		expect(readKeyWords('plain text')).toEqual({ text: 'plain text', keyWords: [], list: false });
	});

	it('spots a definition that is only a starred list', () => {
		const reading = readKeyWords('*malware*, *phishing*, *DoS*');
		expect(reading).toMatchObject({ text: 'malware, phishing, DoS', list: true });
		expect(reading.keyWords).toEqual(['malware', 'phishing', 'DoS']);
		expect(readKeyWords('*a*, *b* and *c*').list).toBe(true);
	});

	it('is not a list when words sit around the starred items or there is only one', () => {
		expect(readKeyWords('types such as *a*, *b*').list).toBe(false);
		expect(readKeyWords('*a*').list).toBe(false);
	});
});

const docs = readFileSync('docs/PROMPTS.md', 'utf8');
const fenced = [...docs.matchAll(/^```\n([\s\S]*?)\n```$/gm)].map((match) => match[1] ?? '');
const MATERIAL = 'Here is my material:';

const map: CourseMap = {
	bigpicture: ['A leads to B.'],
	habit: ['Which layer?'],
	topics: [{ key: 'osi', title: 'The OSI Model', from: ['Lecture I'], sections: ['Layers'] }],
	links: [],
	missing: []
};

/** @see docs/PROMPTS.md §3 and §4 */
describe('prompt-v2', () => {
	it('has BASE word for word from PROMPTS §3', () => {
		expect(BASE_PROMPT).toBe(fenced[0]);
	});

	it('has each GOAL block word for word from PROMPTS §4', () => {
		expect(GOAL_BLOCKS.learn).toBe(fenced.find((block) => block.startsWith('GOAL: learn')));
		expect(GOAL_BLOCKS.study).toBe(fenced.find((block) => block.startsWith('GOAL: I already')));
		expect(GOAL_BLOCKS.cram).toBe(fenced.find((block) => block.startsWith('GOAL: the exam')));
	});

	it('builds BASE, then only the chosen GOAL block, ending with the material line', () => {
		const prompt = buildPrompt({ giving: 'course', goal: 'study' });
		expect(prompt.startsWith(BASE_PROMPT)).toBe(true);
		expect(prompt).toContain(GOAL_BLOCKS.study);
		expect(prompt).not.toContain(GOAL_BLOCKS.learn);
		expect(prompt).not.toContain(GOAL_BLOCKS.cram);
		expect(prompt.trimEnd().endsWith(MATERIAL)).toBe(true);
	});

	it('includes a syllabus only when one is given', () => {
		expect(
			buildPrompt({ giving: 'lecture', goal: 'learn', syllabus: 'exam focus: TCP' })
		).toContain('exam focus: TCP');
		expect(buildPrompt({ giving: 'lecture', goal: 'learn', syllabus: '  ' })).toBe(
			buildPrompt({ giving: 'lecture', goal: 'learn' })
		);
	});

	it('differs by what is being given', () => {
		expect(buildPrompt({ giving: 'lecture', goal: 'learn' })).not.toBe(
			buildPrompt({ giving: 'course', goal: 'learn' })
		);
	});

	it('builds a resume prompt with the map, done topics, where to start, BASE and GOAL', () => {
		const prompt = resumePrompt({
			map,
			done: ['signals'],
			next: { topicKey: 'osi', section: 'Layers' },
			goal: 'cram'
		});
		for (const part of ['signals', 'osi', 'Layers', 'The OSI Model', BASE_PROMPT, GOAL_BLOCKS.cram])
			expect(prompt).toContain(part);
		expect(prompt).not.toContain(GOAL_BLOCKS.learn);
		expect(prompt.trimEnd().endsWith(MATERIAL)).toBe(true);
	});
});
