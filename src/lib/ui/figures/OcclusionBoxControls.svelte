<!--
	The selected box's controls in the occlusion editor (BUILD_PLAN §7.1): its label, step buttons
	to move it and make it bigger or smaller (the tap alternative to dragging, CLAUDE.md rule 10),
	and Delete. A box with no label makes no card until it is named.
-->
<script lang="ts">
	import { OCCLUSION_NUDGE } from '#lib/config/defaults.ts';
	import type { OcclusionBox } from '#lib/services/figure-edit.ts';
	import Button from '../primitives/Button.svelte';
	import Input from '../primitives/Input.svelte';

	let {
		box,
		index,
		total,
		onlabel,
		onmove,
		onresize,
		ondelete
	}: {
		box: OcclusionBox;
		index: number;
		total: number;
		onlabel: (label: string) => void;
		onmove: (dx: number, dy: number) => void;
		onresize: (step: number) => void;
		ondelete: () => void;
	} = $props();

	const n = OCCLUSION_NUDGE;
	const MOVES = [
		{ label: 'Move left', text: '←', dx: -n, dy: 0 },
		{ label: 'Move up', text: '↑', dx: 0, dy: -n },
		{ label: 'Move down', text: '↓', dx: 0, dy: n },
		{ label: 'Move right', text: '→', dx: n, dy: 0 }
	] as const;
</script>

<section class="controls" aria-label="Box {index + 1} of {total}" data-box-controls>
	<span class="count">Box {index + 1} of {total}</span>
	<Input
		label="What this box hides"
		value={box.label}
		oninput={(event) => onlabel(event.currentTarget.value)}
		placeholder="Type the hidden word"
		data-box-label
	/>
	{#if box.label.trim() === ''}
		<p class="note">Name it to make a card.</p>
	{/if}
	<div class="steps">
		{#each MOVES as step (step.label)}
			<Button
				variant="secondary"
				size="icon"
				paw={false}
				aria-label={step.label}
				onclick={() => onmove(step.dx, step.dy)}>{step.text}</Button
			>
		{/each}
		<Button
			variant="secondary"
			size="icon"
			paw={false}
			aria-label="Smaller"
			onclick={() => onresize(-n)}>−</Button
		>
		<Button
			variant="secondary"
			size="icon"
			paw={false}
			aria-label="Bigger"
			onclick={() => onresize(n)}>+</Button
		>
	</div>
	<Button variant="danger" onclick={ondelete} data-box-delete>Delete box</Button>
</section>

<style>
	.controls {
		display: grid;
		gap: var(--gap-sm);
		padding: var(--gap-md);
		border: var(--hairline) solid var(--line);
		border-radius: var(--r-sm);
		background: var(--surface);
	}

	.count {
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		text-transform: uppercase;
		letter-spacing: var(--type-label-tracking);
	}

	.note {
		margin: 0;
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}

	.steps {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-xs);
	}
</style>
