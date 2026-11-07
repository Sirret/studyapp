import { describe, expect, it } from 'vitest';
import { CRITERION_FIRST } from '#lib/config/defaults.ts';
import type { SessionId } from '#lib/db/schemas/common.ts';
import { emptyCriterionHistory, hasMetCriterion, recordCriterion } from '#lib/engine/criterion.ts';
import { CRITERION_LATER } from '#lib/config/defaults.ts';
import { makeReview, uuid } from './fixtures.ts';

const S1 = uuid(0x51) as SessionId;
const S2 = uuid(0x52) as SessionId;
const correct = (sessionId: SessionId, weight: 'full' | 'recognition' = 'full') =>
	makeReview({ sessionId, weight, correct: true });
const times = <T>(n: number, make: () => T): T[] => Array.from({ length: n }, make);

describe('hasMetCriterion', () => {
	it('is false with no history', () => {
		expect(hasMetCriterion([])).toBe(false);
	});

	it('needs CRITERION_FIRST counting corrects in one session', () => {
		expect(hasMetCriterion(times(CRITERION_FIRST - 1, () => correct(S1)))).toBe(false);
		expect(hasMetCriterion(times(CRITERION_FIRST, () => correct(S1)))).toBe(true);
	});

	it('does not add corrects up across sessions while the first criterion is unmet', () => {
		const split = [...times(CRITERION_FIRST - 1, () => correct(S1)), correct(S2)];
		expect(hasMetCriterion(split)).toBe(false);
	});

	it('needs the last counting correct to be full weight', () => {
		const mcOnly = times(CRITERION_FIRST, () => correct(S1, 'recognition'));
		expect(hasMetCriterion(mcOnly)).toBe(false);
		expect(hasMetCriterion([...mcOnly, correct(S1)])).toBe(true);
	});

	it('ignores uncredited, redo and none-weight answers', () => {
		const ignored = [
			makeReview({ sessionId: S1, credited: false }),
			makeReview({ sessionId: S1, firstAttempt: false }),
			makeReview({ sessionId: S1, weight: 'none' })
		];
		expect(hasMetCriterion(times(CRITERION_FIRST, () => ignored).flat())).toBe(false);
	});
});

describe('recordCriterion with interleaved sessions', () => {
	it('fixes a session required count at its first counting answer', () => {
		const history = emptyCriterionHistory();
		const order = [S1, S2, S1, S1];
		const sessions = order.map((sessionId) => recordCriterion(history, correct(sessionId)).session);
		// S2 started before S1 met the criterion, so it still needs CRITERION_FIRST.
		expect(history.sessions.get(S2)?.criterion.required).toBe(CRITERION_FIRST);
		expect(history.sessions.get(S1)?.met).toBe(true);
		expect(history.metEver).toBe(true);
		expect(sessions[1]?.met).toBe(false);
	});

	it('gives a session started after the criterion was met CRITERION_LATER', () => {
		const history = emptyCriterionHistory();
		for (let i = 0; i < CRITERION_FIRST; i += 1) recordCriterion(history, correct(S1));
		expect(recordCriterion(history, correct(S2)).session.criterion.required).toBe(CRITERION_LATER);
	});
});
