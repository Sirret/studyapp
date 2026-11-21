<!--
	Diagram text editor (BUILD_PLAN §7.2; Decisions log "Phase 6 Q5": text first, no canvas): the
	diagram in the import grammar (`A -> B : label`, or one layer per line for a stack), a live
	drawing of what it reads, and the lines it can't read. Renaming a box from the list keeps its
	ID and so its cards; editing its name in the text makes a new box. The screen saves.
-->
<script lang="ts">
	import { previewDiagram, type DiagramKind } from '#lib/services/figure-edit.ts';
	import Button from '../primitives/Button.svelte';
	import Input from '../primitives/Input.svelte';
	import TextArea from '../primitives/TextArea.svelte';
	import DiagramFigure from './DiagramFigure.svelte';
	import { previewFigure } from './figure-geometry.ts';

	let {
		kind,
		title,
		text = $bindable(),
		nodes = [],
		onrename
	}: {
		kind: DiagramKind;
		title: string;
		text: string;
		/** The saved boxes, for the rename list; empty for a new diagram. */
		nodes?: { id: string; label: string }[];
		onrename?: (nodeId: string, label: string) => void;
	} = $props();

	const uid = $props.id();
	const preview = $derived(previewDiagram(kind, text));
	const figure = $derived(previewFigure(kind, title, preview));
	let names: Record<string, string> = $state({});
	const nameOf = (node: { id: string; label: string }): string => names[node.id] ?? node.label;
</script>

<div class="editor" data-diagram-editor>
	<TextArea
		label={kind === 'stack'
			? 'Layers, top first, one per line'
			: 'Arrows, one per line: A -> B : label'}
		bind:value={text}
		rows={8}
		data-diagram-text
	/>
	{#if preview.errors.length > 0}
		<ul class="errors" aria-label="Lines that could not be read" data-diagram-errors>
			{#each preview.errors as error (error.line)}
				<li>Line {error.line}: {error.message}</li>
			{/each}
		</ul>
	{/if}
	{#if preview.nodes.length > 0}
		<DiagramFigure {figure} />
	{:else}
		<p class="empty">Nothing to draw yet.</p>
	{/if}
	{#if nodes.length > 0 && onrename}
		<section class="rename" aria-labelledby="{uid}-rename">
			<h3 id="{uid}-rename">Rename a box (keeps its cards)</h3>
			{#each nodes as node (node.id)}
				<div class="rename-row" data-rename-node={node.id}>
					<Input
						label="New name for {node.label}"
						hideLabel
						value={nameOf(node)}
						oninput={(event) => (names = { ...names, [node.id]: event.currentTarget.value })}
					/>
					<Button
						variant="secondary"
						paw={false}
						disabled={nameOf(node).trim() === '' || nameOf(node) === node.label}
						onclick={() => onrename(node.id, nameOf(node).trim())}>Rename</Button
					>
				</div>
			{/each}
		</section>
	{/if}
</div>

<style>
	.editor {
		display: grid;
		gap: var(--gap-md);
	}

	.errors {
		margin: 0;
		padding-left: var(--gap-xl);
		color: var(--wrong);
		font-size: var(--type-small-size);
	}

	.empty {
		margin: 0;
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}

	.rename {
		display: grid;
		gap: var(--gap-sm);
	}

	h3 {
		margin: 0;
		color: var(--text-strong);
		font-size: var(--type-body-size);
		font-weight: var(--type-strong-weight);
	}

	.rename-row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		gap: var(--gap-sm);
	}
</style>
