<!--
	One new card note (Manual mode; Decisions log "Phase 8.6 Q15"): a type picker, then the card
	editor's own boxes for that type (`note-edit.ts`). A fact is a term with a definition whose key
	words are ticked, or a list of items (one per line). The caller saves the content and returns an
	error line, or null when it worked; the form then clears for the next card. The picture types
	(image, diagram) use FigureNoteForm and open their editor once made.
-->
<script lang="ts">
	import type { ImageSource } from '#lib/services/import-service.ts';
	import {
		blankFields,
		isFigureType,
		MANUAL_FIGURE_TYPES,
		MANUAL_TYPES,
		manualFact,
		type ManualType,
		type NoteContent
	} from '#lib/services/manual-fields.ts';
	import { fromEditFields } from '#lib/services/note-edit.ts';
	import KeyWordTicks from '#lib/ui/components/KeyWordTicks.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Input from '#lib/ui/primitives/Input.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextArea from '#lib/ui/primitives/TextArea.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import FigureNoteForm from './FigureNoteForm.svelte';

	let {
		onsave,
		onimage,
		ondiagram
	}: {
		onsave: (content: NoteContent) => Promise<string | null>;
		onimage: (source: ImageSource) => Promise<string | null>;
		ondiagram: (input: {
			kind: 'stack' | 'flow';
			name: string;
			text: string;
		}) => Promise<string | null>;
	} = $props();

	const TYPES = [...MANUAL_TYPES, ...MANUAL_FIGURE_TYPES];
	let type = $state<ManualType>('fact');
	const fieldsOf = (t: ManualType) => (isFigureType(t) ? [] : blankFields(t));
	const fields = $derived(fieldsOf(type));
	/** Every box of the type starts empty (a fact also has `term` and `definition`). */
	const emptyValues = (): Record<string, string> =>
		Object.fromEntries([
			...fieldsOf(type).map((f) => [f.key, '']),
			['term', ''],
			['definition', '']
		]);
	let values = $state<Record<string, string>>(emptyValues());
	let list = $state(false);
	let items = $state('');
	let ticked = $state<number[]>([]);
	let error = $state('');
	let busy = $state(false);

	function clear(): void {
		values = emptyValues();
		items = '';
		ticked = [];
		error = '';
	}

	function read() {
		if (isFigureType(type)) return { ok: false as const, error: 'Pick a text card type.' };
		if (type !== 'fact') {
			const boxes = Object.fromEntries(fields.map((f) => [f.key, values[f.key] ?? '']));
			return fromEditFields(type, boxes);
		}
		const term = values.term ?? '';
		return list
			? manualFact({ kind: 'list', term, items: items.split(/\r?\n/) })
			: manualFact({
					kind: 'definition',
					term,
					definition: values.definition ?? '',
					ticked: new Set(ticked)
				});
	}

	async function save(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const content = read();
		if (!content.ok) {
			error = content.error;
			return;
		}
		busy = true;
		const failed = await onsave(content.value);
		busy = false;
		if (failed) error = failed;
		else clear();
	}
</script>

<Stack gap="md">
	<Select label="Card type" options={TYPES} bind:value={type} onchange={clear} />
	{#if isFigureType(type)}
		<FigureNoteForm {type} {onimage} {ondiagram} />
	{:else}
		<form onsubmit={save} data-note-form>
			<Stack gap="md">
				{#if type === 'fact'}
					<Input label="Term" bind:value={values.term} autocomplete="off" data-field="term" />
					<Toggle label="It's a list" bind:checked={list} />
					{#if list}
						<Stack gap="xs">
							<TextArea label="Items" bind:value={items} rows={4} data-field="items" />
							<span class="hint"
								>One item per line. Lists are asked whole, or as "name N of M".</span
							>
						</Stack>
					{:else}
						<TextArea
							label="Definition"
							bind:value={values.definition}
							rows={3}
							data-field="definition"
						/>
						<Stack gap="xs">
							<span class="label">Key words</span>
							<span class="hint">Tick the words a typed answer must contain.</span>
							<KeyWordTicks definition={values.definition ?? ''} bind:ticked />
						</Stack>
					{/if}
				{:else}
					{#each fields as field (field.key)}
						<Stack gap="xs">
							{#if field.multiline}
								<TextArea
									label={field.label}
									bind:value={values[field.key]}
									rows={4}
									data-field={field.key}
								/>
							{:else}
								<Input
									label={field.label}
									bind:value={values[field.key]}
									autocomplete="off"
									data-field={field.key}
								/>
							{/if}
							{#if field.hint}<span class="hint">{field.hint}</span>{/if}
						</Stack>
					{/each}
				{/if}
				{#if error}<p class="error" role="alert">{error}</p>{/if}
				<Button type="submit" full loading={busy} disabled={busy} data-save-note
					>Add this card</Button
				>
			</Stack>
		</form>
	{/if}
</Stack>

<style>
	.label {
		color: var(--text-soft);
		font-size: var(--type-small-size);
		font-weight: var(--type-small-weight);
	}

	.hint {
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}

	.error {
		margin: 0;
		color: var(--wrong);
		font-size: var(--type-small-size);
	}
</style>
