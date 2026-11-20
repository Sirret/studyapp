<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CardStatus, CourseId, ExamFormat } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { CourseToday } from '#lib/services/course-types.ts';
	import { prefs } from '#lib/services/preferences.svelte.ts';
	import type { ScopeView } from '#lib/services/scope-service.ts';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import Hero from '#lib/ui/components/Hero.svelte';
	import SectionHeading from '#lib/ui/components/SectionHeading.svelte';
	import SpeechBubble from '#lib/ui/components/SpeechBubble.svelte';
	import StatusBadge from '#lib/ui/components/StatusBadge.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import Yuki from '#lib/ui/components/yuki/Yuki.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import BottomNav from '#lib/ui/layout/BottomNav.svelte';
	import { bottomNavHrefs } from '#lib/ui/layout/nav-hrefs.ts';
	import Row from '#lib/ui/layout/Row.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Sidebar from '#lib/ui/layout/Sidebar.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import ExamForm from './ExamForm.svelte';
	import PlanCards from './PlanCards.svelte';
	import type { PageProps } from './$types';

	/**
	 * Exam prep (`/course/[id]/exam`): the course's planned work for today, its cram or one-night
	 * plan, the readiness counts and the exam date, all over the in-scope cards (Q12). The logic is
	 * CoursePlanService's, unchanged; this screen collects what the course page used to show.
	 * @see SESSION_NOTES C, J; Decisions log "Phase 8.6 Q12"
	 */
	let { data }: PageProps = $props();
	const navHrefs = bottomNavHrefs();
	const courseId = $derived(data.courseId as CourseId);
	const coursePage = $derived(resolve('/course/[courseId]', { courseId: data.courseId }));

	let today = $state<CourseToday | null>(null);
	let scope = $state<ScopeView | null>(null);
	let failed = $state(false);
	let starting = $state<string | null>(null);
	// svelte-ignore state_referenced_locally
	let sleepReminder = $state(data.done !== null);

	async function refresh(): Promise<void> {
		try {
			const wiring = await import('#lib/services/study-wiring.ts');
			[today, scope] = await Promise.all([
				wiring.coursePlanService.today(courseId),
				wiring.scopeService.view(courseId)
			]);
		} catch (error: unknown) {
			logger.error('exam', 'not loaded', { error: String(error) });
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
		const wiring = await import('#lib/services/study-wiring.ts');
		await wiring.coursePlanService.setExam(courseId, exam);
		await refresh();
	}

	/** Starts a session and opens it, coming back here when it ends. */
	async function start(which: 'review' | 'block2'): Promise<void> {
		if (starting !== null) return;
		starting = which;
		try {
			const plans = (await import('#lib/services/study-wiring.ts')).coursePlanService;
			const view =
				which === 'review'
					? await plans.startReview(courseId)
					: await plans.startBlockTwo(courseId);
			const back = `${resolve('/course/[courseId]/exam', { courseId })}?done=${which}`;
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

<svelte:head><title>Exam prep · {today?.course.name ?? 'Course'}</title></svelte:head>

<Screen nav>
	{#snippet side()}<Sidebar active="shelf" hrefs={navHrefs} yuki={false} />{/snippet}
	{#snippet top()}
		<TopBar title="Exam prep">
			{#snippet leading()}
				<Button variant="ghost" size="icon" href={coursePage} aria-label="Course page">
					<Icon icon={ArrowLeft} size="nav" />
				</Button>
			{/snippet}
		</TopBar>
	{/snippet}
	{#if failed}
		<StickyNote title="Exam prep didn't load">
			Reload the page to try again. Nothing was lost.
			{#snippet actions()}<Button onclick={() => location.reload()}>Reload</Button>{/snippet}
		</StickyNote>
	{:else if today === null}
		<EmptyState message="Loading the plan…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else}
		<Hero eyebrow="Exam prep" title={today.course.name} />
		{#if scope && !scope.whole}
			<p class="scope" data-exam-scope>
				Planning {scope.topics} of {scope.of} topics. Change it on the course page.
			</p>
		{/if}
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
				{#if prefs.companion !== 'off'}
					<Yuki state={today.learn?.mode === 'onenight' ? 'sleepy' : 'idle'} size={72} />
				{/if}
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
		<SectionHeading title="Today" id="plan" />
		<PlanCards
			{today}
			{starting}
			onreview={() => start('review')}
			onblocktwo={() => start('block2')}
		/>
		<SectionHeading title="Exam date" id="exam" />
		<Stack gap="md">
			{#key `${today.course.examDate}-${today.course.examTime}-${today.course.examFormat}`}
				<ExamForm
					examDate={today.course.examDate}
					examTime={today.course.examTime}
					examFormat={today.course.examFormat}
					onsave={saveExam}
				/>
			{/key}
			<Button variant="ghost" href={coursePage}>Back to the course</Button>
		</Stack>
	{/if}
	<BottomNav active="shelf" hrefs={navHrefs} />
</Screen>

<style>
	.scope {
		margin: 0;
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		letter-spacing: var(--type-label-tracking);
	}
</style>
