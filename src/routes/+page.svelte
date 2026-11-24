<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { APP_SHORT_NAME } from '#lib/config/defaults.ts';
	import type { CourseId } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { LeftOffView, ShelfCourseView } from '#lib/services/home-service.ts';
	import type { TodayPlanView } from '#lib/services/planner-types.ts';
	import { prefs } from '#lib/services/preferences.svelte.ts';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import Hero from '#lib/ui/components/Hero.svelte';
	import SectionHeading from '#lib/ui/components/SectionHeading.svelte';
	import SpeechBubble from '#lib/ui/components/SpeechBubble.svelte';
	import Stamp from '#lib/ui/components/Stamp.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import { fitText } from '#lib/ui/plan/fit-text.ts';
	import Yuki from '#lib/ui/components/yuki/Yuki.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import { effectOn } from '#lib/ui/delight/delight.ts';
	import { dateStamp, shelfLine, suggestionOf } from '#lib/ui/home/home-text.ts';
	import LeftOffCard from '#lib/ui/home/LeftOffCard.svelte';
	import Welcome from '#lib/ui/home/Welcome.svelte';
	import BottomNav from '#lib/ui/layout/BottomNav.svelte';
	import { bottomNavHrefs } from '#lib/ui/layout/nav-hrefs.ts';
	import Row from '#lib/ui/layout/Row.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import SettingsLink from '#lib/ui/layout/SettingsLink.svelte';
	import Sidebar from '#lib/ui/layout/Sidebar.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import { ArrowRight, BookOpen } from '@lucide/svelte';

	/**
	 * Home (SESSION_NOTES §K, DESIGN §12 "Welcome, Home, Today"): Welcome when there are no courses;
	 * otherwise the den: date stamp, where you left off, a gentle suggestion, and the shelf. No streaks.
	 */
	const navHrefs = bottomNavHrefs();
	const today = dateStamp(new Date());

	let plan = $state<TodayPlanView | null>(null);
	let leftOff = $state<LeftOffView | null>(null);
	let shelf = $state<ShelfCourseView[]>([]);
	let failed = $state(false);
	let adding = $state(false);
	let starting = $state(false);
	let notTonight = $state(false);

	async function wiring() {
		return import('#lib/services/study-wiring.ts');
	}

	async function refresh(): Promise<void> {
		try {
			const services = await wiring();
			await services.ensureCardPaths();
			const [today, last, courses] = await Promise.all([
				services.plannerService.today(),
				services.homeService.leftOff(),
				services.homeService.shelf()
			]);
			leftOff = last;
			shelf = courses;
			plan = today;
		} catch (error: unknown) {
			logger.error('today', 'plan not loaded', { error: String(error) });
			failed = true;
		}
	}

	$effect(() => {
		void refresh();
	});

	/** Welcome's "Try a sample course": adds it, then opens it. */
	async function trySample(): Promise<void> {
		adding = true;
		try {
			const courseId = await (await import('#lib/services/import-wiring.ts')).addSampleCourse();
			if (courseId === null) await refresh();
			else await goto(resolve('/course/[courseId]', { courseId }));
		} finally {
			adding = false;
		}
	}

	const suggestion = $derived(plan ? suggestionOf(plan) : null);

	/** "Let's go": today's review of the suggested course, back here when it ends. */
	async function startSuggested(): Promise<void> {
		if (!suggestion) return;
		starting = true;
		try {
			const id = suggestion.course.id as CourseId;
			const view = await (await wiring()).coursePlanService.startReview(id);
			const study = resolve('/study/[sessionId]', { sessionId: view.sessionId });
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()d path plus a query
			await goto(`${study}?back=${encodeURIComponent(resolve('/'))}`);
		} finally {
			starting = false;
		}
	}

	function leftOffHref(view: LeftOffView): string {
		const courseId = view.courseId;
		switch (view.mode) {
			case 'learn':
				return `${resolve('/course/[courseId]/learn', { courseId })}?topic=${view.topicId}`;
			case 'practice':
				return resolve('/course/[courseId]/practice', { courseId });
			case 'exam':
				return resolve('/course/[courseId]/exam', { courseId });
		}
	}
</script>

<Screen nav>
	{#snippet side()}<Sidebar active="den" hrefs={navHrefs} yuki={false} />{/snippet}
	{#snippet top()}
		<TopBar title={APP_SHORT_NAME} wordmark>
			{#snippet leading()}<span class="date"><Stamp text={today} /></span>{/snippet}
			{#snippet trailing()}<SettingsLink />{/snippet}
		</TopBar>
	{/snippet}
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
		<Welcome {adding} onsample={trySample} />
	{:else}
		<Hero
			title="Welcome back."
			subline="Snow's still falling. Your place is kept."
			snow={effectOn('snowFall', prefs.companion)}
		/>
		{#if leftOff}<LeftOffCard view={leftOff} href={leftOffHref(leftOff)} />{/if}
		{#if plan.done}
			<Row gap="md">
				{#if prefs.companion !== 'off'}<Yuki state="sleepy" size={96} />{/if}
				<SpeechBubble
					text="That's what today can hold. Rest now — you can keep going if you want."
				/>
			</Row>
		{:else if suggestion && !notTonight}
			<Row gap="md">
				{#if prefs.companion !== 'off'}<Yuki state="idle" size={96} />{/if}
				<StickyNote title={suggestion.text}>
					No clock, and it's fine to stop whenever.
					{#snippet actions()}
						<Button loading={starting} onclick={startSuggested} data-suggestion>Let's go</Button>
						<Button variant="ghost" onclick={() => (notTonight = true)}>Not tonight</Button>
					{/snippet}
				</StickyNote>
			</Row>
		{/if}
		{#if plan.shortfall}
			{@const fit = fitText(plan.shortfall)}
			<StickyNote title={fit.title}>
				<span data-plan-fit>{fit.body}</span>
				{#snippet actions()}
					<Button variant="secondary" href={resolve('/planner')}>See the plan</Button>
				{/snippet}
			</StickyNote>
		{/if}
		<SectionHeading title="Your shelf" id="shelf">
			{#snippet action()}
				<Button variant="ghost" href={resolve('/import')}>+ Add</Button>
			{/snippet}
		</SectionHeading>
		<ul class="shelf">
			{#each shelf as course (course.id)}
				<li>
					<a
						class="row"
						href={resolve('/course/[courseId]', { courseId: course.id })}
						style:--book={`var(--course-${course.color})`}
						data-shelf-course={course.name}
					>
						<span class="book" aria-hidden="true"><Icon icon={BookOpen} /></span>
						<span class="text">
							<strong>{course.name}</strong>
							<span class="meta">{shelfLine(course)}</span>
						</span>
						<Icon icon={ArrowRight} />
					</a>
				</li>
			{/each}
		</ul>
		<Row gap="sm">
			<Button variant="secondary" href={resolve('/courses')}>All courses and plans</Button>
		</Row>
	{/if}
	<BottomNav active="den" hrefs={navHrefs} />
</Screen>

<style>
	.date {
		white-space: nowrap;
	}

	.shelf {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li + li {
		border-top: var(--border-dashed) solid var(--decor);
	}

	.row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--gap-md);
		min-height: var(--touch-min);
		padding: var(--gap-sm) 0;
		color: var(--text);
		text-decoration: none;
	}

	.book {
		display: grid;
		place-items: center;
		width: var(--touch-min);
		height: var(--touch-min);
		border-radius: var(--r-sm);
		background: var(--book);
		color: var(--surface);
	}

	.text {
		display: grid;
		gap: var(--gap-2xs);
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.meta {
		color: var(--text-soft);
	}
</style>
