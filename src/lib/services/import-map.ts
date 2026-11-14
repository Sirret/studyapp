import type { Course, CourseMap, ImportGoal, Topic } from '#lib/db/schemas/course.ts';
import type { ImportPlan, PlannedTopic } from '#lib/import/build.ts';
import { sharesLecture } from '#lib/import/lectures.ts';
import { resumePrompt } from '#lib/import/prompt-v2.ts';

/**
 * Import v2 on the service side: which existing topic an imported one updates, the map's
 * "N of M imported" checklist, the course map to store, and the resume prompt.
 *
 * @see docs/PROMPTS.md §1, §5, §6, §7 and Decisions log (Import v2: re-import by lectures)
 */

/** One map topic in the preview checklist. */
export interface ChecklistItem {
	key: string;
	title: string;
	/** In this paste or already in the course. */
	imported: boolean;
	/** Imported, but its reply stopped inside it. */
	partial: boolean;
}

/** The existing topic an imported one updates: shared lecture, then same key, then same name. */
export function matchTopic(existing: readonly Topic[], planned: PlannedTopic): Topic | undefined {
	return (
		(planned.from.length > 0
			? existing.find((topic) => sharesLecture(topic.from ?? [], planned.from))
			: undefined) ??
		(planned.key ? existing.find((topic) => topic.key === planned.key) : undefined) ??
		existing.find((topic) => topic.name === planned.name)
	);
}

/** The map's topics, ticked when this paste or the course already has them. */
export function mapChecklist(
	map: Pick<CourseMap, 'topics'> | null | undefined,
	plan: ImportPlan,
	existing: readonly Topic[]
): ChecklistItem[] {
	return (map?.topics ?? []).map(({ key, title }) => {
		const planned = plan.topics.find((topic) => topic.key === key);
		const stored = existing.find((topic) => topic.key === key);
		return {
			key,
			title,
			imported: planned !== undefined || stored !== undefined,
			partial: planned ? planned.partial === true : stored?.partial === true
		};
	});
}

/** The course map after this import: the paste's map, else the stored one, with the resume point. */
export function nextCourseMap(
	course: Course,
	plan: ImportPlan,
	goal?: ImportGoal
): CourseMap | undefined {
	const base: Omit<CourseMap, 'next' | 'goal'> | undefined = plan.map
		? {
				bigpicture: plan.map.bigpicture,
				habit: plan.map.habit,
				topics: plan.map.topics,
				links: plan.map.links,
				missing: plan.map.missing,
				...(plan.map.cheat ? { cheat: plan.map.cheat } : {})
			}
		: course.map;
	if (!base) return undefined;
	const keptGoal = goal ?? course.map?.goal;
	return {
		...base,
		...(plan.status !== 'complete' && plan.resume ? { next: plan.resume } : {}),
		...(keptGoal ? { goal: keptGoal } : {})
	};
}

/** The resume prompt when map topics are still missing or the reply stopped; else null. */
export function resumeFor(
	map: CourseMap | undefined,
	checklist: readonly ChecklistItem[],
	plan: ImportPlan
): string | null {
	const missing = checklist.find((item) => !item.imported || item.partial);
	if (!map || (!missing && plan.status === 'complete')) return null;
	const next = plan.resume ?? (missing ? { topicKey: missing.key } : undefined);
	if (!next) return null;
	const done = checklist.filter((item) => item.imported && !item.partial).map((item) => item.key);
	return resumePrompt({ map, done, next, goal: map.goal ?? 'learn' });
}
