<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CardStatus, CourseId, ExamFormat } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { CourseToday } from '#lib/services/course-types.ts';
	import { prefs } from '#lib/services/preferences.svelte.ts';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import SpeechBubble from '#lib/ui/components/SpeechBubble.svelte';
	import StatusBadge from '#lib/ui/components/StatusBadge.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import Yuki from '#lib/ui/components/yuki/Yuki.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ExamForm from './ExamForm.svelte';
	import PlanCards from './PlanCards.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const courseId = $derived(data.courseId as CourseId);

	let today = $state<CourseToday | null>(null);
	let failed = $state(false);
	let starting = $state<string | null>(null);
	// svelte-ignore state_referenced_locally
	let sleepReminder = $state(data.done !== null);

	async function service() {
		return (await import('#lib/services/study-wiring.ts')).coursePlanService;
	}

	async function refresh(): Promise<void> {
		try {
			today = await (await service()).today(courseId);
		} catch (error: unknown) {
			logger.error('course', 'not loaded', { error: String(error) });
			failed = true;
		}
	}

	$effect(() => {
		void refresh();
	});

	async function saveExam(exam: {
		examDate: string | null;
		examTime: string | null;
		examFormat: ExamFormat;
	}): Promise<void> {
		await (await service()).setExam(courseId, exam);
		await refresh();
	}

	/** Starts a session and opens it, coming back here when it ends. */
	async function start(which: 'review' | 'block2'): Promise<void> {
		starting = which;
		try {
			const plans = await service();
			const view =
				which === 'review'
					? await plans.startReview(courseId)
					: await plans.startBlockTwo(courseId);
			const back = `${resolve('/course/[courseId]', { courseId })}?done=${which}`;
			const study = resolve('/study/[sessionId]', { sessionId: view.sessionId });
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()d path plus a query
			await goto(`${study}?back=${encodeURIComponent(back)}`);
		} finally {
			starting = null;
		}
	}

	const order: CardStatus[] = [
		'learning',
		'one-night',
		'needs-work',
		'provisional',
		'exam-ready',
		'secure'
	];
</script>

<svelte:head><title>{today?.course.name ?? 'Course'}</title></svelte:head>

<Screen>
	{#snippet top()}<TopBar title={today?.course.name ?? 'Course'} />{/snippet}
	{#if failed}
		<StickyNote title="This course didn't load">
			Reload the page to try again. Nothing was lost.
			{#snippet actions()}<Button onclick={() => location.reload()}>Reload</Button>{/snippet}
		</StickyNote>
	{:else if today === null}
		<EmptyState message="Loading the course…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else}
		{#if sleepReminder}
			<StickyNote title="That's what today can hold">
				You've done today's planned work. Sleep now — it's what makes it stick. You can keep going
				if you want to.
				{#snippet actions()}<Button variant="secondary" onclick={() => (sleepReminder = false)}
						>Keep going</Button
					>{/snippet}
			</StickyNote>
		{:else}
			<Row gap="md">
				{#if prefs.companion !== 'off'}<Yuki state="idle" size={72} />{/if}
				<SpeechBubble
					text={today.daysToExam === null
						? "No exam date yet, so we'll keep it all fresh over time."
						: today.daysToExam === 0
							? 'Exam today. A short check, then go show them.'
							: `${today.daysToExam} days to go. Here's today's share.`}
				/>
			</Row>
		{/if}
		<Row gap="sm">
			{#each order.filter((status) => (today?.counts[status] ?? 0) > 0) as status (status)}
				<span><StatusBadge {status} /> {today.counts[status]}</span>
			{/each}
		</Row>
		{#each today.splitPrompts as prompt (prompt.chunkId)}
			<StickyNote title="One part of {prompt.title} is still hard">
				It was hard when you learnt it and again on its retest. Splitting it into smaller parts
				usually helps.
			</StickyNote>
		{/each}
		<PlanCards
			{today}
			{starting}
			onreview={() => start('review')}
			onblocktwo={() => start('block2')}
		/>
		<Stack gap="md">
			{#key `${today.course.examDate}-${today.course.examTime}-${today.course.examFormat}`}
				<ExamForm
					examDate={today.course.examDate}
					examTime={today.course.examTime}
					examFormat={today.course.examFormat}
					onsave={saveExam}
				/>
			{/key}
			<Button variant="ghost" href={resolve('/')}>Back to Today</Button>
		</Stack>
	{/if}
</Screen>
