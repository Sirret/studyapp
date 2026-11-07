<!--
	Typed recall (cloze, first-letter type, fade step, new instance; BUILD_PLAN §5.1). One large
	input; the first-letter hint shows as a faded letter. Enter checks.
-->
<script lang="ts">
	import type { ExerciseResponse, ExerciseVerdict, TypeSpec } from '#lib/services/study-types.ts';
	import Input from '#lib/ui/primitives/Input.svelte';

	let {
		spec,
		verdict,
		response = $bindable(),
		onsubmit
	}: {
		spec: TypeSpec;
		verdict: ExerciseVerdict | null;
		response: ExerciseResponse | null;
		onsubmit: () => void;
	} = $props();

	let typed = $state('');
	let input: HTMLInputElement | undefined = $state();

	$effect(() => {
		response = typed.trim() === '' ? null : { shape: 'type', typed };
	});
	$effect(() => {
		if (verdict === null) input?.focus({ preventScroll: true });
	});
</script>

<form
	onsubmit={(event) => {
		event.preventDefault();
		if (response && verdict === null) onsubmit();
	}}
>
	<Input
		label="Your answer"
		hideLabel
		size="lg"
		bind:value={typed}
		bind:ref={input}
		hint={spec.letter}
		disabled={verdict !== null}
		enterkeyhint="done"
		data-exercise-input
	/>
</form>
