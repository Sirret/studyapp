<!--
	Place a label (occlusionDrag; BUILD_PLAN §7.1): every box is covered. Drag the label chip onto
	its box, or tap the box (the tap alternative, CLAUDE.md rule 10); either sets the answer, and
	Check grades it (a drop point by hit test, a tapped box by its id). After checking, the right
	box shows the label and the chosen one ✓ or ✕.
-->
<script lang="ts">
	import type { ExerciseResponse, ExerciseVerdict, PlaceSpec } from '#lib/services/study-types.ts';
	import {
		dropPoint,
		percentRect,
		type BoxLook,
		type ShownBox
	} from '#lib/ui/figures/figure-geometry.ts';
	import { watchMedia, type MediaLoader } from '#lib/ui/figures/media-url.ts';
	import OcclusionFigure from '#lib/ui/figures/OcclusionFigure.svelte';
	import { noMedia } from '#lib/ui/figures/FigureView.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';

	let {
		spec,
		verdict,
		media = noMedia,
		response = $bindable()
	}: {
		spec: PlaceSpec;
		verdict: ExerciseVerdict | null;
		media?: MediaLoader;
		response: ExerciseResponse | null;
		onsubmit: () => void;
	} = $props();

	let src: string | null = $state(null);
	let frame: HTMLDivElement | undefined = $state();
	let tapped: string | null = $state(null);
	let dropped = $state<ReturnType<typeof dropPoint>>(null);
	let drag = $state<{ x: number; y: number; dx: number; dy: number } | null>(null);

	$effect(() => watchMedia(media, spec.figure.mediaId, (url) => (src = url ?? '')));

	$effect(() => {
		if (tapped !== null) response = { shape: 'place', at: { boxId: tapped } };
		else if (dropped) response = { shape: 'place', at: dropped };
		else response = null;
	});

	function lookOf(id: string): BoxLook {
		if (verdict === null) return tapped === id ? 'selected' : 'covered';
		if (id === verdict.chosen) return verdict.correct ? 'correct' : 'wrong';
		return id === spec.boxId ? 'revealed' : 'covered';
	}

	const boxes = $derived<ShownBox[]>(
		spec.figure.boxes.map((b, i) => {
			const look = lookOf(b.id);
			const text = verdict !== null && b.id === spec.boxId ? spec.label : undefined;
			const mark = look === 'correct' ? '✓' : look === 'wrong' ? '✕' : undefined;
			return { ...b, look, text: text ?? mark, name: `Hidden part ${i + 1}` };
		})
	);

	function start(event: PointerEvent): void {
		if (verdict !== null) return;
		const chip = event.currentTarget as HTMLElement;
		chip.setPointerCapture(event.pointerId);
		drag = { x: event.clientX, y: event.clientY, dx: 0, dy: 0 };
	}

	function move(event: PointerEvent): void {
		if (drag) drag = { ...drag, dx: event.clientX - drag.x, dy: event.clientY - drag.y };
	}

	function end(event: PointerEvent): void {
		if (!drag || !frame) return;
		const moved = Math.abs(drag.dx) + Math.abs(drag.dy) > 0;
		drag = null;
		if (!moved) return;
		const hit = dropPoint({ x: event.clientX, y: event.clientY }, frame.getBoundingClientRect());
		if (!hit) return;
		tapped = null;
		dropped = hit;
	}

	const marker = $derived(
		dropped && tapped === null
			? percentRect({
					x: dropped.point.x / dropped.size.width,
					y: dropped.point.y / dropped.size.height,
					w: 0,
					h: 0
				})
			: null
	);
</script>

<Stack gap="md">
	<div class="tray">
		<span class="hint">Drag onto its place, or tap the box:</span>
		<button
			type="button"
			class="label"
			class:dragging={drag !== null}
			style:transform={drag ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined}
			disabled={verdict !== null}
			onpointerdown={start}
			onpointermove={move}
			onpointerup={end}
			onpointercancel={() => (drag = null)}
			data-place-label
		>
			{spec.label}
		</button>
	</div>
	<OcclusionFigure
		{src}
		title={spec.figure.title}
		{boxes}
		bind:frame
		onbox={verdict === null
			? (id) => {
					dropped = null;
					tapped = tapped === id ? null : id;
				}
			: undefined}
	>
		{#snippet overlay()}
			{#if marker}
				<span class="pin" style:left={marker.left} style:top={marker.top} aria-hidden="true"></span>
			{/if}
		{/snippet}
	</OcclusionFigure>
</Stack>

<style>
	.tray {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--gap-sm);
	}

	.hint {
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}

	.label {
		position: relative;
		z-index: var(--z-raised);
		min-height: var(--touch-min);
		padding: 0 var(--gap-lg);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-pill);
		background: var(--surface);
		color: var(--text-strong);
		font: inherit;
		font-weight: var(--type-strong-weight);
		cursor: grab;
		touch-action: none;
	}

	.label.dragging {
		cursor: grabbing;
		box-shadow: var(--shadow-raised);
	}

	.label:disabled {
		cursor: default;
		opacity: 0.6;
	}

	.pin {
		position: absolute;
		width: var(--size-px-16);
		height: var(--size-px-16);
		border: var(--border-width) solid var(--surface);
		border-radius: var(--r-full);
		background: var(--accent);
		transform: translate(-50%, -50%);
		pointer-events: none;
	}
</style>
