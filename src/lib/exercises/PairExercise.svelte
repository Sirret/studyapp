<!--
	Match pairs (matching, subgoal match, table row; BUILD_PLAN §5.1). Tap a chip to pick it up, then
	tap the entry it belongs to; tap a filled entry to clear it. The tap alternative to dragging.
-->
<script lang="ts">
	// The screen re-creates this per card and attempt ({#key}), so the first spec is the spec.
	import { untrack } from 'svelte';
	import type { ExerciseResponse, ExerciseVerdict, PairSpec } from '#lib/services/study-types.ts';
	import Slot, { type SlotState } from '#lib/ui/components/Slot.svelte';
	import TapChip from '#lib/ui/components/TapChip.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';

	let {
		spec,
		verdict,
		response = $bindable()
	}: {
		spec: PairSpec;
		verdict: ExerciseVerdict | null;
		response: ExerciseResponse | null;
		onsubmit: () => void;
	} = $props();

	let matches: number[] = $state(untrack(() => spec.left.map(() => -1)));
	let holding: number | null = $state(null);

	$effect(() => {
		response = matches.every((m) => m >= 0) ? { shape: 'pair', matches: [...matches] } : null;
	});

	function tapSlot(left: number): void {
		if (holding !== null) {
			matches = matches.map((m, i) => (i === left ? (holding as number) : m === holding ? -1 : m));
			holding = null;
		} else matches = matches.map((m, i) => (i === left ? -1 : m));
	}

	function slotState(left: number): SlotState {
		if (verdict !== null) return verdict.marks.includes(left) ? 'wrong' : 'correct';
		if (holding !== null) return 'ready';
		return (matches[left] ?? -1) >= 0 ? 'filled' : 'empty';
	}
</script>

<Stack gap="md">
	<Stack gap="xs">
		{#each spec.left as label, i (i)}
			<span data-slot-index={i}>
				<Slot
					{label}
					value={spec.right[matches[i] ?? -1]}
					state={slotState(i)}
					disabled={verdict !== null}
					onclick={() => tapSlot(i)}
				/>
			</span>
		{/each}
	</Stack>
	<Row gap="sm">
		{#each spec.right as text, i (i)}
			<span data-item-index={i}>
				<TapChip
					{text}
					state={holding === i ? 'selected' : matches.includes(i) ? 'used' : 'default'}
					disabled={verdict !== null}
					onclick={() => (holding = holding === i ? null : i)}
				/>
			</span>
		{/each}
	</Row>
</Stack>
