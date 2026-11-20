<!--
	One exercise, whatever its kind: picks the component for the spec's shape (BUILD_PLAN §5.1).
	Every exercise kind shares this interface — `{ spec, verdict, response, onsubmit }` — and is
	built only from layers 5–8 (DESIGN §13.2), with no visual styles of its own. `hint` is the micro
	hint the student asked for (shown by HintLink); a choice uses it to drop the removed option.
-->
<script lang="ts">
	import type {
		ExerciseResponse,
		ExerciseSpec,
		ExerciseVerdict,
		MicroHint
	} from '#lib/services/study-types.ts';
	import ChooseExercise from './ChooseExercise.svelte';
	import ChooseManyExercise from './ChooseManyExercise.svelte';
	import IdeaUnitExercise from './IdeaUnitExercise.svelte';
	import ListExercise from './ListExercise.svelte';
	import OrderExercise from './OrderExercise.svelte';
	import PairExercise from './PairExercise.svelte';
	import SelfRateExercise from './SelfRateExercise.svelte';
	import SortExercise from './SortExercise.svelte';
	import StudyExercise from './StudyExercise.svelte';
	import TypeExercise from './TypeExercise.svelte';

	let {
		spec,
		verdict,
		response = $bindable(null),
		hint = null,
		onsubmit
	}: {
		spec: ExerciseSpec;
		verdict: ExerciseVerdict | null;
		response?: ExerciseResponse | null;
		hint?: MicroHint | null;
		onsubmit: () => void;
	} = $props();
</script>

<div data-exercise-shape={spec.shape} data-exercise-kind={spec.kind} style:display="contents">
	{#if spec.shape === 'type'}
		<TypeExercise {spec} {verdict} bind:response {onsubmit} />
	{:else if spec.shape === 'choose'}
		<ChooseExercise {spec} {verdict} {hint} bind:response {onsubmit} />
	{:else if spec.shape === 'chooseMany'}
		<ChooseManyExercise {spec} {verdict} bind:response {onsubmit} />
	{:else if spec.shape === 'order'}
		<OrderExercise {spec} {verdict} bind:response {onsubmit} />
	{:else if spec.shape === 'pair'}
		<PairExercise {spec} {verdict} bind:response {onsubmit} />
	{:else if spec.shape === 'sort'}
		<SortExercise {spec} {verdict} bind:response {onsubmit} />
	{:else if spec.shape === 'selfRate'}
		<SelfRateExercise {spec} {verdict} bind:response {onsubmit} />
	{:else if spec.shape === 'study'}
		<StudyExercise {spec} {verdict} bind:response {onsubmit} />
	{:else if spec.shape === 'ideaUnit'}
		<IdeaUnitExercise {spec} {verdict} bind:response {onsubmit} />
	{:else if spec.shape === 'list'}
		<ListExercise {spec} {verdict} bind:response {onsubmit} />
	{/if}
</div>
