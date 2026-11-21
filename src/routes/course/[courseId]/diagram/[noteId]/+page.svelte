<!--
	The diagram editor screen (BUILD_PLAN §7.2; Decisions log "Phase 6 Q5": text first): the diagram
	in the import grammar with a live drawing and per-line errors. Saving keeps node IDs by label
	and arrow IDs by (from, to), so unchanged parts keep their cards; the rename list keeps a box's
	ID. The services load lazily (CLAUDE.md rule 9).
-->
<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { NoteId } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { DiagramDoc, DiagramSaveError } from '#lib/services/figure-wiring.ts';
	import type { Result } from '#lib/util/result.ts';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import Hero from '#lib/ui/components/Hero.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import DiagramTextEditor from '#lib/ui/figures/DiagramTextEditor.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import { countOf } from '#lib/util/plural.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const noteId = $derived(data.noteId as NoteId);
	const cardsHref = $derived(
		`${resolve('/course/[courseId]/cards', { courseId: data.courseId })}?note=${data.noteId}`
	);

	let doc = $state.raw<DiagramDoc | null>(null);
	let missing = $state(false);
	let text = $state('');
	let busy = $state(false);
	let message = $state('');
	let error = $state('');

	const service = async () => (await import('#lib/services/figure-wiring.ts')).diagramService;

	async function reload(): Promise<void> {
		try {
			const loaded = await (await service()).load(noteId);
			if (!loaded) return void (missing = true);
			doc = loaded;
			text = loaded.text;
		} catch (cause) {
			logger.error('diagram', 'editor not loaded', { error: String(cause) });
			missing = true;
		}
	}

	$effect(() => {
		void reload();
	});

	/** The save's outcome; unreadable lines are already listed under the text box. */
	function report(saved: Result<{ cards: number }, DiagramSaveError>): void {
		if (saved.ok) message = `Saved: ${countOf(saved.value.cards, 'card')}.`;
		else error = saved.error.message;
	}

	async function save(): Promise<void> {
		busy = true;
		message = '';
		error = '';
		const saved = await (await service()).saveText(noteId, text);
		busy = false;
		report(saved);
		if (saved.ok) await reload();
	}

	async function rename(nodeId: string, label: string): Promise<void> {
		message = '';
		error = '';
		const saved = await (await service()).rename(noteId, nodeId, label);
		report(saved);
		if (saved.ok) await reload();
	}
</script>

<svelte:head><title>Edit diagram</title></svelte:head>

<Screen>
	{#snippet top()}
		<TopBar title="Edit diagram">
			{#snippet leading()}
				<Button variant="ghost" size="icon" href={cardsHref} aria-label="Back to the cards">
					<Icon icon={ArrowLeft} size="nav" />
				</Button>
			{/snippet}
		</TopBar>
	{/snippet}

	{#if missing}
		<StickyNote title="This diagram can't be opened">
			It may have been deleted. Your other cards are safe.
			{#snippet actions()}<Button href={cardsHref}>All cards</Button>{/snippet}
		</StickyNote>
	{:else if doc === null}
		<EmptyState message="Opening the diagram…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else}
		<Stack gap="md">
			<Hero
				title={doc.name}
				subline="Edit the text; the drawing follows. Rename a box from the list to keep its cards."
			/>
			<DiagramTextEditor
				kind={doc.kind}
				title={doc.name}
				bind:text
				nodes={doc.nodes}
				onrename={(nodeId, label) => void rename(nodeId, label)}
			/>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			{#if message}<p class="saved" role="status" data-figure-saved>{message}</p>{/if}
			<Button full loading={busy} disabled={busy} onclick={save} data-figure-save>Save</Button>
			<Button full variant="ghost" href={cardsHref}>Done</Button>
		</Stack>
	{/if}
</Screen>

<style>
	.error,
	.saved {
		margin: 0;
		font-size: var(--type-small-size);
	}

	.error {
		color: var(--wrong);
	}

	.saved {
		color: var(--text-soft);
	}
</style>
