<!--
	Self-rated lane (flip, explain it, blurt; BUILD_PLAN §5.1, CONCEPT §4): recall first, then
	reveal. Explain-it and blurt tick what you got (blurt's unticked items come back); flip rates
	itself. Never graded, never counts toward the criterion.
-->
<script lang="ts">
	// The screen re-creates this per card and attempt ({#key}), so the first spec is the spec.
	import { untrack } from 'svelte';
	import type {
		ExerciseResponse,
		ExerciseVerdict,
		SelfRateSpec
	} from '#lib/services/study-types.ts';
	import FeedbackPanel from '#lib/ui/components/FeedbackPanel.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Checkbox from '#lib/ui/primitives/Checkbox.svelte';

	let {
		spec,
		verdict,
		response = $bindable()
	}: {
		spec: SelfRateSpec;
		verdict: ExerciseVerdict | null;
		response: ExerciseResponse | null;
		onsubmit: () => void;
	} = $props();

	type Rating = 'again' | 'hard' | 'good';
	const RATINGS: { value: Rating; label: string }[] = [
		{ value: 'again', label: 'Didn’t know' },
		{ value: 'hard', label: 'Partly' },
		{ value: 'good', label: 'Knew it' }
	];

	let revealed = $state(false);
	let ticks: boolean[] = $state(untrack(() => spec.checklist.map(() => false)));
	let rating: Rating | null = $state(null);
	const isFlip = $derived(spec.kind === 'flip');

	$effect(() => {
		const checked = ticks.flatMap((on, i) => (on ? [i] : []));
		if (!revealed || (isFlip && rating === null)) response = null;
		else response = { shape: 'selfRate', checked, ...(rating ? { rating } : {}) };
	});
</script>

{#if !revealed}
	<Button variant="secondary" full onclick={() => (revealed = true)} data-reveal>Reveal</Button>
{:else}
	<FeedbackPanel correct={null} reveal={spec.answer.split('\n')}>
		{#snippet actions()}
			<Stack gap="xs">
				{#each spec.checklist as item, i (i)}
					<span data-check-index={i}>
						<Checkbox bind:checked={ticks[i]} disabled={verdict !== null}>{item.text}</Checkbox>
					</span>
				{/each}
				{#if isFlip}
					<Row gap="sm">
						{#each RATINGS as option (option.value)}
							<Button
								variant={rating === option.value ? 'primary' : 'secondary'}
								disabled={verdict !== null}
								onclick={() => (rating = option.value)}
								data-rating={option.value}>{option.label}</Button
							>
						{/each}
					</Row>
				{/if}
			</Stack>
		{/snippet}
	</FeedbackPanel>
{/if}
