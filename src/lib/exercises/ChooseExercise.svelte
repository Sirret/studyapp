<!--
	Pick one (mc, pretest, which one, scenario, odd one out, pick the principle, first-letter bank;
	BUILD_PLAN §5.1). Tap an option to select it, then Check. After the verdict the pick shows ✓ or
	✕ and the right option is revealed.
-->
<script lang="ts">
	import type { ChooseSpec, ExerciseResponse, ExerciseVerdict } from '#lib/services/study-types.ts';
	import OptionButton, { type OptionState } from '#lib/ui/components/OptionButton.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';

	let {
		spec,
		verdict,
		response = $bindable()
	}: {
		spec: ChooseSpec;
		verdict: ExerciseVerdict | null;
		response: ExerciseResponse | null;
		onsubmit: () => void;
	} = $props();

	let picked: number | null = $state(null);

	$effect(() => {
		response = picked === null ? null : { shape: 'choose', index: picked };
	});

	function stateOf(i: number): OptionState {
		if (verdict === null) return picked === i ? 'selected' : 'default';
		if (i === picked) return verdict.correct ? 'correct' : 'wrong';
		return i === spec.correctIndex ? 'revealed' : 'default';
	}
</script>

<Stack gap="sm">
	{#each spec.options as option, i (i)}
		<span data-option-index={i}>
			<OptionButton
				letter={String.fromCharCode(65 + i)}
				text={option.text}
				state={stateOf(i)}
				disabled={verdict !== null}
				onclick={() => (picked = i)}
			/>
		</span>
	{/each}
</Stack>
