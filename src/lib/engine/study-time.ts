import { IDLE_CAP_SEC } from '#lib/config/defaults.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import { compareText } from './replay.ts';
import { dayIndex, MS_PER_MINUTE } from './time.ts';
import type { Traced } from './trace.ts';

/**
 * Minutes studied on a day: each session's wall time, with idle time capped. A session's first
 * event counts its own response time; every later one the gap since the previous event. Each piece
 * is capped at `IDLE_CAP_SEC`, so a phone left on the table doesn't eat the day's plan. Events with
 * no session (an "I was right" addition) don't count.
 *
 * @see BUILD_PLAN §6.9 ("Today's minutes") and Decisions log (Fix pass: wall-time minutes)
 */
export function studyMinutesOn(
	events: readonly StudyEvent[],
	day: number,
	tzOffsetMin: number
): Traced<number> {
	const cap = IDLE_CAP_SEC * 1_000;
	const bySession = new Map<string, StudyEvent[]>();
	for (const event of events) {
		if (!('sessionId' in event) || dayIndex(event.ts, tzOffsetMin) !== day) continue;
		const session = bySession.get(event.sessionId);
		if (session) session.push(event);
		else bySession.set(event.sessionId, [event]);
	}
	let ms = 0;
	for (const session of bySession.values()) {
		const ordered = [...session].sort((a, b) => a.ts - b.ts || compareText(a.id, b.id));
		ordered.forEach((event, i) => {
			const previous = ordered[i - 1];
			const piece = previous
				? event.ts - previous.ts
				: 'responseMs' in event
					? event.responseMs
					: 0;
			ms += Math.min(Math.max(piece, 0), cap);
		});
	}
	return {
		result: ms / MS_PER_MINUTE,
		trace: [{ rule: 'study-time', day, sessions: bySession.size, minutes: ms / MS_PER_MINUTE }]
	};
}
