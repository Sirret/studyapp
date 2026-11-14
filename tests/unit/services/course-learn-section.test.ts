import { describe, expect, it } from 'vitest';
import type { Chunk } from '#lib/db/schemas/course.ts';
import type { AcqUnit } from '#lib/engine/acquisition.ts';
import type { CourseData } from '#lib/services/course-plan.ts';
import { unitSection, unitTitle } from '#lib/services/course-learn.ts';
import { chunkId, topicId } from '../engine/fixtures.ts';

/** @see PROMPTS §3 (@section title), DATA_MODEL §3.4 (Chunk.title), Decisions log (Import v2) */

const TOPIC = topicId(1);
const CHUNK = chunkId(10);
const chunk = (overrides: Partial<Chunk> = {}): Chunk => ({
	id: CHUNK,
	topicId: TOPIC,
	order: 0,
	text: 'Some reading',
	words: 2,
	source: 'notes',
	createdAt: 0,
	updatedAt: 0,
	deviceId: 'device-test' as Chunk['deviceId'],
	...overrides
});
const unit = (chunkOf: typeof CHUNK | null): AcqUnit => ({
	key: chunkOf ? `chunk:${chunkOf}` : `topic:${TOPIC}`,
	topicId: TOPIC,
	chunkId: chunkOf,
	words: chunkOf ? 2 : 0,
	cardIds: []
});
/** Only `chunks` and `material.notes` are read by `unitSection`; the rest is unused here. */
const dataWith = (chunks: Chunk[]): CourseData =>
	({
		material: { course: undefined, cards: [], notes: new Map() },
		topics: [],
		chunks,
		events: []
	}) as unknown as CourseData;

describe('unitSection: the chunk title', () => {
	it('uses the stored chunk title (Import v2 @section)', () => {
		const data = dataWith([chunk({ title: 'Cryptography basics' })]);
		expect(unitSection(data, unit(CHUNK))).toBe('Cryptography basics');
	});

	it('falls back to null when the chunk has no title and no cards', () => {
		expect(unitSection(dataWith([chunk()]), unit(CHUNK))).toBeNull();
	});

	it('returns null for a chunk-less unit with no cards', () => {
		expect(unitSection(dataWith([chunk({ title: 'X' })]), unit(null))).toBeNull();
	});

	it('shows the stored title in the unit title', () => {
		const data = dataWith([chunk({ title: 'Hashing' })]);
		const topicData = {
			...data,
			topics: [{ id: TOPIC, name: 'Security' }]
		} as unknown as CourseData;
		expect(unitTitle(topicData, unit(CHUNK), [unit(CHUNK)])).toBe('Security · Hashing');
	});
});
