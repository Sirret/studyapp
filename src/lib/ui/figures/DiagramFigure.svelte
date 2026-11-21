<!--
	Diagram figure (BUILD_PLAN §7.2): a stack or flow drawn as SVG from its precomputed layout (the
	UI never runs the layout engine). A hidden label shows "?" (or `reveal` once checked); the asked
	node or arrow is highlighted. `arrows` are extra straight arrows (the connect exercise's).
	With `onnode`, every node is also a button laid over the drawing (tap alternative to drag).
	Screen readers get the title and one line per layer or arrow. A diagram too big to draw
	(layout null) is shown as that text instead.
-->
<script module lang="ts">
	export type NodeLook = 'default' | 'selected';
	export type ArrowLook = 'drawn' | 'correct' | 'wrong' | 'missed';
</script>

<script lang="ts">
	import type { DiagramFigure } from '#lib/services/study-types.ts';
	import {
		connectorPoints,
		diagramLines,
		percentRect,
		polylinePoints,
		type Arrow
	} from './figure-geometry.ts';

	let {
		figure,
		reveal,
		arrows = [],
		nodeLook = () => 'default',
		onnode
	}: {
		figure: DiagramFigure;
		reveal?: string;
		arrows?: (Arrow & { look: ArrowLook })[];
		nodeLook?: (id: string) => NodeLook;
		onnode?: (id: string) => void;
	} = $props();

	const HEADS = ['base', 'drawn', 'correct', 'wrong'] as const;
	const uid = $props.id();
	const layout = $derived(figure.layout);
	const lines = $derived(diagramLines(figure));
	const size = $derived(layout ? { width: layout.width, height: layout.height } : null);
	const labelOf = (label: string | null, id: string): string =>
		label ?? (id === figure.target && reveal !== undefined ? reveal : '?');
</script>

<figure class="diagram" data-figure="diagram" data-diagram-shape={figure.shape}>
	<figcaption class="sr-only">{figure.title}</figcaption>
	{#if layout && size}
		<div class="canvas" style:max-width="{size.width}px">
			<svg viewBox="0 0 {size.width} {size.height}" aria-hidden="true">
				<defs>
					{#each HEADS as head (head)}
						<marker
							id="{uid}-{head}"
							viewBox="0 0 10 10"
							refX="9"
							refY="5"
							markerWidth="8"
							markerHeight="8"
							orient="auto-start-reverse"
						>
							<path d="M0,0 L10,5 L0,10 z" class="head {head}" />
						</marker>
					{/each}
				</defs>
				{#each figure.edges as edge (edge.id)}
					{@const path = layout.edges[edge.id]}
					{#if path}
						<polyline
							class="edge"
							class:target={edge.id === figure.target}
							points={polylinePoints(path.points)}
							marker-end="url(#{uid}-{edge.id === figure.target ? 'drawn' : 'base'})"
						/>
						{#if edge.label !== null || edge.id === figure.target}
							<text class="edge-label" x={path.labelAt.x} y={path.labelAt.y}>
								{labelOf(edge.label, edge.id)}
							</text>
						{/if}
					{/if}
				{/each}
				{#each arrows as arrow, i (i)}
					{@const from = layout.nodes[arrow.from]}
					{@const to = layout.nodes[arrow.to]}
					{#if from && to}
						<polyline
							class="edge {arrow.look}"
							points={polylinePoints(connectorPoints(from, to))}
							marker-end="url(#{uid}-{arrow.look === 'missed' ? 'correct' : arrow.look})"
							data-arrow-look={arrow.look}
						/>
					{/if}
				{/each}
				{#each figure.nodes as node (node.id)}
					{@const box = layout.nodes[node.id]}
					{#if box}
						<rect
							class="node {nodeLook(node.id)}"
							class:target={node.id === figure.target}
							x={box.x}
							y={box.y}
							width={box.w}
							height={box.h}
							rx="6"
						/>
						<text
							class="node-label"
							class:on-frost={node.id === figure.target || nodeLook(node.id) === 'selected'}
							x={box.x + box.w / 2}
							y={box.y + box.h / 2}
						>
							{labelOf(node.label, node.id)}
						</text>
					{/if}
				{/each}
			</svg>
			{#if onnode}
				{#each figure.nodes as node (node.id)}
					{@const box = layout.nodes[node.id]}
					{#if box}
						{@const r = percentRect(box, size)}
						<button
							type="button"
							class="hit"
							style:left={r.left}
							style:top={r.top}
							style:width={r.width}
							style:height={r.height}
							aria-label={node.label ?? 'Hidden box'}
							aria-pressed={nodeLook(node.id) === 'selected'}
							data-node-id={node.id}
							onclick={() => onnode(node.id)}
						></button>
					{/if}
				{/each}
			{/if}
		</div>
		<ul class="sr-only">
			{#each lines as line, i (i)}<li>{line}</li>{/each}
		</ul>
	{:else}
		<p class="too-big">Too big to draw. Here it is as text:</p>
		<ul class="as-text">
			{#each lines as line, i (i)}<li>{line}</li>{/each}
		</ul>
	{/if}
</figure>

<style>
	.diagram {
		margin: 0;
		overflow-x: auto;
	}

	.canvas {
		position: relative;
		margin: 0 auto;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.node {
		fill: var(--surface);
		stroke: var(--outline);
		stroke-width: 2;
	}

	.node.target {
		fill: var(--frost);
		stroke: var(--accent);
	}

	.node.selected {
		fill: var(--frost);
		stroke: var(--accent);
		stroke-width: 3;
	}

	.node-label,
	.edge-label {
		fill: var(--text-strong);
		font-family: var(--font-body);
		font-size: var(--type-small-size);
		text-anchor: middle;
		dominant-baseline: central;
	}

	.node-label.on-frost {
		fill: var(--on-light-fill);
	}

	.edge-label {
		fill: var(--text-soft);
		paint-order: stroke;
		stroke: var(--surface);
		stroke-width: 4;
	}

	.edge {
		fill: none;
		stroke: var(--line-strong);
		stroke-width: 2;
	}

	.edge.target,
	.edge.drawn {
		stroke: var(--accent);
	}

	.edge.correct {
		stroke: var(--correct);
	}

	.edge.wrong {
		stroke: var(--wrong);
	}

	.edge.missed {
		stroke: var(--correct);
		stroke-dasharray: 6 4;
	}

	.head {
		fill: var(--line-strong);
	}

	.head.drawn {
		fill: var(--accent);
	}

	.head.correct {
		fill: var(--correct);
	}

	.head.wrong {
		fill: var(--wrong);
	}

	.hit {
		position: absolute;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: var(--r-xs);
		background: transparent;
		cursor: pointer;
		touch-action: manipulation;
	}

	.hit:focus-visible {
		outline: var(--focus-width) solid var(--accent);
		outline-offset: var(--focus-offset);
	}

	.too-big {
		margin: 0;
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}

	.as-text {
		margin: 0;
		padding-left: var(--gap-xl);
		color: var(--text);
	}
</style>
