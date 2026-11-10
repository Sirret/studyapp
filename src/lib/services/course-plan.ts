import { DEFAULT_EXAM_TIME } from '#lib/config/defaults.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { CardId, NoteId } from '#lib/db/schemas/common.ts';
import type { Chunk, Course, Topic } from '#lib/db/schemas/course.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import type { Availability, Settings } from '#lib/db/schemas/kv.ts';
import type { AcqCard, AcqUnit } from '#lib/engine/acquisition.ts';
import type { CramCard, CramPlanInput } from '#lib/engine/cram.ts';
import type { Calibration } from '#lib/engine/estimate.ts';
import { currentKind } from '#lib/engine/exercise-kinds.ts';
import type { FsrsConfig } from '#lib/engine/fsrs.ts';
import {
	dayIndex,
	dayOfLocalDate,
	localDateOf,
	localDateTime,
	minutesOfTime,
	weekdayOf
} from '#lib/engine/time.ts';
import { isStudyable, type CourseMaterial } from './study-course.ts';

/**
 * Builds the modes' engine inputs from a loaded course: which cards are still to learn, which
 * are reviewed, the cram plan's days and the exam time.
 *
 * @see BUILD_PLAN §6.6–§6.8 and Decisions log (Phase 7)
 */

/** A course with its topics, chunks and the study history. */
export interface CourseData {
	material: CourseMaterial;
	topics: Topic[];
	chunks: Chunk[];
	events: StudyEvent[];
}

/** What planning needs besides the course. */
export interface PlanEnv {
	now: number;
	tzOffsetMin: number;
	fsrs: FsrsConfig;
	settings: Settings;
	availability: Availability;
	calibration: Calibration;
}

const isReview = (event: StudyEvent): event is ReviewEvent => event.type === 'review';

/** Per card: whether it has a credited review, and whether it was met in a learning mode. */
export function reviewFacts(events: readonly StudyEvent[]): {
	credited: Set<CardId>;
	learnt: Set<CardId>;
} {
	const credited = new Set<CardId>();
	const learnt = new Set<CardId>();
	for (const event of events.filter(isReview)) {
		if (event.credited) credited.add(event.cardId);
		if (event.mode === 'acquisition' || event.mode === 'onenight') learnt.add(event.cardId);
	}
	return { credited, learnt };
}

function liveCards(data: CourseData): Card[] {
	return data.material.cards.filter(
		(card) => !card.suspended && isStudyable(data.material.notes.get(card.noteId))
	);
}

function topicOf(data: CourseData): Map<NoteId, Topic | undefined> {
	const topics = new Map(data.topics.map((topic) => [topic.id, topic]));
	return new Map(
		[...data.material.notes.values()].map((note) => [note.id, topics.get(note.topicId)])
	);
}

/**
 * Cards of unread topics with no credited review and not yet met in one-night mode: what
 * acquisition (or one-night) owns.
 */
export function learningCards(data: CourseData): AcqCard[] {
	const { credited } = reviewFacts(data.events);
	const topics = topicOf(data);
	return liveCards(data).flatMap((card) => {
		const note = data.material.notes.get(card.noteId);
		const topic = topics.get(card.noteId);
		if (!note || topic?.placement !== 'unread' || credited.has(card.id)) return [];
		return [
			{
				id: card.id,
				topicId: topic.id,
				...(note.chunkId ? { chunkId: note.chunkId } : {}),
				noteType: note.type,
				path: card.path,
				kind: currentKind(card.path, card.pathStep, card.accuracy)
			}
		];
	});
}

/** A unit is still to learn while any of its cards hasn't been met in a learning mode. */
export function unitOpen(unit: AcqUnit, events: readonly StudyEvent[]): boolean {
	const { learnt } = reviewFacts(events);
	return unit.cardIds.some((id) => !learnt.has(id));
}

/**
 * Cards for review (long-term or cram): everything live except cards acquisition still owns and
 * hasn't met, and handed-off cards waiting for tomorrow's retest.
 */
export function reviewCards(data: CourseData, now: number): Card[] {
	const owned = new Set(learningCards(data).map((card) => card.id));
	const { learnt } = reviewFacts(data.events);
	return liveCards(data).filter((card) => {
		if (owned.has(card.id) && !learnt.has(card.id)) return false;
		return !(card.fsrs === null && card.due !== undefined && card.due > now);
	});
}

/** Unseen cards of read topics, in course order: long-term's new cards. */
export function readNewCandidates(data: CourseData): CardId[] {
	const topics = topicOf(data);
	return liveCards(data)
		.filter((card) => card.status === 'unseen' && topics.get(card.noteId)?.placement === 'read')
		.map((card) => card.id);
}

/** When the exam starts, or `null` with no date. */
export function examAtOf(course: Course, tzOffsetMin: number): number | null {
	if (!course.examDate) return null;
	return localDateTime(course.examDate, course.examTime ?? DEFAULT_EXAM_TIME, tzOffsetMin);
}

/** The exam's study day, or `null` with no date. */
export function examDayOf(course: Course): number | null {
	return course.examDate ? dayOfLocalDate(course.examDate) : null;
}

/** Available minutes for each of the `count` days from `today`: an override, else the weekday. */
export function dayMinutesFrom(availability: Availability, today: number, count: number): number[] {
	const overrides = new Map(availability.overrides.map((o) => [o.date, o.minutes]));
	return Array.from({ length: Math.max(0, count) }, (_, i) => {
		const day = today + i;
		return overrides.get(localDateOf(day)) ?? availability.weekdayMinutes[weekdayOf(day)] ?? 0;
	});
}

/** The cram plan's input for a course whose exam is `daysToExam` study days away. */
export function cramInput(data: CourseData, env: PlanEnv, daysToExam: number): CramPlanInput {
	const { course, notes } = data.material;
	const topics = topicOf(data);
	const cards: CramCard[] = reviewCards(data, env.now).map((card) => ({
		id: card.id,
		kind: currentKind(card.path, card.pathStep, card.accuracy),
		noteType: notes.get(card.noteId)?.type ?? 'fact',
		fsrs: card.fsrs,
		weak: card.weak,
		priority: topics.get(card.noteId)?.priority ?? 'normal'
	}));
	const today = dayIndex(env.now, env.tzOffsetMin);
	return {
		cards,
		daysToExam,
		examFormat: course.examFormat,
		examAt: examAtOf(course, env.tzOffsetMin) ?? env.now,
		now: env.now,
		dayMinutes: dayMinutesFrom(env.availability, today, daysToExam),
		examMorningMinutes: env.availability.examMorningMinutes,
		sleep: {
			startMin: minutesOfTime(env.availability.sleepWindow.start),
			endMin: minutesOfTime(env.availability.sleepWindow.end)
		},
		calibration: env.calibration,
		fsrs: env.fsrs
	};
}

/** Cards studied in one-night mode on the study day before `today`: the exam-morning check. */
export function morningCheckCards(data: CourseData, today: number, tzOffsetMin: number): CardId[] {
	const live = new Set(liveCards(data).map((card) => card.id));
	const seen = new Set<CardId>();
	for (const event of data.events.filter(isReview)) {
		const lastNight = dayIndex(event.ts, tzOffsetMin) === today - 1;
		if (event.mode === 'onenight' && lastNight && live.has(event.cardId)) seen.add(event.cardId);
	}
	return data.material.cards.map((card) => card.id).filter((id) => seen.has(id));
}
