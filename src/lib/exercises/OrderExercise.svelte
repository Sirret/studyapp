<!--
	Put in order (sequence, parsons; BUILD_PLAN §5.1). Tap chips in the bank to add them to the
	order; tap a placed step to send it back. In Parsons some chips don't belong: leave them in the
	bank. Tap-only, so it works by touch, mouse and keyboard (CLAUDE.md rule 10).
-->
<script lang="ts">
	import type { ExerciseResponse, ExerciseVerdict, OrderSpec } from '#lib/services/study-types.ts';
	import Slot from '#lib/ui/components/Slot.svelte';
	import TapChip from '#lib/ui/components/TapChip.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';

	let {
		spec,
		verdict,
		response = $bindable()
	}: {
		spec: OrderSpec;
		verdict: ExerciseVerdict | null;
		response: ExerciseResponse | null;
		onsubmit: () => void;
	} = $props();

	let placed: number[] = $state([]);
	const complete = $derived(
		spec.extras.length > 0 ? placed.length > 0 : placed.length === spec.items.length
	);

	$effect(() => {
		response = complete ? { shape: 'order', order: [...placed] } : null;
	});
</script>

<Stack gap="md">
	<Stack gap="xs">
		{#each placed as item, position (item)}
			<span data-slot-index={position}>
				<Slot
					label="Step {position + 1}"
					value={spec.items[item]}
					state={verdict === null ? 'filled' : verdict.marks.includes(item) ? 'wrong' : 'correct'}
					disabled={verdict !== null}
					onclick={() => (placed = placed.filter((p) => p !== item))}
				/>
			</span>
		{/each}
		{#if verdict === null && !complete}
			<Slot label="Step {placed.length + 1}" state="empty" disabled />
		{/if}
	</Stack>
	<Row gap="sm">
		{#each spec.items as text, i (i)}
			{#if !placed.includes(i)}
				<span data-item-index={i}>
					<TapChip {text} disabled={verdict !== null} onclick={() => (placed = [...placed, i])} />
				</span>
			{/if}
		{/each}
	</Row>
</Stack>
