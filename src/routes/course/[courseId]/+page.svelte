<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { APP_SHORT_NAME } from '#lib/config/defaults.ts';
	import type { CourseId } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { CourseToday } from '#lib/services/course-types.ts';
	import type { LastImportView } from '#lib/services/import-undo.ts';
	import type { LearnTopicView } from '#lib/services/learn-types.ts';
	import type { ScopeView } from '#lib/services/scope-service.ts';
	import UndoImport from '#lib/ui/card-list/UndoImport.svelte';
	import Banner from '#lib/ui/components/Banner.svelte';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import Hero from '#lib/ui/components/Hero.svelte';
	import ModeDoor from '#lib/ui/components/ModeDoor.svelte';
	import ModeDoorRow from '#lib/ui/components/ModeDoorRow.svelte';
	import Stamp from '#lib/ui/components/Stamp.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import CourseMapPanel from '#lib/ui/course-map/CourseMapPanel.svelte';
	import { courseDoors, type DoorAction } from '#lib/ui/course-map/doors.ts';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import BottomNav from '#lib/ui/layout/BottomNav.svelte';
	import { bottomNavHrefs } from '#lib/ui/layout/nav-hrefs.ts';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Sidebar from '#lib/ui/layout/Sidebar.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import { countOf } from '#lib/util/plural.ts';
	import ScopeSheet from './ScopeSheet.svelte';
	import TopicList from './TopicList.svelte';
	import type { PageProps } from './$types';

	/**
	 * The course page: pick what to study (scope), then a mode door — Learn, Practice, Exam prep,
	 * Play (disabled) — then the topic checklist, the cards, the last import and the course map.
	 * @see SESSION_NOTES C, J; DESIGN §12 Course, Pick what to study
	 */
	let { data }: PageProps = $props();
	const navHrefs = bottomNavHrefs();
	const courseId = $derived(data.courseId as CourseId);

	let today = $state<CourseToday | null>(null);
	let topics = $state<LearnTopicView[]>([]);
	let scope = $state<ScopeView | null>(null);
	let failed = $state(false);
	let lastImport = $state<LastImportView | null>(null);
	let undoing = $state(false);
	let notice = $state('');

	async function refresh(): Promise<void> {
		try {
			const wiring = await import('#lib/services/study-wiring.ts');
			[today, topics, scope, lastImport] = await Promise.all([
				wiring.coursePlanService.today(courseId),
				wiring.learnService.topics(courseId),
				wiring.scopeService.view(courseId),
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

	/** A door's link; Play has none. */
	function doorHref(action: DoorAction): string | undefined {
		switch (action.kind) {
			case 'learn':
				return resolve('/course/[courseId]/learn', { courseId });
			case 'practice':
				return resolve('/course/[courseId]/practice', { courseId });
			case 'exam':
				return resolve('/course/[courseId]/exam', { courseId });
			case 'none':
				return undefined;
		}
	}

	const sections = $derived(topics.reduce((sum, topic) => sum + topic.sections, 0));
</script>

<svelte:head><title>{today?.course.name ?? 'Course'}</title></svelte:head>

<Screen nav>
	{#snippet side()}<Sidebar active="shelf" hrefs={navHrefs} yuki={false} />{/snippet}
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
	{:else if today === null || scope === null}
		<EmptyState message="Loading the course…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else}
		<Hero
			eyebrow="Course · {countOf(scope.of, 'topic')} · {countOf(sections, 'section')}"
			title={today.course.name}
		/>
		<ScopeSheet {courseId} view={scope} onsaved={refresh} />
		<ModeDoorRow>
			{#each courseDoors(today, topics) as door (door.mode)}
				<ModeDoor
					mode={door.mode}
					hint={door.hint}
					hasWork={door.hasWork}
					disabled={door.disabled}
					href={doorHref(door.action)}
				/>
			{/each}
		</ModeDoorRow>
		<TopicList {courseId} {topics} />
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
	{/if}
	<BottomNav active="shelf" hrefs={navHrefs} />
</Screen>
