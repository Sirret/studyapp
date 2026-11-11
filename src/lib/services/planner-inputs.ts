import { SAFETY_MARGIN } from '#lib/config/defaults.ts';
import type { ChunkRepo, CourseRepo, TopicRepo } from '#lib/db/repos/content-repos.ts';
import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import { DEFAULT_AVAILABILITY, DEFAULT_SETTINGS } from '#lib/db/schemas/kv.ts';
import { triage } from '#lib/engine/cram.ts';
import { EMPTY_CALIBRATION } from '#lib/engine/estimate.ts';
import { retrievabilityAt } from '#lib/engine/fsrs.ts';
import type { PlanCourse, PlanItem } from '#lib/engine/planner.ts';
import { dayIndex, MS_PER_MINUTE } from '#lib/engine/time.ts';
import { openUnits, pathFor, unitView } from './course-learn.ts';
import {
	cramInput,
	dayMinutesFrom,
	examAtOf,
	examDayOf,
	type CourseData,
	type PlanEnv
} from './course-plan.ts';
import type { ReplayConfigSource } from './replay-service.ts';
import { loadCourse } from './study-course.ts';

/**
 * Builds the planner's input from stored courses: the planning environment, each course's data,
 * its work items (review cards and units still to learn) and the minutes already studied today.
 *
 * @see BUILD_PLAN §6.9 ("The planner, concretely") and Decisions log (Phase 8)
 */

export interface PlanRepos {
	courses: CourseRepo;
	topics: TopicRepo;
	chunks: ChunkRepo;
	notes: Parameters<typeof loadCourse>[0]['notes'];
	cards: Parameters<typeof loadCourse>[0]['cards'];
}

/** Settings, availability, calibration, FSRS config and time zone at `now`. */
export async function loadPlanEnv(
	kv: KvRepo,
	replayConfig: ReplayConfigSource,
	now: number
): Promise<PlanEnv> {
	const config = await replayConfig();
	return {
		now,
		tzOffsetMin: config.tzOffsetMin,
		fsrs: config.fsrs,
		settings: (await kv.get('settings')) ?? DEFAULT_SETTINGS,
		availability: (await kv.get('availability')) ?? DEFAULT_AVAILABILITY,
		calibration: (await kv.get('calibration')) ?? EMPTY_CALIBRATION
	};
}

/** A course's material, topics and chunks, with the given study history. */
export async function loadCourseData(
	repos: PlanRepos,
	courseId: CourseId,
	events: StudyEvent[]
): Promise<CourseData> {
	const material = await loadCourse(repos, courseId);
	const topics = await repos.topics.listByCourse(courseId);
	const chunks = (await Promise.all(topics.map((t) => repos.chunks.listByTopic(t.id)))).flat();
	return { material, topics, chunks, events };
}

/** Minutes of study logged today: Σ `responseMs` of today's answers. */
export function studiedMinutes(events: readonly StudyEvent[], env: PlanEnv): number {
	const today = dayIndex(env.now, env.tzOffsetMin);
	let ms = 0;
	for (const event of events) {
		if (!('responseMs' in event) || dayIndex(event.ts, env.tzOffsetMin) !== today) continue;
		ms += event.responseMs;
	}
	return ms / MS_PER_MINUTE;
}

/** Review cards: standing from cram triage, recall at the exam with no further review. */
function cardItems(data: CourseData, env: PlanEnv, daysToExam: number): PlanItem[] {
	const input = cramInput(data, env, daysToExam);
	return input.cards.map((card) => ({
		type: 'card',
		id: card.id,
		card: { kind: card.kind, noteType: card.noteType, fsrs: card.fsrs },
		standing: triage(card, input.examAt, env.fsrs).result,
		priority: card.priority,
		rExam: card.fsrs ? retrievabilityAt(card.fsrs, input.examAt, env.fsrs) : 0
	}));
}

/** Units still to learn, at the path the course page would take. */
function unitItems(data: CourseData, env: PlanEnv, today: number, examDay: number): PlanItem[] {
	const open = openUnits(data, env, true);
	const before = dayMinutesFrom(env.availability, today, examDay - today).reduce(
		(a, b) => a + b,
		0
	);
	const path = pathFor(data, env, open, before);
	const byId = new Map(open.cards.map((card) => [card.id, card]));
	return open.units.map((unit) => ({
		type: 'unit',
		id: unit.key,
		// `unitView` includes the safety margin; `courseWork` applies it, so take it out here.
		learnMinutes:
			unitView(data, env, { unit, all: open.units, cards: open.cards, path }).minutes /
			SAFETY_MARGIN,
		cards: unit.cardIds.flatMap((id) => {
			const card = byId.get(id);
			return card ? [{ kind: card.kind, noteType: card.noteType, fsrs: null }] : [];
		}),
		priority: data.topics.find((topic) => topic.id === unit.topicId)?.priority ?? 'normal'
	}));
}

/** The course as the planner sees it, or `null` when it has no exam today or later. */
export function planCourse(data: CourseData, env: PlanEnv): PlanCourse | null {
	const { course } = data.material;
	const examDay = examDayOf(course);
	const today = dayIndex(env.now, env.tzOffsetMin);
	if (examDay === null || examDay < today || examAtOf(course, env.tzOffsetMin) === null) {
		return null;
	}
	return {
		courseId: course.id,
		examDay,
		items: [...cardItems(data, env, examDay - today), ...unitItems(data, env, today, examDay)]
	};
}
