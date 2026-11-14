<!--
	One note in the "See all cards" list (BUILD_PLAN §10 row 8.5): the question and answer in plain
	words, its cards' statuses, flags, and the fix actions. Editing happens in NoteEditor.
-->
<script lang="ts">
	import type { CardStatus } from '#lib/db/schemas/common.ts';
	import type { CardListRow } from '#lib/services/card-list-types.ts';
	import StatusBadge from '../components/StatusBadge.svelte';
	import Row from '../layout/Row.svelte';
	import Stack from '../layout/Stack.svelte';
	import Button from '../primitives/Button.svelte';
	import Card from '../primitives/Card.svelte';

	interface Props {
		row: CardListRow;
		/** Opened from a link to this row (e.g. an unsure card after an import). */
		highlighted?: boolean;
		onedit: () => void;
		onflag: () => void;
		onunflag: () => void;
		ondelete: () => void;
	}

	let { row, highlighted = false, onedit, onflag, onunflag, ondelete }: Props = $props();

	const statuses = $derived([...new Set<CardStatus>(row.cards.map((card) => card.status))]);
	const paused = $derived(row.cards.some((card) => card.suspended));
	const editable = $derived(row.type !== 'diagram' && row.type !== 'occlusion');
</script>

<div class="row" class:highlighted data-note-id={row.noteId}>
	<Card tag="article" label={row.prompt}>
		<Stack gap="sm">
			<Stack gap="xs">
				<strong class="prompt">{row.prompt}</strong>
				<span class="answer">{row.answer}</span>
			</Stack>
			<Row gap="sm">
				{#each statuses as status (status)}<StatusBadge {status} />{/each}
				{#if row.flagged}<span class="flag">Check this</span>{/if}
				{#if paused}<span class="flag">Paused</span>{/if}
				{#if row.generated}<span class="note">Added by the chatbot</span>{/if}
			</Row>
			<Row gap="sm">
				{#if editable}
					<Button variant="secondary" onclick={onedit}>Edit</Button>
				{/if}
				{#if row.flagged}
					<Button variant="ghost" onclick={onunflag}>It's fine</Button>
				{:else}
					<Button variant="ghost" onclick={onflag}>Looks wrong</Button>
				{/if}
				<Button variant="danger" onclick={ondelete}>Delete</Button>
			</Row>
			{#if !editable}
				<span class="note">Image cards are fixed in the diagram editor.</span>
			{/if}
		</Stack>
	</Card>
</div>

<style>
	.row {
		border-radius: var(--r-lg);
	}

	.highlighted {
		outline: var(--stroke) solid var(--primary);
		outline-offset: var(--focus-offset);
	}

	.prompt {
		font-size: var(--type-body-size);
		overflow-wrap: anywhere;
	}

	.answer,
	.note {
		color: var(--text-muted);
		font-size: var(--type-small-size);
		overflow-wrap: anywhere;
	}

	.flag {
		display: inline-flex;
		align-items: center;
		min-height: var(--chip-height);
		padding: 0 var(--gap-sm);
		border-radius: var(--r-pill);
		background: var(--warning-soft);
		color: var(--text);
		font-size: var(--type-caption-size);
		font-weight: var(--type-strong-weight);
	}
</style>
