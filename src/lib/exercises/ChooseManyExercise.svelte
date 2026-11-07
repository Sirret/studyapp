<!--
	Select all that apply (multiSelect; BUILD_PLAN §5.1). Tap options to toggle them, then Check.
	After the verdict: picked-and-right ✓, picked-but-wrong ✕, missed ones revealed.
-->
<script lang="ts">
	import type {
		ChooseManySpec,
		ExerciseResponse,
		ExerciseVerdict
	} from '#lib/services/study-types.ts';
	import OptionButton, { type OptionState } from '#lib/ui/components/OptionButton.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';

	let {
		spec,
		verdict,
		response = $bindable()
	}: {
		spec: ChooseManySpec;
		verdict: ExerciseVerdict | null;
		response: ExerciseResponse | null;
		onsubmit: () => void;
	} = $props();

	let picked: number[] = $state([]);

	$effect(() => {
		response = picked.length === 0 ? null : { shape: 'chooseMany', indexes: [...picked] };
	});

	function toggle(i: number): void {
		picked = picked.includes(i) ? picked.filter((p) => p !== i) : [...picked, i];
	}

	function stateOf(i: number): OptionState {
		const isPicked = picked.includes(i);
		if (verdict === null) return isPicked ? 'selected' : 'default';
		const right = spec.correct.includes(i);
		if (isPicked) return right ? 'correct' : 'wrong';
		return right ? 'revealed' : 'default';
	}
</script>

<Stack gap="sm">
	{#each spec.options as option, i (i)}
		<span data-option-index={i}>
			<OptionButton
				letter={String.fromCharCode(65 + i)}
				text={option.text}
				state={stateOf(i)}
				multi
				disabled={verdict !== null}
				onclick={() => toggle(i)}
			/>
		</span>
	{/each}
</Stack>
