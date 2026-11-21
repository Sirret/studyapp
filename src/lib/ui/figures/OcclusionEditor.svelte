<!--
	Occlusion editor (BUILD_PLAN §7.1; CONCEPT §13): drag on the picture to draw a hide box, or tap
	it to drop a default-size box; drag a box to move it, or its corner handle to resize it. Every
	drag has a tap alternative: the step buttons of the selected box, and the tray of labels still
	to place (tap a label, then tap the picture). Hide mode (one or all) and the screen-reader name
	are set per image. Changes stay in `edit`; the screen saves them.
-->
<script lang="ts">
	import {
		addBox,
		moveBox,
		placeLabel,
		removeBox,
		resizeBox,
		type OcclusionBox
	} from '#lib/services/figure-edit.ts';
	import type { OcclusionEdit } from '#lib/services/occlusion-service.ts';
	import TapChip from '../components/TapChip.svelte';
	import Input from '../primitives/Input.svelte';
	import Segmented from '../primitives/Segmented.svelte';
	import { percentRect, type ShownBox } from './figure-geometry.ts';
	import OcclusionBoxControls from './OcclusionBoxControls.svelte';
	import OcclusionFigure from './OcclusionFigure.svelte';
	import { delta, drawnRect, fractionAt, rectBetween, type Gesture } from './occlusion-pointer.ts';

	let {
		src,
		fileName,
		edit = $bindable(),
		newId
	}: { src: string | null; fileName: string; edit: OcclusionEdit; newId: () => string } = $props();

	const HIDE = [
		{ value: 'one', label: 'Hide one' },
		{ value: 'all', label: 'Hide all' }
	] as const;

	let frame: HTMLDivElement | undefined = $state();
	let selected = $state<string | null>(null);
	let placing = $state<string | null>(null);
	let gesture = $state<Gesture | null>(null);
	let base: OcclusionEdit | null = null;

	const index = $derived(edit.boxes.findIndex((b) => b.id === selected));
	const current = $derived<OcclusionBox | undefined>(edit.boxes[index]);
	const shown = $derived<ShownBox[]>(
		edit.boxes.map((b, i) => ({
			...b,
			look: b.id === selected ? 'active' : 'editing',
			text: b.label || `Box ${i + 1}`,
			name: `Box ${i + 1}: ${b.label || 'no label'}`
		}))
	);
	const drawing = $derived(
		gesture?.kind === 'draw' ? percentRect(rectBetween(gesture.start, gesture.now)) : null
	);
	const handle = $derived(
		current ? percentRect({ x: current.x + current.w, y: current.y + current.h, w: 0, h: 0 }) : null
	);

	function apply(next: Pick<OcclusionEdit, 'boxes'> & { unplaced?: string[] }): void {
		edit = { ...edit, boxes: next.boxes, unplaced: next.unplaced ?? edit.unplaced };
	}

	function at(event: PointerEvent) {
		return fractionAt({ x: event.clientX, y: event.clientY }, frame!.getBoundingClientRect());
	}

	function down(event: PointerEvent): void {
		if (!frame || event.button > 0) return;
		const target = event.target as HTMLElement;
		const point = at(event);
		const boxId = target.closest<HTMLElement>('[data-box-id]')?.dataset.boxId;
		frame.setPointerCapture(event.pointerId);
		base = edit;
		if (target.closest('[data-resize-handle]') && selected) {
			gesture = { kind: 'resize', boxId: selected, start: point, now: point };
		} else if (boxId && placing === null) {
			selected = boxId;
			gesture = { kind: 'move', boxId, start: point, now: point };
		} else {
			gesture = { kind: 'draw', start: point, now: point };
		}
	}

	function move(event: PointerEvent): void {
		if (!gesture || !base) return;
		gesture = { ...gesture, now: at(event) };
		const d = delta(gesture);
		if (gesture.kind === 'move') apply(moveBox(base, gesture.boxId, d.x, d.y));
		if (gesture.kind === 'resize') apply(resizeBox(base, gesture.boxId, d.x, d.y));
	}

	function up(): void {
		const done = gesture;
		gesture = null;
		if (done?.kind !== 'draw') return;
		const before = edit.boxes.length;
		if (placing !== null) {
			apply(placeLabel(edit, placing, done.now, newId));
			placing = null;
		} else {
			apply(addBox(edit, drawnRect(done.start, done.now), '', newId));
		}
		if (edit.boxes.length > before) selected = edit.boxes.at(-1)?.id ?? null;
	}
</script>

<div class="editor" data-occlusion-editor>
	<div
		class="surface"
		role="presentation"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={() => (gesture = null)}
	>
		<OcclusionFigure
			{src}
			title={edit.title || fileName}
			boxes={shown}
			bind:frame
			onbox={(id) => (selected = id)}
		>
			{#snippet overlay()}
				{#if drawing}
					<span
						class="drawing"
						style:left={drawing.left}
						style:top={drawing.top}
						style:width={drawing.width}
						style:height={drawing.height}
					></span>
				{/if}
				{#if handle}
					<span
						class="handle"
						style:left={handle.left}
						style:top={handle.top}
						data-resize-handle
						aria-hidden="true"
					></span>
				{/if}
			{/snippet}
		</OcclusionFigure>
	</div>
	<p class="help" role="status">
		{#if placing !== null}
			Tap the picture where “{placing}” goes.
		{:else}
			Drag on the picture to draw a box, or tap to drop one.
		{/if}
	</p>
	{#if edit.unplaced.length > 0}
		<div class="tray" aria-label="Labels to place">
			<span class="tray-title">To place ({edit.unplaced.length}):</span>
			{#each edit.unplaced as label, i (i)}
				<TapChip
					text={label}
					state={placing === label ? 'selected' : 'default'}
					onclick={() => (placing = placing === label ? null : label)}
				/>
			{/each}
		</div>
	{/if}
	{#if current}
		<OcclusionBoxControls
			box={current}
			{index}
			total={edit.boxes.length}
			onlabel={(label) =>
				(edit = {
					...edit,
					boxes: edit.boxes.map((b) => (b.id === current.id ? { ...b, label } : b))
				})}
			onmove={(dx, dy) => apply(moveBox(edit, current.id, dx, dy))}
			onresize={(step) => apply(resizeBox(edit, current.id, step, step))}
			ondelete={() => {
				apply(removeBox(edit, current.id));
				selected = null;
			}}
		/>
	{/if}
	<Segmented
		label="Hide mode"
		options={HIDE}
		value={edit.hide}
		onchange={(hide) => (edit = { ...edit, hide })}
	/>
	<Input label="Name for screen readers" bind:value={edit.title} placeholder={fileName} />
</div>

<style>
	.editor {
		display: grid;
		gap: var(--gap-md);
	}

	.surface {
		touch-action: none;
	}

	.help,
	.tray-title {
		margin: 0;
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}

	.tray {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--gap-sm);
	}

	.drawing {
		position: absolute;
		border: var(--border-width) dashed var(--accent);
		pointer-events: none;
	}

	.handle {
		position: absolute;
		width: var(--size-px-24);
		height: var(--size-px-24);
		border: var(--border-width) solid var(--surface);
		border-radius: var(--r-full);
		background: var(--accent);
		transform: translate(-50%, -50%);
		cursor: nwse-resize;
	}
</style>
