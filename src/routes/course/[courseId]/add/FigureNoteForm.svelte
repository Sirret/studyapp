<!--
	A new picture note in Manual mode (WIP step 9; BUILD_PLAN §7): "Image (hide parts)" takes an
	upload, a photo or a pasted screenshot; "Diagram" takes a name, a kind and its text with a live
	drawing. The caller makes the note and opens its editor; it returns an error line, or null when
	it worked.
-->
<script lang="ts">
	import type { ImageSource } from '#lib/services/import-service.ts';
	import DiagramTextEditor from '#lib/ui/figures/DiagramTextEditor.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import FileButton from '#lib/ui/primitives/FileButton.svelte';
	import Input from '#lib/ui/primitives/Input.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';

	type DiagramInput = { kind: 'stack' | 'flow'; name: string; text: string };

	let {
		type,
		onimage,
		ondiagram
	}: {
		type: 'occlusion' | 'diagram';
		onimage: (source: ImageSource) => Promise<string | null>;
		ondiagram: (input: DiagramInput) => Promise<string | null>;
	} = $props();

	const KINDS = [
		{ value: 'stack', label: 'Layers' },
		{ value: 'flow', label: 'Arrows' }
	] as const;

	let kind = $state<'stack' | 'flow'>('stack');
	let name = $state('');
	let text = $state('');
	let error = $state('');
	let busy = $state(false);

	async function run(task: () => Promise<string | null>): Promise<void> {
		busy = true;
		error = '';
		error = (await task()) ?? '';
		busy = false;
	}

	function pickFile(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) void run(() => onimage({ name: file.name, blob: file }));
	}

	/** A pasted screenshot has no useful name, so it gets one from its type. */
	function paste(event: ClipboardEvent): void {
		if (type !== 'occlusion' || busy) return;
		const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
		if (!file) return;
		event.preventDefault();
		const extension = file.type.split('/')[1] ?? 'png';
		void run(() => onimage({ name: `pasted.${extension}`, blob: file }));
	}

	function makeDiagram(event: SubmitEvent): void {
		event.preventDefault();
		void run(() => ondiagram({ kind, name, text }));
	}
</script>

<svelte:window onpaste={paste} />

{#if type === 'occlusion'}
	<div data-figure-form="occlusion">
		<Stack gap="sm">
			<span class="hint">
				Choose a picture (a slide, a diagram, a photo of the board) or paste a screenshot. You cover
				its labels next.
			</span>
			<Row gap="sm">
				<FileButton
					label="Choose an image"
					accept="image/*"
					disabled={busy}
					onchange={pickFile}
					data-image-file
				/>
				<FileButton
					label="Take a photo"
					accept="image/*"
					capture="environment"
					disabled={busy}
					onchange={pickFile}
				/>
			</Row>
			{#if busy}<p class="hint" role="status">Saving the image…</p>{/if}
			{#if error}<p class="error" role="alert">{error}</p>{/if}
		</Stack>
	</div>
{:else}
	<form onsubmit={makeDiagram} data-figure-form="diagram">
		<Stack gap="md">
			<Input label="Diagram name" bind:value={name} autocomplete="off" data-field="diagram-name" />
			<Segmented label="Kind" options={KINDS} value={kind} onchange={(value) => (kind = value)} />
			<DiagramTextEditor {kind} title={name || 'New diagram'} bind:text />
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<Button type="submit" full loading={busy} disabled={busy} data-make-diagram>
				Make the diagram
			</Button>
		</Stack>
	</form>
{/if}

<style>
	.hint {
		margin: 0;
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}

	.error {
		margin: 0;
		color: var(--wrong);
		font-size: var(--type-small-size);
	}
</style>
