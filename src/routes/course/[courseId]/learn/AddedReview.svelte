<!--
	"Added by the chatbot, check these" (Decisions log "Phase 8.6 Q13"): the sections the chatbot
	added on its own, shown last in a topic, each with its notes and a keep / delete choice per
	note. Delete goes through CardListService (a tombstone, like the card list's Delete); keep just
	leaves it. Then the flow carries on.
-->
<script lang="ts">
	import type { NoteId } from '#lib/db/schemas/common.ts';
	import type { AddedSectionView } from '#lib/services/learn-types.ts';
	import Banner from '#lib/ui/components/Banner.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Card from '#lib/ui/primitives/Card.svelte';

	let {
		sections,
		next,
		nextLabel
	}: { sections: AddedSectionView[]; next: () => void; nextLabel: string } = $props();

	let decided = $state<Record<string, 'kept' | 'deleted'>>({});

	async function remove(noteId: NoteId): Promise<void> {
		const { cardListService } = await import('#lib/services/study-wiring.ts');
		await cardListService.deleteNote(noteId);
		decided[noteId] = 'deleted';
	}
</script>

<Stack gap="md">
	<h2 class="title">Added by the chatbot, check these</h2>
	<Banner tone="warning">
		The chatbot wrote these sections itself. Keep what your course covers; delete the rest.
	</Banner>
	{#each sections as section (section.chunkId)}
		<Card>
			<Stack gap="sm">
				{#if section.title}<h3 class="section">{section.title}</h3>{/if}
				<p class="text">{section.text}</p>
				{#each section.notes as note (note.noteId)}
					<div class="note" data-added-note={note.noteId}>
						<span class="name">{note.title}</span>
						{#if decided[note.noteId]}
							<span class="meta">{decided[note.noteId] === 'kept' ? 'Kept' : 'Deleted'}</span>
						{:else}
							<Row gap="xs">
								<Button variant="secondary" onclick={() => (decided[note.noteId] = 'kept')}
									>Keep</Button
								>
								<Button variant="ghost" onclick={() => remove(note.noteId)}>Delete</Button>
							</Row>
						{/if}
					</div>
				{/each}
			</Stack>
		</Card>
	{/each}
	<Button full size="session" onclick={next} data-learn-next>{nextLabel}</Button>
</Stack>

<style>
	.title,
	.section,
	.text {
		margin: 0;
	}

	.title {
		font-family: var(--font-display);
		font-size: var(--type-title-size);
		line-height: var(--type-title-leading);
	}

	.section {
		font-size: var(--type-body-size);
	}

	.note {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap-sm);
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.meta {
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		letter-spacing: var(--type-label-tracking);
	}
</style>
