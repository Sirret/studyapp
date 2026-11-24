<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CourseId } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { ShelfCourseView } from '#lib/services/home-service.ts';
	import type { TodayCourseView } from '#lib/services/planner-types.ts';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import ReadinessMeter from '#lib/ui/components/ReadinessMeter.svelte';
	import SectionHeading from '#lib/ui/components/SectionHeading.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import { examLine, shelfLine, workLine } from '#lib/ui/home/home-text.ts';
	import BottomNav from '#lib/ui/layout/BottomNav.svelte';
	import { bottomNavHrefs } from '#lib/ui/layout/nav-hrefs.ts';
	import Row from '#lib/ui/layout/Row.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import SettingsLink from '#lib/ui/layout/SettingsLink.svelte';
	import Sidebar from '#lib/ui/layout/Sidebar.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Card from '#lib/ui/primitives/Card.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';

	/**
	 * The Shelf (DESIGN §12 "Courses", SESSION_NOTES A11): every course with today's planned minutes,
	 * exam, work, readiness and reading progress; start its review, open it, or delete it.
	 */
	const navHrefs = bottomNavHrefs();

	let courses = $state<TodayCourseView[] | null>(null);
	let reading = $state(new Map<string, ShelfCourseView>());
	let starting = $state<string | null>(null);
	let failed = $state(false);

	async function wiring() {
		return import('#lib/services/study-wiring.ts');
	}

	async function refresh(): Promise<void> {
		try {
			const services = await wiring();
			await services.ensureCardPaths();
			const [plan, shelf] = await Promise.all([
				services.plannerService.today(),
				services.homeService.shelf()
			]);
			reading = new Map(shelf.map((course) => [course.id, course]));
			courses = plan.courses;
		} catch (error: unknown) {
			logger.error('shelf', 'courses not loaded', { error: String(error) });
			failed = true;
		}
	}

	$effect(() => {
		void refresh();
	});

	/** Starts today's review for a course and comes back here when it ends. */
	async function start(course: TodayCourseView): Promise<void> {
		starting = course.id;
		try {
			const view = await (await wiring()).coursePlanService.startReview(course.id as CourseId);
			const study = resolve('/study/[sessionId]', { sessionId: view.sessionId });
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()d path plus a query
			await goto(`${study}?back=${encodeURIComponent(resolve('/courses'))}`);
		} finally {
			starting = null;
		}
	}
</script>

<Screen nav>
	{#snippet side()}<Sidebar active="shelf" hrefs={navHrefs} />{/snippet}
	{#snippet top()}
		<TopBar title="Shelf">
			{#snippet trailing()}<SettingsLink />{/snippet}
		</TopBar>
	{/snippet}
	<SectionHeading title="Your shelf">
		{#snippet action()}
			<Button variant="ghost" href={resolve('/import')}>+ Add</Button>
		{/snippet}
	</SectionHeading>
	{#if failed}
		<StickyNote title="Your courses didn't load">
			Reload the page to try again. Nothing was lost.
			{#snippet actions()}<Button onclick={() => location.reload()}>Reload</Button>{/snippet}
		</StickyNote>
	{:else if courses === null}
		<EmptyState message="Loading your courses…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else if courses.length === 0}
		<EmptyState message="No courses on the shelf yet.">
			{#snippet action()}<Button href={resolve('/')}>See the ways to start</Button>{/snippet}
		</EmptyState>
	{:else}
		{#each courses as course (course.id)}
			{@const read = reading.get(course.id)}
			<Card stripe={course.color} tag="article" label={course.name}>
				<Stack gap="md">
					<Row justify="between">
						<Chip color={course.color}>{course.name}</Chip>
					</Row>
					<Stack gap="xs">
						<strong data-planned={course.name}>
							{course.daysToExam === null
								? 'No exam date yet'
								: course.plannedMinutes === null
									? 'Keep it fresh'
									: `${course.plannedMinutes} min today`}
						</strong>
						<span>{examLine(course)} · {workLine(course)}</span>
						{#if read}<span data-reading={course.name}>{shelfLine(read)}</span>{/if}
						{#if course.daysToExam === null}
							<span data-no-exam-hint={course.name}
								>Set an exam date in Exam prep to get a plan.</span
							>
						{/if}
					</Stack>
					{#if course.daysToExam !== null}
						<!-- Readiness means "ready for the exam", so only with an exam date. -->
						<ReadinessMeter percent={course.readiness * 100} />
					{/if}
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
						href={resolve('/course/[courseId]', { courseId: course.id })}>Open course</Button
					>
				</Stack>
			</Card>
		{/each}
		<Row gap="sm">
			<Button variant="secondary" href={resolve('/planner')}>Plan and availability</Button>
		</Row>
	{/if}
	<BottomNav active="shelf" hrefs={navHrefs} />
</Screen>
