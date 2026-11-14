<!--
	Edits one note as text boxes (BUILD_PLAN §10 row 8.5). Saving keeps the cards' IDs and history
	(rule 7); the caller saves and returns an error line, or null when it worked.
-->
<script lang="ts">
	import type { CardListRow } from '#lib/services/card-list-types.ts';
	import { toEditFields } from '#lib/services/note-edit.ts';
	import Row from '../layout/Row.svelte';
	import Stack from '../layout/Stack.svelte';
	import Button from '../primitives/Button.svelte';
	import Card from '../primitives/Card.svelte';
	import Input from '../primitives/Input.svelte';
	import TextArea from '../primitives/TextArea.svelte';

	interface Props {
		row: CardListRow;
		onsave: (values: Record<string, string>) => Promise<string | null>;
		oncancel: () => void;
	}

	let { row, onsave, oncancel }: Props = $props();

	// The editor is remounted per note, so reading the row once is right.
	// svelte-ignore state_referenced_locally
	const fields = toEditFields(row.content) ?? [];
	let values = $state<Record<string, string>>(
		Object.fromEntries(fields.map((field) => [field.key, field.value]))
	);
	let error = $state('');
	let busy = $state(false);

	async function save(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		busy = true;
		error = (await onsave({ ...values })) ?? '';
		busy = false;
	}
</script>

<Card tag="section" label="Edit card">
	<form onsubmit={save}>
		<Stack gap="md">
			{#each fields as field (field.key)}
				<Stack gap="xs">
					{#if field.multiline}
						<TextArea label={field.label} bind:value={values[field.key]} rows={4} />
					{:else}
						<Input label={field.label} bind:value={values[field.key]} />
					{/if}
					{#if field.hint}<span class="hint">{field.hint}</span>{/if}
				</Stack>
			{/each}
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<Row gap="sm">
				<Button type="submit" loading={busy} disabled={busy}>Save</Button>
				<Button variant="ghost" onclick={oncancel}>Cancel</Button>
			</Row>
		</Stack>
	</form>
</Card>

<style>
	.hint {
		color: var(--text-muted);
		font-size: var(--type-small-size);
	}

	.error {
		margin: 0;
		color: var(--error);
		font-size: var(--type-small-size);
	}
</style>
