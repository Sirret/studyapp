<!--
	The occlusion editor screen (BUILD_PLAN §7.1; CONCEPT §13): opens an image note, lets the student
	draw, move, resize and name hide boxes (or tap-place the labels the import couldn't place), and
	saves them. Card IDs follow box IDs, so editing a box keeps its history. The services load
	lazily (CLAUDE.md rule 9).
-->
<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { NoteId } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { OcclusionDoc, OcclusionEdit } from '#lib/services/figure-wiring.ts';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import Hero from '#lib/ui/components/Hero.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import { createMediaUrl } from '#lib/ui/figures/media-url.ts';
	import OcclusionEditor from '#lib/ui/figures/OcclusionEditor.svelte';
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

	let doc = $state.raw<OcclusionDoc | null>(null);
	let missing = $state(false);
	let src = $state<string | null>(null);
	let edit = $state<OcclusionEdit>({ boxes: [], unplaced: [], hide: 'one', title: '' });
	let busy = $state(false);
	let message = $state('');
	let error = $state('');

	const wiring = () => import('#lib/services/figure-wiring.ts');

	$effect(() => {
		let release: (() => void) | null = null;
		let live = true;
		void (async () => {
			try {
				const loaded = await (await wiring()).occlusionService.load(noteId);
				if (!live) return;
				if (!loaded) return void (missing = true);
				const media = createMediaUrl(loaded.image.blob);
				release = media.revoke;
				doc = loaded;
				edit = structuredClone(loaded.edit);
				src = media.url;
			} catch (cause) {
				logger.error('occlusion', 'editor not loaded', { error: String(cause) });
				missing = true;
			}
		})();
		return () => {
			live = false;
			release?.();
		};
	});

	async function save(): Promise<void> {
		busy = true;
		message = '';
		error = '';
		const saved = await (await wiring()).occlusionService.save(noteId, $state.snapshot(edit));
		busy = false;
		if (saved.ok) message = `Saved: ${countOf(saved.value.cards, 'card')}.`;
		else error = saved.error;
	}
</script>

<svelte:head><title>Edit image</title></svelte:head>

<Screen>
	{#snippet top()}
		<TopBar title="Edit image">
			{#snippet leading()}
				<Button variant="ghost" size="icon" href={cardsHref} aria-label="Back to the cards">
					<Icon icon={ArrowLeft} size="nav" />
				</Button>
			{/snippet}
		</TopBar>
	{/snippet}

	{#if missing}
		<StickyNote title="This image can't be opened">
			It may have been deleted. Your other cards are safe.
			{#snippet actions()}<Button href={cardsHref}>All cards</Button>{/snippet}
		</StickyNote>
	{:else if doc === null}
		<EmptyState message="Opening the image…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else}
		<Stack gap="md">
			<Hero
				title={edit.title || doc.image.fileName || 'Image'}
				subline="Cover each label with a box and name it. Each named box is one card."
			/>
			<OcclusionEditor
				{src}
				fileName={doc.image.fileName ?? 'Image'}
				bind:edit
				newId={() => crypto.randomUUID()}
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
