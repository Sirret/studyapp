import { describe, expect, it } from 'vitest';
import type { Note } from '#lib/db/schemas/note.ts';
import { SAMPLE_COURSE_REPLY } from '#lib/content/sample-course.ts';
import { LearnService } from '#lib/services/learn-service.ts';
import { sectionTerms } from '#lib/services/learn-material.ts';
import { markSection } from '#lib/ui/reader/mark-terms.ts';
import { studyStack } from './study-fixtures.ts';

/** The reader's key terms (Decisions "UX fix: reader key terms"). */
type NoteLike = Pick<Note, 'type' | 'payload'>;
const fact = (term: string, keyWords?: string[]): NoteLike =>
	({
		type: 'fact',
		payload: { term, definition: 'd', ...(keyWords ? { keyWords } : {}) }
	}) as NoteLike;
const cloze = (text: string): NoteLike => ({ type: 'cloze', payload: { text } }) as NoteLike;
const keyterm = (term: string): NoteLike =>
	({ type: 'keyterm', payload: { term, definition: 'd' } }) as NoteLike;

const underlined = (text: string, terms: string[]) =>
	markSection(text, terms)
		.flat()
		.filter((s) => s.term)
		.map((s) => s.text);

describe('sectionTerms', () => {
	it('strips a leading "In <subject>, " and keeps the term', () => {
		expect(sectionTerms([keyterm('In network security, a firewall')])).toEqual(['a firewall']);
		expect(sectionTerms([fact('In security, Risk')])).toEqual(['Risk']);
	});

	it('counts starred key words and cloze answers, each once without case', () => {
		const terms = sectionTerms([
			fact('Three CIA goals', ['confidentiality', 'integrity', 'availability']),
			cloze('In security, {{risk}} is the impact of a {{threat}}.'),
			keyterm('Integrity')
		]);
		expect(terms).toEqual([
			'Three CIA goals',
			'confidentiality',
			'integrity',
			'availability',
			'risk',
			'threat'
		]);
	});

	it('gives nothing for notes with no terms', () => {
		expect(
			sectionTerms([{ type: 'scenario', payload: { situation: 's', answer: 'a' } } as NoteLike])
		).toEqual([]);
	});
});

describe('markSection with section terms', () => {
	const text = 'Confidentiality protects secrets. Integrity keeps data intact; integrity again.';

	it('underlines each term once, at its first appearance, in any case', () => {
		const terms = sectionTerms([fact('CIA goals', ['confidentiality', 'integrity'])]);
		expect(underlined(text, terms)).toEqual(['Confidentiality', 'Integrity']);
	});

	it('matches whole words only', () => {
		expect(underlined('Riskier plans carry risk.', ['risk'])).toEqual(['risk']);
		expect(underlined('Integrityless is not a word.', ['integrity'])).toEqual([]);
	});
});

describe('the sample course reader', () => {
	it('sections with term, fact or cloze notes list key terms, and most of them underline some', async () => {
		const env = await studyStack(SAMPLE_COURSE_REPLY);
		const learn = new LearnService({
			repos: env.repos,
			events: env.events,
			kv: env.kv,
			study: env.study,
			logger: env.logger
		});
		const [topic] = await learn.topics(env.courseId);
		const flow = await learn.flow(env.courseId, topic!.id);
		const reads = flow!.screens.flatMap((s) => (s.step === 'read' ? [s] : []));
		expect(reads.length).toBeGreaterThan(0);
		const notes = await env.repos.notes.listByTopic(topic!.id);
		const withTerms = reads.filter((read) =>
			notes.some((n) => n.chunkId === read.chunkId && ['keyterm', 'fact', 'cloze'].includes(n.type))
		);
		expect(withTerms.length).toBeGreaterThan(0);
		for (const read of withTerms) expect(read.terms.length).toBeGreaterThan(0);
		const marking = withTerms.filter((read) => underlined(read.text, read.terms).length > 0);
		expect(marking.length * 2).toBeGreaterThanOrEqual(withTerms.length);
		await env.db.delete();
	}, 60_000);
});
