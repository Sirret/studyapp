import { CRITERION_FIRST, CRITERION_FIRST_DEGRADED } from '#lib/config/defaults.ts';
import type { PlanFitView } from '#lib/services/planner-types.ts';
import { durationText } from '#lib/util/duration.ts';
import { countOf } from '#lib/util/plural.ts';

/** What Home's note and Exam prep's banner say about one exam's plan. */
export interface FitText {
	tone: 'info' | 'warning';
	title: string;
	body: string;
}

function joinAnd(parts: readonly string[]): string {
	if (parts.length <= 1) return parts[0] ?? '';
	return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The plan's cuts as one clause ("asks new cards for 2 correct …"); empty when nothing is cut. */
export function cutsText(view: PlanFitView): string {
	return joinAnd(
		view.degradations.flatMap((step) => {
			switch (step) {
				case 'criterion':
					return [
						`asks new cards for ${CRITERION_FIRST_DEGRADED} correct instead of ${CRITERION_FIRST}`
					];
				case 'relearning':
					return ['plans fewer review sessions per card'];
				case 'cut':
					return view.cutCount > 0
						? [
								`leaves ${countOf(view.cutCount, 'piece of work', 'pieces of work')} until after the exam`
							]
						: [];
			}
		})
	);
}

/**
 * One exam's plan in words, from the planner's verdict (`PlanFitView`): it fits (nothing cut); it
 * fits once the plan cuts (the cuts, no shortfall); or it is still short after the cuts (the
 * minutes left and the cuts). Home and Exam prep both use this, so they say the same thing.
 *
 * @see Decisions log "UX fix: one plan verdict"
 */
export function fitText(view: PlanFitView): FitText {
	const exam = `${view.courseName}'s exam`;
	if (view.fits) {
		return {
			tone: 'info',
			title: `Everything fits before ${exam}`,
			body: 'This plan fits the time you have. Nothing is cut.'
		};
	}
	const cuts = cutsText(view);
	if (view.fitsAfterCuts) {
		return {
			tone: 'info',
			title: `To fit everything before ${exam}`,
			body: `The plan ${cuts}. Then it fits the time you have.`
		};
	}
	const short = `about ${durationText(view.shortfallMinutes)} short`;
	return {
		tone: 'warning',
		title: `Not everything fits before ${exam}`,
		body: `${cuts ? `Even when the plan ${cuts}, it's ${short}.` : `It's ${short}.`} Study what you can; the weakest cards come first.`
	};
}
