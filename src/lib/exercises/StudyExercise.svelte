<!--
	Worked-example study (exampleStudy; BUILD_PLAN §5.1): the whole solution with its subgoal
	labels, once, before the first fade. Nothing to answer.
-->
<script lang="ts">
	import type { ExerciseResponse, ExerciseVerdict, StudySpec } from '#lib/services/study-types.ts';
	import StepList from '#lib/ui/components/StepList.svelte';

	let {
		spec,
		response = $bindable()
	}: {
		spec: StudySpec;
		verdict: ExerciseVerdict | null;
		response: ExerciseResponse | null;
		onsubmit: () => void;
	} = $props();

	$effect(() => {
		response = { shape: 'study' };
	});
</script>

<StepList steps={spec.steps} />
