<script lang="ts">
	import { resolve } from '$app/paths';
	import type { CourseToday, CramDayView } from '#lib/services/course-types.ts';
	import Banner from '#lib/ui/components/Banner.svelte';
	import Disclosure from '#lib/ui/components/Disclosure.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Card from '#lib/ui/primitives/Card.svelte';
	import { countOf } from '#lib/util/plural.ts';

	/** Today's review and learning for a course, each with its cost and a start button. @see BUILD_PLAN §6.6–§6.8 */
	let {
		today,
		starting,
		onreview,
		onblocktwo
	}: {
		today: CourseToday;
		starting: string | null;
		onreview: () => void;
		onblocktwo: () => void;
	} = $props();

	const reviewTitle = $derived(
		today.review.kind === 'morningCheck'
			? 'Exam-morning check'
			: today.review.kind === 'cram'
				? `Cram · ${today.daysToExam === 0 ? 'exam today' : `${today.daysToExam} days to the exam`}`
				: 'Long-term review'
	);

	const cuts: Record<string, string> = {
		criterion: 'New cards need 2 correct instead of 3.',
		relearning: 'Fewer review sessions per card.',
		deferNew: 'Some new cards are left out.'
	};

	function dayLabel(day: CramDayView): string {
		if (day.slot === 'morning') return 'Exam morning';
		if (day.slot === 'finalPass') return day.day === 0 ? 'Tonight · final pass' : 'Final pass';
		return day.day === 0 ? 'Tonight' : `In ${day.day} days`;
	}

	const hours = (minutes: number): string =>
		minutes < 60 ? `${minutes} min` : `${Math.round((minutes / 60) * 10) / 10} h`;
</script>

<Card label={reviewTitle}>
	<Stack gap="md">
		<h2>{reviewTitle}</h2>
		<p>
			{#if today.review.cards === 0}
				Nothing to review right now. Cards come here once you've learnt a part or marked a topic as
				read.
			{:else}{countOf(today.review.cards, 'card')}{today.review.minutes > 0
					? ` · ~${today.review.minutes} min`
					: ''}{/if}
		</p>
		{#if today.review.cram}
			{@const cram = today.review.cram}
			{#if !cram.feasible}
				<Banner tone="warning">
					This plan is {hours(cram.shortfallMinutes)} short of the time you have. Study what you can;
					the weakest cards come first.
				</Banner>
			{/if}
			{#if cram.degradations.length > 0}
				<Banner tone="info">
					To fit your time: {cram.degradations.map((step) => cuts[step]).join(' ')}
					{#if cram.deferred > 0}({cram.deferred} new cards wait until after the exam.){/if}
				</Banner>
			{/if}
			<Disclosure summary="The plan up to the exam">
				<ul>
					{#each cram.days as day (`${day.day}-${day.slot}`)}
						<li>{dayLabel(day)}: {day.cards} cards, ~{day.minutes} min</li>
					{/each}
				</ul>
			</Disclosure>
		{/if}
		{#if today.review.cards > 0}
			<Button full loading={starting === 'review'} onclick={onreview} data-start-review
				>Start review</Button
			>
		{/if}
	</Stack>
</Card>

{#if today.learn?.mode === 'acquisition'}
	<Card tag="section" label="Learn new material">
		<Stack gap="md">
			<h2>Learn new material</h2>
			<p>
				{today.learn.path === 'quick'
					? 'Quick path: no warm-up questions, to save time.'
					: 'Each part: key terms, a warm-up, the reading, then a short quiz.'} Tomorrow's retest is what
				counts.
			</p>
			{#each today.learn.units as unit (unit.key)}
				<Row justify="between">
					<span>{unit.title} · ~{unit.minutes} min, {unit.steps} steps</span>
					<Button
						variant="secondary"
						href={resolve('/learn/[courseId]/[unitKey]', {
							courseId: today.course.id,
							unitKey: unit.key
						})}>Start</Button
					>
				</Row>
			{/each}
		</Stack>
	</Card>
{:else if today.learn?.mode === 'onenight'}
	{@const night = today.learn.plan}
	<Card label="One-night triage">
		<Stack gap="md">
			<h2>One-night triage</h2>
			<p>
				The exam is tomorrow, so tonight covers what matters most: learn, a {night.breakMinutes}-minute
				break, a mixed re-quiz, then sleep. Tomorrow morning there's a short check.
			</p>
			{#if night.skipped.length > 0}
				<Banner tone="warning">
					Tonight can hold {night.chosen.length} of {night.chosen.length + night.skipped.length} parts.
					Left out: {night.skipped.map((unit) => unit.title).join(', ')}.
				</Banner>
			{/if}
			{#each night.chosen as unit (unit.key)}
				<Row justify="between">
					<span>{unit.title} · ~{unit.minutes} min</span>
					<Button
						variant="secondary"
						href={resolve('/learn/[courseId]/[unitKey]', {
							courseId: today.course.id,
							unitKey: unit.key
						})}>Start</Button
					>
				</Row>
			{/each}
			{#if night.block2Cards > 0}
				<Button full loading={starting === 'block2'} onclick={onblocktwo} data-block-two
					>Re-quiz everything from tonight ({countOf(night.block2Cards, 'card')})</Button
				>
			{:else}
				<p data-block-two-waiting>
					The re-quiz of everything from tonight opens once you've learnt a part.
				</p>
			{/if}
		</Stack>
	</Card>
{/if}
