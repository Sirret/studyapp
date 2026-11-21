<!--
	Occlusion figure (BUILD_PLAN §7.1): the image with its hide boxes laid over it. Boxes are placed
	as percentages of the image, so they scale with it. With `onbox` every drawn box is a button
	named for screen readers (the tap alternative to dragging); otherwise they are plain covers.
	`frame` is the image's box, which the place exercise and the editor read for pointer positions.
	The image's `alt` is its title.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { percentRect, type ShownBox } from './figure-geometry.ts';

	let {
		src,
		title,
		boxes,
		onbox,
		frame = $bindable(),
		overlay
	}: {
		/** The image URL; null while loading or when the image is gone. */
		src: string | null;
		title: string;
		boxes: ShownBox[];
		onbox?: (id: string) => void;
		frame?: HTMLDivElement;
		/** Extra layers over the image (drop marker, drawing rectangle, handles). */
		overlay?: Snippet;
	} = $props();

	let missing = $state(false);
	const drawn = $derived(boxes.filter((b) => b.look !== 'open' || onbox));
</script>

<div class="frame" bind:this={frame} data-figure="occlusion">
	{#if src && !missing}
		<img {src} alt={title} draggable="false" onerror={() => (missing = true)} />
	{:else}
		<div class="placeholder" role="img" aria-label={title}>
			{src === null && !missing ? 'Loading image…' : 'Image not found'}
		</div>
	{/if}
	{#each drawn as box (box.id)}
		{@const r = percentRect(box)}
		{#if onbox}
			<button
				type="button"
				class="box {box.look}"
				style:left={r.left}
				style:top={r.top}
				style:width={r.width}
				style:height={r.height}
				aria-label={box.name}
				aria-pressed={box.look === 'selected' || box.look === 'active'}
				data-box-id={box.id}
				data-box-look={box.look}
				onclick={() => onbox(box.id)}
			>
				{#if box.text}<span class="text">{box.text}</span>{/if}
			</button>
		{:else}
			<div
				class="box {box.look}"
				style:left={r.left}
				style:top={r.top}
				style:width={r.width}
				style:height={r.height}
				data-box-id={box.id}
				data-box-look={box.look}
			>
				{#if box.text}<span class="text">{box.text}</span>{/if}
			</div>
		{/if}
	{/each}
	{#if overlay}{@render overlay()}{/if}
</div>

<style>
	.frame {
		position: relative;
		width: 100%;
		border: var(--hairline) solid var(--line);
		border-radius: var(--r-sm);
		overflow: hidden;
		background: var(--surface-sunk);
		user-select: none;
		-webkit-user-select: none;
	}

	img {
		display: block;
		width: 100%;
		height: auto;
		-webkit-user-drag: none;
	}

	.placeholder {
		display: grid;
		place-items: center;
		min-height: var(--size-px-260);
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}

	.box {
		position: absolute;
		display: grid;
		place-items: center;
		margin: 0;
		padding: 0;
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-xs);
		background: var(--surface-sunk);
		color: var(--text-strong);
		font: inherit;
		overflow: hidden;
	}

	button.box {
		cursor: pointer;
		touch-action: manipulation;
	}

	.box:focus-visible {
		outline: var(--focus-width) solid var(--accent);
		outline-offset: var(--focus-offset);
	}

	.open {
		border-style: dashed;
		border-color: var(--line-strong);
		background: transparent;
	}

	.target {
		border-color: var(--accent);
		background: var(--frost);
		color: var(--on-light-fill);
	}

	.selected {
		border-color: var(--accent);
		background: var(--surface);
	}

	.correct {
		border-color: var(--correct);
		background: var(--surface);
	}

	.wrong {
		border-color: var(--wrong);
		background: var(--surface);
	}

	.revealed {
		border-style: dashed;
		border-color: var(--correct);
		background: var(--surface);
	}

	.editing {
		border-style: dashed;
		border-color: var(--accent);
		background: transparent;
	}

	.active {
		border-color: var(--accent);
		border-width: var(--stroke-strong);
		background: transparent;
	}

	.editing .text,
	.active .text {
		background: var(--surface);
		border-radius: var(--r-xs);
	}

	.text {
		padding: 0 var(--gap-2xs);
		font-size: var(--type-small-size);
		font-weight: var(--type-strong-weight);
		line-height: var(--leading-110);
		text-align: center;
		overflow-wrap: anywhere;
	}
</style>
