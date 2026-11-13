import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { DeviceId } from '#lib/db/schemas/common.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import { sortEvents } from '#lib/engine/replay.ts';
import {
	arbEvents,
	arbShuffled,
	byHeadKey,
	deepFreeze,
	DEVICE_A,
	DEVICE_B,
	deviceId,
	eventId,
	inReplayOrder,
	makeReview,
	NUM_RUNS
} from './fixtures.ts';

/**
 * Replay order (BUILD_PLAN §6.12 "Event order", DATA_MODEL §3.6 "Order for replay", Decisions log
 * "Fix pass (A10)"): each device's events by `seq`, devices interleaved by `(ts, deviceId, seq, id)`
 * of their next events; `seq` ties fall back to `ts`, then `id`.
 */

const RUNS = { numRuns: NUM_RUNS };
const DEVICE_C = deviceId(0xc);

const ev = (n: number, device: DeviceId, seq: number, ts: number): StudyEvent =>
	makeReview({ id: eventId(n), deviceId: device, seq, ts });

const ids = (events: readonly StudyEvent[]): string[] => events.map((e) => e.id);

describe('sortEvents: within one device', () => {
	it('replays a device whose clock runs backwards in seq order', () => {
		const s1 = ev(1, DEVICE_A, 1, 5_000);
		const s2 = ev(2, DEVICE_A, 2, 1_000);
		const s3 = ev(3, DEVICE_A, 3, 3_000);
		expect(ids(sortEvents([s3, s1, s2]))).toStrictEqual(ids([s1, s2, s3]));
	});

	it('compares seq as a number', () => {
		const s9 = ev(1, DEVICE_A, 9, 1_000);
		const s10 = ev(2, DEVICE_A, 10, 1_000);
		expect(ids(sortEvents([s10, s9]))).toStrictEqual(ids([s9, s10]));
	});

	it('breaks a seq tie by ts, then by id', () => {
		const late = ev(1, DEVICE_A, 1, 2_000);
		const lateHigherId = ev(3, DEVICE_A, 1, 2_000);
		const early = ev(2, DEVICE_A, 1, 1_000);
		expect(ids(sortEvents([lateHigherId, late, early]))).toStrictEqual(
			ids([early, late, lateHigherId])
		);
	});
});

describe('sortEvents: across devices', () => {
	it('interleaves two devices by ts', () => {
		const a1 = ev(1, DEVICE_A, 1, 1_000);
		const b1 = ev(2, DEVICE_B, 1, 1_010);
		const a2 = ev(3, DEVICE_A, 2, 1_020);
		const b2 = ev(4, DEVICE_B, 2, 1_030);
		expect(ids(sortEvents([b2, a2, b1, a1]))).toStrictEqual(ids([a1, b1, a2, b2]));
	});

	it('breaks a ts tie between device heads by deviceId', () => {
		const a1 = ev(1, DEVICE_A, 5, 1_000);
		const b1 = ev(2, DEVICE_B, 1, 1_000);
		expect(ids(sortEvents([b1, a1]))).toStrictEqual(ids([a1, b1]));
	});

	it('picks between device heads only: an event behind a later head waits for it', () => {
		// A's clock ran back between seq 1 and 2. B's event is earlier than A's head, so it goes
		// first; A's seq 2 then follows its seq 1 although its ts is earlier than B's.
		const a1 = ev(1, DEVICE_A, 1, 100);
		const a2 = ev(2, DEVICE_A, 2, 50);
		const b1 = ev(3, DEVICE_B, 1, 70);
		expect(ids(sortEvents([a2, a1, b1]))).toStrictEqual(ids([b1, a1, a2]));
	});

	it('returns an empty list for no events', () => {
		expect(sortEvents([])).toStrictEqual([]);
	});

	it('does not change its input', () => {
		const events = deepFreeze([ev(2, DEVICE_A, 2, 50), ev(1, DEVICE_A, 1, 100)]);
		expect(() => sortEvents(events)).not.toThrow();
		expect(ids(events)).toStrictEqual([eventId(2), eventId(1)]);
	});
});

/** Per device: strictly rising seq, never-falling ts (a clock that only moves forward). */
const arbForwardDevice = (device: DeviceId) =>
	fc
		.array(fc.record({ seqStep: fc.integer({ min: 1, max: 3 }), tsStep: fc.nat(3) }), {
			maxLength: 6
		})
		.map((steps) => {
			let seq = 0;
			let ts = 1_000;
			return steps.map(({ seqStep, tsStep }) => {
				seq += seqStep;
				ts += tsStep;
				return { device, seq, ts };
			});
		});

const arbForwardEvents = fc
	.tuple(arbForwardDevice(DEVICE_A), arbForwardDevice(DEVICE_B), arbForwardDevice(DEVICE_C))
	.map((devices) => devices.flat().map(({ device, seq, ts }, i) => ev(i + 1, device, seq, ts)))
	.chain((events) => arbShuffled(events));

describe('sortEvents: properties', () => {
	it('matches the reference replay order on any events', () => {
		fc.assert(
			fc.property(arbEvents, (events) => {
				expect(ids(sortEvents(events))).toStrictEqual(ids(inReplayOrder(events)));
			}),
			RUNS
		);
	});

	it('gives the same order whatever order the events arrive in', () => {
		const arb = arbEvents.chain((events) => fc.tuple(fc.constant(events), arbShuffled(events)));
		fc.assert(
			fc.property(arb, ([events, shuffled]) => {
				expect(sortEvents(shuffled)).toStrictEqual(sortEvents(events));
			}),
			RUNS
		);
	});

	it('keeps every event exactly once', () => {
		fc.assert(
			fc.property(arbEvents, (events) => {
				expect([...ids(sortEvents(events))].sort()).toStrictEqual([...ids(events)].sort());
			}),
			RUNS
		);
	});

	it('equals the (ts, deviceId, seq) sort when every device clock only moves forward', () => {
		fc.assert(
			fc.property(arbForwardEvents, (events) => {
				expect(ids(sortEvents(events))).toStrictEqual(ids([...events].sort(byHeadKey)));
			}),
			RUNS
		);
	});
});
