<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/config/defaults.ts';
	import type { CourseId } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { TodayCourseView, TodayPlanView } from '#lib/services/planner-types.ts';
	import { prefs } from '#lib/services/preferences.svelte.ts';
	import ConfirmDialog from '#lib/ui/components/ConfirmDialog.svelte';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import ReadinessRing from '#lib/ui/components/ReadinessRing.svelte';
	import SpeechBubble from '#lib/ui/components/SpeechBubble.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import Yuki from '#lib/ui/components/yuki/Yuki.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Card from '#lib/ui/primitives/Card.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import { X } from '@lucide/svelte';

	/** Today (DESIGN §6, BUILD_PLAN §9): the planner's minutes per course, shortfall, rest. */
	let plan = $state<TodayPlanView | null>(null);
	let starting = $state<string | null>(null);
	let failed = $state(false);

	async function wiring() {
		return import('#lib/services/study-wiring.ts');
	}

	async function refresh(): Promise<void> {
		try {
			plan = await (await wiring()).plannerService.today();
		} catch (error: unknown) {
			logger.error('today', 'plan not loaded', { error: String(error) });
			failed = true;
		}
	}

	$effect(() => {
		void refresh();
	});

	let trashTarget = $state<TodayCourseView | null>(null);
	let confirmOpen = $state(false);
	let trashing = $state(false);

	function askTrash(course: TodayCourseView): void {
		trashTarget = course;
		confirmOpen = true;
	}

	/** Trashes the course after the popup is confirmed, then re-plans. */
	async function trash(): Promise<void> {
		const target = trashTarget;
		if (!target) return;
		trashing = true;
		try {
			await (await wiring()).courseService.trash(target.id);
			confirmOpen = false;
			await refresh();
		} finally {
			trashing = false;
		}
	}

	/** Starts today's review for a course and comes back here when it ends. */
	async function start(course: TodayCourseView): Promise<void> {
		starting = course.id;
		try {
			const view = await (await wiring()).coursePlanService.startReview(course.id as CourseId);
			const study = resolve('/study/[sessionId]', { sessionId: view.sessionId });
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()d path plus a query
			await goto(`${study}?back=${encodeURIComponent(resolve('/'))}`);
		} finally {
			starting = null;
		}
	}

	function examLine(course: TodayCourseView): string {
		if (course.daysToExam === null) return 'No exam date';
		if (course.daysToExam === 0) return 'Exam today';
		if (course.daysToExam === 1) return 'Exam tomorrow';
		return `Exam in ${course.daysToExam} days`;
	}

	function workLine(course: TodayCourseView): string {
		const parts = [`${course.dueCards} due`];
		if (course.unitsToLearn > 0) parts.push(`${course.unitsToLearn} to learn`);
		return parts.join(' · ');
	}

	const greeting = $derived.by(() => {
		const exams = plan?.courses.filter((c) => c.daysToExam !== null) ?? [];
		if (exams.length === 0) return "Hi! Pick a course and we'll keep it fresh.";
		const first = [...exams].sort((a, b) => (a.daysToExam ?? 0) - (b.daysToExam ?? 0))[0];
		const count = exams.length === 1 ? 'One exam ahead' : `${exams.length} exams ahead`;
		return `${count} — let's start with ${first?.name}.`;
	});
</script>

<Screen>
	{#snippet top()}<TopBar title={APP_NAME} />{/snippet}
	{#if failed}
		<StickyNote title="Today's plan didn't load">
			Reload the page to try again. Nothing was lost.
			{#snippet actions()}<Button onclick={() => location.reload()}>Reload</Button>{/snippet}
		</StickyNote>
	{:else if plan === null}
		<EmptyState message="Loading today's plan…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else if plan.courses.length === 0}
		<EmptyState message="No courses yet." companion={prefs.companion !== 'off'}>
			{#snippet action()}
				<Button href={resolve('/import')}>Import your first lecture</Button>
			{/snippet}
		</EmptyState>
	{:else}
		{#if plan.done}
			<Row gap="md">
				{#if prefs.companion !== 'off'}<Yuki state="sleepy" size={96} />{/if}
				<SpeechBubble
					text="That's what today can hold. Rest now — you can keep going if you want."
				/>
			</Row>
		{:else}
			<Row gap="md">
				{#if prefs.companion !== 'off'}<Yuki state="idle" size={96} />{/if}
				<SpeechBubble text={greeting} />
			</Row>
		{/if}
		{#if plan.shortfall}
			<Row gap="md">
				{#if prefs.companion !== 'off'}<Yuki state="worried-kind" size={72} />{/if}
				<StickyNote title="Not everything fits before {plan.shortfall.courseName}'s exam">
					It's about {Math.ceil(plan.shortfall.shortfallMinutes / 60)} h short ({plan.shortfall
						.shortfallMinutes} min). The plan shows what I'd cut: {plan.shortfall.cutCount}
					{plan.shortfall.cutCount === 1 ? 'piece' : 'pieces'} of work.
					{#snippet actions()}
						<Button variant="secondary" href={resolve('/planner')}>See the plan</Button>
					{/snippet}
				</StickyNote>
			</Row>
		{/if}
		{#each plan.courses as course (course.id)}
			<Card stripe={course.color} tag="article" label={course.name}>
				<Stack gap="md">
					<Row justify="between">
						<Chip color={course.color}>{course.name}</Chip>
						<Button
							variant="ghost"
							size="icon"
							aria-label="Delete {course.name}"
							onclick={() => askTrash(course)}
							data-trash={course.name}
						>
							<Icon icon={X} />
						</Button>
					</Row>
					<Row gap="md">
						<ReadinessRing percent={course.readiness * 100} color={course.color} size={56} />
						<Stack gap="xs">
							<strong data-planned={course.name}>
								{course.plannedMinutes === null
									? 'Keep it fresh'
									: `${course.plannedMinutes} min today`}
							</strong>
							<span>{examLine(course)} · {workLine(course)}</span>
						</Stack>
					</Row>
					{#if course.dueCards > 0}
						<Button
							full
							loading={starting === course.id}
							onclick={() => start(course)}
							data-start={course.name}>Start review</Button
						>
					{/if}
					<Button
						variant={course.dueCards > 0 ? 'secondary' : 'primary'}
						full
						href={resolve('/course/[courseId]', { courseId: course.id })}>Plan and learn</Button
					>
				</Stack>
			</Card>
		{/each}
		<Row gap="sm">
			<Button variant="secondary" href={resolve('/planner')}>Plan and availability</Button>
			<Button variant="ghost" href={resolve('/import')}>Import more</Button>
		</Row>
	{/if}
	<ConfirmDialog
		bind:open={confirmOpen}
		title="Delete {trashTarget?.name ?? 'this course'}?"
		confirmLabel="Delete course"
		busy={trashing}
		onconfirm={trash}
	>
		This deletes the course and all its topics and cards. This can't be undone.
	</ConfirmDialog>
</Screen>
