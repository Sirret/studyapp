<!--
	Reconnect the arrows (structureRebuild; BUILD_PLAN §7.2): the boxes are drawn without arrows.
	Tap a box, then the box its arrow points to; tap the first box again to cancel. Drawn arrows are
	listed below; tap one to take it away. After checking, right arrows turn green, extra ones red
	(✕), and missed ones show dashed (Decisions log "Phase 6 Q8": graded as a set, from → to).
-->
<script lang="ts">
	import type {
		ConnectSpec,
		ExerciseResponse,
		ExerciseVerdict
	} from '#lib/services/study-types.ts';
	import TapChip from '#lib/ui/components/TapChip.svelte';
	import DiagramFigure, { type ArrowLook } from '#lib/ui/figures/DiagramFigure.svelte';
	import { missingArrows, tapNode, type Arrow } from '#lib/ui/figures/figure-geometry.ts';
	import Row from '#lib/ui/layout/Row.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';

	let {
		spec,
		verdict,
		response = $bindable()
	}: {
		spec: ConnectSpec;
		verdict: ExerciseVerdict | null;
		response: ExerciseResponse | null;
		onsubmit: () => void;
	} = $props();

	let state: { pending: string | null; arrows: Arrow[] } = $state({ pending: null, arrows: [] });

	$effect(() => {
		response =
			state.arrows.length === 0
				? null
				: { shape: 'connect', edges: state.arrows.map((a) => ({ ...a })) };
	});

	const names = $derived(new Map(spec.figure.nodes.map((n) => [n.id, n.label ?? '?'])));
	const text = (a: Arrow): string => `${names.get(a.from)} → ${names.get(a.to)}`;

	const shown = $derived<(Arrow & { look: ArrowLook })[]>(
		verdict === null
			? state.arrows.map((a) => ({ ...a, look: 'drawn' }))
			: [
					...state.arrows.map((a, i) => ({
						...a,
						look: (verdict.marks.includes(i) ? 'wrong' : 'correct') as ArrowLook
					})),
					...missingArrows(state.arrows, spec.edges).map((a) => ({ ...a, look: 'missed' as const }))
				]
	);
</script>

<Stack gap="md">
	<DiagramFigure
		figure={spec.figure}
		arrows={shown}
		nodeLook={(id) => (state.pending === id ? 'selected' : 'default')}
		onnode={verdict === null ? (id) => (state = tapNode(state, id)) : undefined}
	/>
	<p class="status" role="status">
		{#if verdict !== null}
			{verdict.correct ? 'All arrows right.' : 'Dashed arrows were missing; red ones were extra.'}
		{:else if state.pending !== null}
			From {names.get(state.pending)}: now tap the box it points to.
		{:else}
			Tap a box, then the box its arrow points to.
		{/if}
	</p>
	{#if state.arrows.length > 0}
		<Row gap="sm">
			{#each state.arrows as arrow, i (text(arrow))}
				<span data-arrow-index={i}>
					<TapChip
						text={verdict === null ? `${text(arrow)}  ✕` : text(arrow)}
						state={verdict === null ? 'default' : verdict.marks.includes(i) ? 'wrong' : 'correct'}
						disabled={verdict !== null}
						onclick={() => (state = { ...state, arrows: state.arrows.filter((_, j) => j !== i) })}
					/>
				</span>
			{/each}
		</Row>
	{/if}
</Stack>

<style>
	.status {
		margin: 0;
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}
</style>
