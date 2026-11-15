<!--
	"See all cards" (BUILD_PLAN §10 row 8.5): every note of a course by topic, searchable, fixable
	in place. Reskin (DESIGN §12 "Browse & edit"): Courier breadcrumb + back arrow, Hero title,
	SectionHeading per topic, Stamps for flags.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import type { CourseId, NoteId } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { CardListFilter, CardListRow, CardListView } from '#lib/services/card-list-types.ts';
	import { filterCardList } from '#lib/services/card-list.ts';
	import { fromEditFields, type EditableType } from '#lib/services/note-edit.ts';
	import { ArrowLeft } from '@lucide/svelte';
	import CardRow from '#lib/ui/card-list/CardRow.svelte';
	import NoteEditor from '#lib/ui/card-list/NoteEditor.svelte';
	import TopicGroup from '#lib/ui/card-list/TopicGroup.svelte';
	import ConfirmDialog from '#lib/ui/components/ConfirmDialog.svelte';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import Hero from '#lib/ui/components/Hero.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import Input from '#lib/ui/primitives/Input.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const courseId = $derived(data.courseId as CourseId);

	let view = $state<CardListView | null>(null);
	let failed = $state(false);
	let query = $state('');
	// The starting filter comes from the link.
	// svelte-ignore state_referenced_locally
	let filter = $state<CardListFilter>(data.filter === 'flagged' ? 'flagged' : 'all');
	let editing = $state<NoteId | null>(null);
	let deleting = $state<CardListRow | null>(null);
	let deleteOpen = $state(false);
	let busy = $state(false);

	const shown = $derived(view ? filterCardList(view, query, filter) : null);
	const filters = $derived([
		{ value: 'all', label: `All ${view?.total ?? ''}`.trim() },
		{ value: 'flagged', label: `Check these ${view?.flagged ?? ''}`.trim() },
		{ value: 'paused', label: 'Paused' }
	] as const);

	async function service() {
		return (await import('#lib/services/study-wiring.ts')).cardListService;
	}

	async function refresh(): Promise<void> {
		try {
			view = await (await service()).list(courseId);
		} catch (error: unknown) {
			logger.error('cards', 'list not loaded', { error: String(error) });
			failed = true;
		}
	}

	$effect(() => {
		void refresh().then(async () => {
			if (!data.note) return;
			await tick();
			document.querySelector(`[data-note-id="${CSS.escape(data.note)}"]`)?.scrollIntoView();
		});
	});

	async function save(row: CardListRow, values: Record<string, string>): Promise<string | null> {
		const parsed = fromEditFields(row.type as EditableType, values);
		if (!parsed.ok) return parsed.error;
		const saved = await (await service()).editNote(row.noteId, parsed.value);
		if (!saved.ok) return saved.error;
		editing = null;
		await refresh();
		return null;
	}

	async function act(which: 'flag' | 'unflag', noteId: NoteId): Promise<void> {
		await (await service())[which](noteId);
		await refresh();
	}

	async function confirmDelete(): Promise<void> {
		if (!deleting) return;
		busy = true;
		await (await service()).deleteNote(deleting.noteId);
		deleteOpen = false;
		busy = false;
		await refresh();
	}
</script>

<svelte:head><title>All cards · {view?.courseName ?? 'Course'}</title></svelte:head>

<Screen>
	{#snippet top()}
		<TopBar title={view ? `${view.courseName} · Cards` : 'Cards'}>
			{#snippet leading()}
				<Button
					variant="ghost"
					size="icon"
					href={resolve('/course/[courseId]', { courseId })}
					aria-label="Back to the course"
				>
					<Icon icon={ArrowLeft} size="nav" />
				</Button>
			{/snippet}
		</TopBar>
	{/snippet}

	{#if failed}
		<StickyNote title="The cards didn't load">
			Reload the page to try again. Nothing was lost.
			{#snippet actions()}<Button onclick={() => location.reload()}>Reload</Button>{/snippet}
		</StickyNote>
	{:else if view === null || shown === null}
		<EmptyState message="Loading the cards…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else if view.total === 0}
		<EmptyState message="This course has no cards yet.">
			{#snippet action()}<Button href={resolve('/import')}>Import your notes</Button>{/snippet}
		</EmptyState>
	{:else}
		<Hero title="All cards" subline="Fix a card in place; its history stays." />
		<Stack gap="sm">
			<Input label="Search cards" type="search" bind:value={query} />
			<Segmented
				label="Show"
				options={filters}
				value={filter}
				onchange={(value) => (filter = value)}
			/>
		</Stack>
		{#if shown.topics.length === 0}
			<EmptyState
				message={filter === 'flagged' && query === ''
					? 'Nothing to check. Every card looks fine.'
					: 'No cards match.'}
				companion={false}
			/>
		{/if}
		{#each shown.topics as topic (topic.id)}
			<TopicGroup name={topic.name} count={topic.rows.length}>
				{#each topic.rows as row (row.noteId)}
					{#if editing === row.noteId}
						<NoteEditor
							{row}
							onsave={(values) => save(row, values)}
							oncancel={() => (editing = null)}
						/>
					{:else}
						<CardRow
							{row}
							highlighted={row.noteId === data.note}
							onedit={() => (editing = row.noteId)}
							onflag={() => act('flag', row.noteId)}
							onunflag={() => act('unflag', row.noteId)}
							ondelete={() => {
								deleting = row;
								deleteOpen = true;
							}}
						/>
					{/if}
				{/each}
			</TopicGroup>
		{/each}
	{/if}

	<ConfirmDialog
		bind:open={deleteOpen}
		title="Delete this card?"
		confirmLabel="Delete"
		{busy}
		onconfirm={confirmDelete}
	>
		"{deleting?.prompt}" and its cards leave your study plan. Your past answers stay in your
		history.
	</ConfirmDialog>
</Screen>
