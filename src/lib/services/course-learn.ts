import type { CardId, ChunkId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import {
	acquisitionUnits,
	choosePath,
	shouldPromptSplit,
	unitCost,
	unitSteps,
	type AcqCard,
	type AcqUnit,
	type AcquisitionPath
} from '#lib/engine/acquisition.ts';
import { p0For, secondsPerAttempt } from '#lib/engine/estimate.ts';
import { planOneNight, type OneNightPlan } from '#lib/engine/onenight.ts';
import { dayIndex } from '#lib/engine/time.ts';
import { learningCards, unitOpen, type CourseData, type PlanEnv } from './course-plan.ts';
import type { OneNightView, UnitView } from './course-types.ts';

/**
 * The learning side of a course: its open acquisition units with their cost, the one-night plan,
 * and which flagged chunks to suggest splitting.
 *
 * @see BUILD_PLAN §6.7, §6.8
 */

/** The open units in study order, with the cards they were built from. */
export function openUnits(
	data: CourseData,
	env: PlanEnv,
	deadline: boolean,
	onlyOpen = true
): { units: AcqUnit[]; cards: AcqCard[] } {
	const cards = learningCards(data);
	const units = acquisitionUnits({
		topics: data.topics,
		chunks: data.chunks,
		cards,
		breadth: deadline && env.settings.acquisition.deadlineOrder === 'breadth'
	}).result.filter((unit) => !onlyOpen || unitOpen(unit, data.events));
	return { units, cards };
}

/** A unit's title: its topic, and the part number when the topic has several units. */
export function unitTitle(data: CourseData, unit: AcqUnit, all: readonly AcqUnit[]): string {
	const topic = data.topics.find((candidate) => candidate.id === unit.topicId)?.name ?? 'Topic';
	const siblings = all.filter((other) => other.topicId === unit.topicId);
	if (siblings.length < 2) return topic;
	return `${topic} · part ${siblings.indexOf(unit) + 1}`;
}

/** The unit's cost and size, for "~12 min, 4 steps". */
export function unitView(
	data: CourseData,
	env: PlanEnv,
	input: {
		unit: AcqUnit;
		all: readonly AcqUnit[];
		cards: readonly AcqCard[];
		path: AcquisitionPath;
	}
): UnitView {
	const steps = unitSteps({
		unit: input.unit,
		cards: input.cards,
		path: input.path,
		pretestOn: env.settings.acquisition.pretest
	}).result;
	const cost = unitCost({
		steps,
		cards: input.cards,
		words: input.unit.words,
		calibration: env.calibration
	});
	return {
		key: input.unit.key,
		title: unitTitle(data, input.unit, input.all),
		minutes: Math.ceil(cost.minutes),
		steps: cost.steps,
		cards: input.unit.cardIds.length
	};
}

/** Full or quick path: `auto` takes the full path when every unit's full cost fits before the exam. */
export function pathFor(
	data: CourseData,
	env: PlanEnv,
	units: { units: AcqUnit[]; cards: AcqCard[] },
	minutesBeforeExam: number | null
): AcquisitionPath {
	const full = units.units.reduce(
		(sum, unit) =>
			sum +
			unitView(data, env, { unit, all: units.units, cards: units.cards, path: 'full' }).minutes,
		0
	);
	return choosePath(
		env.settings.acquisition.path,
		minutesBeforeExam === null || full <= minutesBeforeExam
	);
}

/** Tonight's one-night plan, from the open units at quick-path cost. */
export function oneNight(
	data: CourseData,
	env: PlanEnv,
	tonightMinutes: number
): { plan: OneNightPlan; view: OneNightView; units: AcqUnit[]; cards: AcqCard[] } {
	const open = openUnits(data, env, true);
	const views = new Map(
		open.units.map((unit) => [
			unit.key,
			unitView(data, env, { unit, all: open.units, cards: open.cards, path: 'quick' })
		])
	);
	const byId = new Map(open.cards.map((card) => [card.id, card]));
	const ease = (ids: readonly CardId[]): number =>
		ids.reduce((sum, id) => sum + p0For(byId.get(id)?.noteType ?? 'fact', env.calibration), 0) /
		Math.max(1, ids.length);
	const seconds =
		open.cards.reduce((sum, card) => sum + secondsPerAttempt(card.kind, env.calibration), 0) /
		Math.max(1, open.cards.length);
	const plan = planOneNight({
		units: open.units.map((unit) => ({
			key: unit.key,
			priority: data.topics.find((topic) => topic.id === unit.topicId)?.priority ?? 'normal',
			minutes: views.get(unit.key)?.minutes ?? 0,
			ease: ease(unit.cardIds),
			cardIds: unit.cardIds
		})),
		availableMinutes: tonightMinutes,
		blockTwoSecPerCard: seconds
	}).result;
	const pick = (keys: string[]): UnitView[] => keys.flatMap((key) => views.get(key) ?? []);
	const view: OneNightView = {
		chosen: pick(plan.chosen),
		skipped: pick(plan.skipped),
		breakMinutes: plan.breakMinutes,
		block2Cards: plan.block2.length,
		minutes: Math.ceil(plan.minutes),
		complete: plan.complete
	};
	return { plan, view, ...open };
}

/** First attempts of credited reviews on a later day than the card's first acquisition review. */
function retestAttempts(events: readonly StudyEvent[], ids: ReadonlySet<CardId>, tz: number) {
	const reviews = events.filter(
		(event): event is ReviewEvent => event.type === 'review' && ids.has(event.cardId)
	);
	const learnt = reviews.filter((event) => event.mode === 'acquisition');
	if (learnt.length === 0) return [];
	const learntDay = Math.min(...learnt.map((event) => dayIndex(event.ts, tz)));
	const later = reviews.filter(
		(event) => event.credited && event.firstAttempt && dayIndex(event.ts, tz) > learntDay
	);
	if (later.length === 0) return [];
	const retestDay = Math.min(...later.map((event) => dayIndex(event.ts, tz)));
	return later.filter((event) => dayIndex(event.ts, tz) === retestDay);
}

/** Flagged chunks whose next-day retest was still below the split threshold. */
export function splitPrompts(
	data: CourseData,
	env: PlanEnv
): { chunkId: ChunkId; title: string }[] {
	return data.chunks.flatMap((chunk) => {
		if (chunk.splitFlag !== true) return [];
		const ids = new Set(
			data.material.cards
				.filter((card) => data.material.notes.get(card.noteId)?.chunkId === chunk.id)
				.map((card) => card.id)
		);
		const retest = retestAttempts(data.events, ids, env.tzOffsetMin);
		if (!shouldPromptSplit(true, retest)) return [];
		const topic = data.topics.find((candidate) => candidate.id === chunk.topicId)?.name ?? 'Topic';
		return [{ chunkId: chunk.id, title: topic }];
	});
}
