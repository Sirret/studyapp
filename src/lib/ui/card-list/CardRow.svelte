<!--
	One note in the "See all cards" list (BUILD_PLAN §10 row 8.5): the question and answer in plain
	words, its cards' statuses, flags (DESIGN §7 Stamps), and the fix actions. Editing happens in
	NoteEditor.
-->
<script lang="ts">
	import type { CardStatus } from '#lib/db/schemas/common.ts';
	import type { CardListRow } from '#lib/services/card-list-types.ts';
	import Stamp from '../components/Stamp.svelte';
	import StatusBadge from '../components/StatusBadge.svelte';
	import Row from '../layout/Row.svelte';
	import Stack from '../layout/Stack.svelte';
	import Button from '../primitives/Button.svelte';
	import Card from '../primitives/Card.svelte';

	interface Props {
		row: CardListRow;
		/** Opened from a link to this row (e.g. an unsure card after an import). */
		highlighted?: boolean;
		/** The image or diagram editor for this note (`CardListService.editorHref`); null for text notes. */
		editorHref?: string | null;
		onedit: () => void;
		onflag: () => void;
		onunflag: () => void;
		ondelete: () => void;
	}

	let {
		row,
		highlighted = false,
		editorHref = null,
		onedit,
		onflag,
		onunflag,
		ondelete
	}: Props = $props();

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
				{#if row.flagged}<Stamp text="Check this" />{/if}
				{#if paused}<Stamp text="Paused" dashed />{/if}
				{#if row.generated}<Stamp text="Added by the chatbot" dashed />{/if}
			</Row>
			<Row gap="sm">
				{#if editable}
					<Button variant="secondary" onclick={onedit}>Edit</Button>
				{:else if editorHref}
					<Button variant="secondary" href={editorHref} data-edit-in-editor>Edit in editor</Button>
				{/if}
				{#if row.flagged}
					<Button variant="ghost" onclick={onunflag}>It's fine</Button>
				{:else}
					<Button variant="ghost" onclick={onflag}>Looks wrong</Button>
				{/if}
				<Button variant="danger" onclick={ondelete}>Delete</Button>
			</Row>
		</Stack>
	</Card>
</div>

<style>
	.row {
		border-radius: var(--r-md);
	}

	.highlighted {
		outline: var(--stroke) solid var(--accent);
		outline-offset: var(--focus-offset);
	}

	.prompt {
		color: var(--text-strong);
		font-family: var(--font-body);
		font-size: var(--type-body-size);
		overflow-wrap: anywhere;
	}

	.answer {
		color: var(--text-soft);
		font-size: var(--type-small-size);
		overflow-wrap: anywhere;
	}
</style>
