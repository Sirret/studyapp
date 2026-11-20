<!--
	Idea unit (BUILD_PLAN §5.1 row ideaUnit; Decisions log "Phase 8.6 Q1"): type the definition in
	your own words, then "Next" shows the definition and its key words. The key words the typed text
	already holds come pre-ticked; tick any others your answer really covered, then Check. Correct
	needs every key word ticked; ticking one yourself counts as recognition (graded by the engine).
	After the verdict, ticked words show ✓ and unticked ones are revealed as missed.
-->
<script lang="ts">
	import { preTickedKeyWords } from '#lib/services/exercise-helpers.ts';
	import type {
		ExerciseResponse,
		ExerciseVerdict,
		IdeaUnitSpec
	} from '#lib/services/study-types.ts';
	import TapChip, { type ChipState } from '#lib/ui/components/TapChip.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import TextArea from '#lib/ui/primitives/TextArea.svelte';

	let {
		spec,
		verdict,
		response = $bindable()
	}: {
		spec: IdeaUnitSpec;
		verdict: ExerciseVerdict | null;
		response: ExerciseResponse | null;
		onsubmit: () => void;
	} = $props();
	const id = $props.id();

	let typed = $state('');
	let ticking = $state(false);
	let preTicked: number[] = $state([]);
	let ticked: number[] = $state([]);
	let area: HTMLTextAreaElement | undefined = $state();

	$effect(() => {
		response = ticking ? { shape: 'ideaUnit', typed, ticked: [...ticked] } : null;
	});
	$effect(() => {
		if (!ticking && verdict === null) area?.focus({ preventScroll: true });
	});

	function next(): void {
		if (typed.trim() === '') return;
		preTicked = preTickedKeyWords(typed, spec.keyWords);
		ticked = [...preTicked];
		ticking = true;
	}

	function toggle(i: number): void {
		ticked = ticked.includes(i) ? ticked.filter((t) => t !== i) : [...ticked, i];
	}

	function stateOf(i: number): ChipState {
		const on = ticked.includes(i);
		if (verdict === null) return on ? 'selected' : 'default';
		return on ? 'correct' : 'revealed';
	}
</script>

{#if !ticking}
	<Stack gap="sm">
		<TextArea label="Your definition" bind:value={typed} bind:ref={area} rows={4} data-idea-typed />
		<Button variant="secondary" disabled={typed.trim() === ''} onclick={next} data-idea-next>
			Next: tick the key words
		</Button>
	</Stack>
{:else}
	<Stack gap="md">
		<div class="panel">
			<span class="label">You wrote</span>
			<p class="typed">{typed}</p>
		</div>
		<div class="panel">
			<span class="label">The definition</span>
			<p>{spec.answer}</p>
		</div>
		<div class="keys" role="group" aria-labelledby="{id}-keys">
			<p class="label" id="{id}-keys">
				Tick the key words your answer holds ({ticked.length} of {spec.keyWords.length})
			</p>
			<div class="chips">
				{#each spec.keyWords as word, i (i)}
					<span data-key-word={i} data-pre-ticked={preTicked.includes(i)}>
						<TapChip
							text={word}
							state={stateOf(i)}
							disabled={verdict !== null}
							onclick={() => toggle(i)}
						/>
					</span>
				{/each}
			</div>
			{#if preTicked.length > 0 && verdict === null}
				<p class="note">Already ticked: the words your answer matched.</p>
			{/if}
		</div>
	</Stack>
{/if}

<style>
	.panel {
		display: grid;
		gap: var(--gap-2xs);
	}

	.label {
		margin: 0;
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
	}

	p {
		margin: 0;
		color: var(--text);
		font-size: var(--type-body-size);
		line-height: var(--type-body-leading);
	}

	.typed {
		font-style: italic;
		overflow-wrap: anywhere;
	}

	.keys {
		display: grid;
		gap: var(--gap-sm);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-sm);
	}

	.note {
		color: var(--text-soft);
		font-size: var(--type-small-size);
		line-height: var(--type-small-leading);
	}
</style>
