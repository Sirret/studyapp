import { PLAN_FORECAST_DAYS } from '#lib/config/defaults.ts';
import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { Course } from '#lib/db/schemas/course.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import { AvailabilitySchema, DEFAULT_AVAILABILITY, type Availability } from '#lib/db/schemas/kv.ts';
import { planDays, type PlanCourse, type PlannerResult } from '#lib/engine/planner.ts';
import { compareText } from '#lib/engine/replay.ts';
import { dayIndex, localDateOf } from '#lib/engine/time.ts';
import type { Logger } from '#lib/log/logger.ts';
import { openUnits } from './course-learn.ts';
import { dayMinutesFrom, reviewCards, type CourseData, type PlanEnv } from './course-plan.ts';
import {
	loadCourseData,
	loadPlanEnv,
	planCourse,
	studiedMinutes,
	type PlanRepos
} from './planner-inputs.ts';
import type {
	PlanDayView,
	PlanExamView,
	PlanView,
	ShortfallView,
	TodayCourseView,
	TodayPlanView
} from './planner-types.ts';
import type { ReplayConfigSource } from './replay-service.ts';

export interface PlannerDeps {
	repos: PlanRepos;
	events: EventRepo;
	kv: KvRepo;
	replayConfig: ReplayConfigSource;
	clock: () => number;
	logger: Logger;
}

/** Everything one planning pass loaded and worked out. */
interface Planned {
	env: PlanEnv;
	today: number;
	data: Map<CourseId, CourseData>;
	planned: PlanCourse[];
	/** Day minutes from today (index 0 = today, after what was studied). */
	dayMinutes: number[];
	studied: number;
	plan: PlannerResult;
}

const READY = new Set(['exam-ready', 'secure']);

/**
 * The planner's service: shares each day's minutes across every course with an exam ahead
 * (`planDays`), and serves Today, the Plan screen, the availability calendar and each course's
 * share. The plan is re-derived on every call (nothing stored), so the first open of a study day
 * re-plans it, as does any change to exams, availability or cards.
 *
 * @see BUILD_PLAN §6.9, CONCEPT §10 and Decisions log (Phase 8)
 */
export class PlannerService {
	constructor(private readonly deps: PlannerDeps) {}

	/** The availability calendar, or the defaults until the student sets it. */
	async availability(): Promise<Availability> {
		return (await this.deps.kv.get('availability')) ?? DEFAULT_AVAILABILITY;
	}

	/** Saves the availability calendar (validated), which re-plans every course. */
	async setAvailability(availability: Availability): Promise<void> {
		const parsed = AvailabilitySchema.parse(availability);
		const overrides = [...new Map(parsed.overrides.map((o) => [o.date, o])).values()].sort((a, b) =>
			compareText(a.date, b.date)
		);
		await this.deps.kv.set('availability', { ...parsed, overrides });
		this.deps.logger.info('planner', 'availability', { overrides: overrides.length });
	}

	/** Today: minutes per course, what is due, the first shortfall, and whether today is done. */
	async today(): Promise<TodayPlanView> {
		const run = await this.run();
		const todaySplit = run.plan.days[0]?.minutes ?? {};
		const courses = [...run.data.values()].map((data) =>
			this.courseToday(data, run, todaySplit[data.material.course.id])
		);
		const planned = courses.reduce((sum, c) => sum + (c.plannedMinutes ?? 0), 0);
		return {
			courses,
			studiedMinutes: Math.round(run.studied),
			shortfall: this.shortfall(run),
			done: run.planned.length > 0 && run.studied >= 1 && planned === 0
		};
	}

	/** The Plan screen: day bars, exams and their feasibility. */
	async week(): Promise<PlanView> {
		const run = await this.run();
		const lastExam = Math.max(run.today, ...run.planned.map((c) => c.examDay));
		const count = Math.max(PLAN_FORECAST_DAYS, lastExam - run.today + 1);
		const days = Array.from({ length: count }, (_, i) => this.dayView(run, run.today + i));
		const exams = run.plan.checks.map((check) => this.examView(run, check.courseId));
		return { days, exams: exams.flatMap((e) => e ?? []), feasible: run.plan.feasible };
	}

	/**
	 * A course's minutes per day from today to the day before its exam: its split minutes plus the
	 * day's free minutes; `null` when the course has no exam ahead.
	 */
	async shareOf(courseId: CourseId): Promise<number[] | null> {
		const run = await this.run();
		const course = run.planned.find((c) => c.courseId === courseId);
		if (!course) return null;
		return Array.from({ length: course.examDay - run.today }, (_, i) => {
			const split = run.plan.days[i];
			return (split?.minutes[courseId] ?? 0) + (split?.freeMinutes ?? run.dayMinutes[i] ?? 0);
		});
	}

	private async run(): Promise<Planned> {
		const { repos, kv, replayConfig, clock } = this.deps;
		const env = await loadPlanEnv(kv, replayConfig, clock());
		const events = await this.deps.events.list();
		const courses = (await repos.courses.list()).filter((c) => c.status === 'active');
		const data = new Map<CourseId, CourseData>();
		for (const course of courses)
			data.set(course.id, await loadCourseData(repos, course.id, events));
		const planned = [...data.values()].flatMap((d) => planCourse(d, env) ?? []);
		const today = dayIndex(env.now, env.tzOffsetMin);
		const lastExam = Math.max(today, ...planned.map((c) => c.examDay));
		const studied = studiedMinutes(events, env);
		const dayMinutes = dayMinutesFrom(env.availability, today, lastExam - today + 1);
		dayMinutes[0] = Math.max(0, (dayMinutes[0] ?? 0) - studied);
		const plan = planDays({
			courses: planned,
			today,
			dayMinutes,
			examMorningMinutes: env.availability.examMorningMinutes,
			retention: env.settings.retention,
			now: env.now,
			calibration: env.calibration,
			fsrs: env.fsrs
		});
		this.deps.logger.info('planner', 'plan', {
			feasible: plan.result.feasible,
			courses: planned.length
		});
		return { env, today, data, planned, dayMinutes, studied, plan: plan.result };
	}

	private courseToday(data: CourseData, run: Planned, split: number | undefined): TodayCourseView {
		const { course, cards } = data.material;
		const planned = run.planned.find((c) => c.courseId === course.id);
		const due = reviewCards(data, run.env.now).filter(
			(card) => card.status !== 'unseen' && card.due !== undefined && card.due <= run.env.now
		);
		const ready = cards.filter((card) => READY.has(card.status)).length;
		return {
			id: course.id,
			name: course.name,
			color: course.color,
			examDate: course.examDate ?? null,
			daysToExam: planned ? planned.examDay - run.today : null,
			plannedMinutes: planned ? (split ?? 0) : null,
			dueCards: due.length,
			unitsToLearn: openUnits(data, run.env, planned !== undefined).units.length,
			readiness: cards.length === 0 ? 0 : ready / cards.length
		};
	}

	private courseOf(run: Planned, courseId: CourseId): Course | undefined {
		return run.data.get(courseId)?.material.course;
	}

	private shortfall(run: Planned): ShortfallView | null {
		const short = run.plan.firstShort;
		const course = short && this.courseOf(run, short.courseId);
		if (!short || !course) return null;
		const cutCount = run.plan.cuts
			.filter(
				(cut) =>
					(run.planned.find((c) => c.courseId === cut.courseId)?.examDay ?? Infinity) <=
					short.examDay
			)
			.reduce((sum, cut) => sum + cut.cutIds.length, 0);
		return {
			courseId: course.id,
			courseName: course.name,
			examDate: localDateOf(short.examDay),
			shortfallMinutes: short.shortfallMinutes,
			cutCount
		};
	}

	private dayView(run: Planned, day: number): PlanDayView {
		const offset = day - run.today;
		const split = run.plan.days[offset];
		const segments = run.planned.flatMap((planned) => {
			const course = this.courseOf(run, planned.courseId);
			const minutes = split?.minutes[planned.courseId] ?? 0;
			return course && minutes > 0
				? [{ courseId: course.id, name: course.name, color: course.color, minutes }]
				: [];
		});
		const cap = Math.floor(
			run.dayMinutes[offset] ?? dayMinutesFrom(run.env.availability, day, 1)[0] ?? 0
		);
		const exams = run.planned
			.filter((c) => c.examDay === day)
			.flatMap((c) => {
				const course = this.courseOf(run, c.courseId);
				return course ? [{ courseId: course.id, name: course.name, color: course.color }] : [];
			});
		const given = segments.reduce((sum, s) => sum + s.minutes, 0);
		return {
			date: localDateOf(day),
			today: offset === 0,
			capMinutes: cap,
			segments,
			freeMinutes: split?.freeMinutes ?? cap - given,
			exams
		};
	}

	private examView(run: Planned, courseId: CourseId): PlanExamView | null {
		const course = this.courseOf(run, courseId);
		const check = run.plan.checks.find((c) => c.courseId === courseId);
		const cut = run.plan.cuts.find((c) => c.courseId === courseId);
		if (!course?.examDate || !check || !cut) return null;
		return {
			courseId,
			name: course.name,
			color: course.color,
			examDate: course.examDate,
			fits: check.fits,
			shortfallMinutes: check.shortfallMinutes,
			workMinutes: check.demandMinutes,
			availableMinutes: check.supplyMinutes,
			degradations: cut.degradations,
			cutCount: cut.cutIds.length
		};
	}
}
