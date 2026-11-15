<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { APP_SHORT_NAME } from '#lib/config/defaults.ts';
	import type { CardStatus, CourseId, ExamFormat } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { CourseToday } from '#lib/services/course-types.ts';
	import type { LastImportView } from '#lib/services/import-undo.ts';
	import { countOf } from '#lib/util/plural.ts';
	import { prefs } from '#lib/services/preferences.svelte.ts';
	import UndoImport from '#lib/ui/card-list/UndoImport.svelte';
	import Banner from '#lib/ui/components/Banner.svelte';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import Hero from '#lib/ui/components/Hero.svelte';
	import ModeDoor from '#lib/ui/components/ModeDoor.svelte';
	import ModeDoorRow from '#lib/ui/components/ModeDoorRow.svelte';
	import SectionHeading from '#lib/ui/components/SectionHeading.svelte';
	import Stamp from '#lib/ui/components/Stamp.svelte';
	import CourseMapPanel from '#lib/ui/course-map/CourseMapPanel.svelte';
	import { courseDoors, type DoorAction } from '#lib/ui/course-map/doors.ts';
	import SpeechBubble from '#lib/ui/components/SpeechBubble.svelte';
	import StatusBadge from '#lib/ui/components/StatusBadge.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import Yuki from '#lib/ui/components/yuki/Yuki.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import BottomNav from '#lib/ui/layout/BottomNav.svelte';
	import { bottomNavHrefs } from '#lib/ui/layout/nav-hrefs.ts';
	import Row from '#lib/ui/layout/Row.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import { ArrowLeft } from '@lucide/svelte';
	import ExamForm from './ExamForm.svelte';
	import PlanCards from './PlanCards.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const courseId = $derived(data.courseId as CourseId);

	let today = $state<CourseToday | null>(null);
	let failed = $state(false);
	let starting = $state<string | null>(null);
	let lastImport = $state<LastImportView | null>(null);
	let undoing = $state(false);
	let notice = $state('');
	// svelte-ignore state_referenced_locally
	let sleepReminder = $state(data.done !== null);

	async function service() {
		return (await import('#lib/services/study-wiring.ts')).coursePlanService;
	}

	async function refresh(): Promise<void> {
		try {
			const wiring = await import('#lib/services/study-wiring.ts');
			[today, lastImport] = await Promise.all([
				wiring.coursePlanService.today(courseId),
				wiring.importUndoService.lastImport(courseId)
			]);
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

	async function undoImport(): Promise<void> {
		undoing = true;
		const wiring = await import('#lib/services/study-wiring.ts');
		const undone = await wiring.importUndoService.undo(courseId);
		undoing = false;
		notice = undone.ok
			? `Import undone: ${countOf(undone.value.notes, 'note')} and ${countOf(undone.value.cards, 'card')} removed.`
			: undone.error;
		await refresh();
	}

	/** Starts a session and opens it, coming back here when it ends. */
	async function start(which: 'review' | 'block2'): Promise<void> {
		if (starting !== null) return;
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

	/** A door's link: a unit to learn or a section of this page; today's review is a button. */
	function doorHref(action: DoorAction): string | undefined {
		switch (action.kind) {
			case 'unit':
				return resolve('/learn/[courseId]/[unitKey]', { courseId, unitKey: action.unitKey });
			case 'scroll':
				return `#${action.target}`;
			case 'review':
				return undefined;
		}
	}

	const totalCards = $derived(
		Object.values(today?.counts ?? {}).reduce((sum, count) => sum + count, 0)
	);

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

<Screen nav>
	{#snippet top()}
		<TopBar title={APP_SHORT_NAME} wordmark>
			{#snippet leading()}
				<Button variant="ghost" size="icon" href={resolve('/')} aria-label="Back">
					<Icon icon={ArrowLeft} size="nav" />
				</Button>
			{/snippet}
			{#snippet trailing()}
				{#if today?.map?.cheat}<Stamp text="Cheat sheet" dashed href="#cheat-sheet" />{/if}
			{/snippet}
		</TopBar>
	{/snippet}
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
		<Hero eyebrow="Course · {countOf(totalCards, 'card')}" title={today.course.name} />
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
		<ModeDoorRow>
			{#each courseDoors(today) as door (door.mode)}
				<ModeDoor
					mode={door.mode}
					hint={door.hint}
					hasWork={door.hasWork}
					href={doorHref(door.action)}
					onclick={door.action.kind === 'review' ? () => start('review') : undefined}
				/>
			{/each}
		</ModeDoorRow>
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
		<Button
			variant="secondary"
			full
			href={resolve('/course/[courseId]/cards', { courseId })}
			data-see-all-cards
		>
			See all cards
		</Button>
		{#if notice}<Banner tone="success">{notice}</Banner>{/if}
		{#if lastImport}
			<UndoImport last={lastImport} busy={undoing} onundo={undoImport} />
		{/if}
		{#if today.map}
			<CourseMapPanel map={today.map} id="cheat-sheet" />
		{/if}
		<SectionHeading title="Exam prep" id="exam" />
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
	<BottomNav active="shelf" hrefs={bottomNavHrefs()} />
</Screen>
