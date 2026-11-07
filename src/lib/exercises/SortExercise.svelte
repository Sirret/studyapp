<!--
	Sort into groups (categorize; BUILD_PLAN §5.1). Tap a chip to pick it up, then tap its group;
	tap a placed chip to take it back. The tap alternative to dragging.
-->
<script lang="ts">
	// The screen re-creates this per card and attempt ({#key}), so the first spec is the spec.
	import { untrack } from 'svelte';
	import type { ExerciseResponse, ExerciseVerdict, SortSpec } from '#lib/services/study-types.ts';
	import Slot from '#lib/ui/components/Slot.svelte';
	import TapChip from '#lib/ui/components/TapChip.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';

	let {
		spec,
		verdict,
		response = $bindable()
	}: {
		spec: SortSpec;
		verdict: ExerciseVerdict | null;
		response: ExerciseResponse | null;
		onsubmit: () => void;
	} = $props();

	let placed: number[] = $state(untrack(() => spec.items.map(() => -1)));
	let holding: number | null = $state(null);

	$effect(() => {
		response = placed.every((p) => p >= 0) ? { shape: 'sort', placed: [...placed] } : null;
	});

	function drop(bucket: number): void {
		if (holding === null) return;
		placed = placed.map((p, i) => (i === holding ? bucket : p));
		holding = null;
	}

	function chipState(i: number) {
		if (verdict !== null) return verdict.marks.includes(i) ? 'wrong' : 'correct';
		return holding === i ? 'selected' : 'default';
	}
</script>

<Stack gap="md">
	{#each spec.buckets as bucket, b (b)}
		<Stack gap="xs">
			<span data-slot-index={b}>
				<Slot
					label={bucket}
					value={holding !== null ? 'Tap to put it here' : undefined}
					state={holding !== null ? 'ready' : 'empty'}
					disabled={verdict !== null || holding === null}
					onclick={() => drop(b)}
				/>
			</span>
			<Row gap="xs">
				{#each spec.items as text, i (i)}
					{#if placed[i] === b}
						<span data-item-index={i}>
							<TapChip
								{text}
								state={chipState(i)}
								disabled={verdict !== null}
								onclick={() => (placed = placed.map((p, j) => (j === i ? -1 : p)))}
							/>
						</span>
					{/if}
				{/each}
			</Row>
		</Stack>
	{/each}
	<Row gap="sm">
		{#each spec.items as text, i (i)}
			{#if placed[i] === -1}
				<span data-item-index={i}>
					<TapChip
						{text}
						state={chipState(i)}
						disabled={verdict !== null}
						onclick={() => (holding = holding === i ? null : i)}
					/>
				</span>
			{/if}
		{/each}
	</Row>
</Stack>
