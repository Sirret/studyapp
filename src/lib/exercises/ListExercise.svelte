<!--
	List card (BUILD_PLAN §5.1 row listN; Decisions log "Phase 8.6 Q9"; mockup 05-quiz-list-card),
	under a "List card" stamp. Typed (`listAll`, `listN`): one row per item needed; Enter moves to
	the next empty row, and on the last row checks. Tap-pick (`listPick`): the items mixed with other
	lists' items as chips; a paw trail counts the picks against N (the Check button shows
	"N picked"). After the verdict, picked chips show ✓ or ✕ and missed items are revealed.
	"Which is NOT in the list" (`listNot`) is a choose exercise, not this one.
-->
<script lang="ts">
	import type { ExerciseResponse, ExerciseVerdict, ListSpec } from '#lib/services/study-types.ts';
	import PawTrail from '#lib/ui/components/PawTrail.svelte';
	import Stamp from '#lib/ui/components/Stamp.svelte';
	import TapChip, { type ChipState } from '#lib/ui/components/TapChip.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Input from '#lib/ui/primitives/Input.svelte';

	let {
		spec,
		verdict,
		response = $bindable(),
		onsubmit
	}: {
		spec: ListSpec;
		verdict: ExerciseVerdict | null;
		response: ExerciseResponse | null;
		onsubmit: () => void;
	} = $props();

	// The row count is fixed for this exercise; a new card remounts the component.
	// svelte-ignore state_referenced_locally
	let rows: string[] = $state(Array.from({ length: spec.required }, () => ''));
	let refs: (HTMLInputElement | undefined)[] = $state([]);
	let picked: number[] = $state([]);

	const typed = $derived(rows.map((r) => r.trim()).filter((r) => r !== ''));
	const shown = $derived(Math.min(picked.length, spec.required));

	$effect(() => {
		if (spec.entry === 'type') {
			response = typed.length === 0 ? null : { shape: 'list', typed: [...typed], picked: [] };
		} else {
			response = picked.length === 0 ? null : { shape: 'list', typed: [], picked: [...picked] };
		}
	});
	$effect(() => {
		if (spec.entry === 'type' && verdict === null) refs[0]?.focus({ preventScroll: true });
	});

	/** Enter: the next empty row, or check once every row is filled. */
	function enter(): void {
		if (verdict !== null) return;
		const empty = rows.findIndex((r) => r.trim() === '');
		if (empty >= 0) refs[empty]?.focus();
		else if (response) onsubmit();
	}

	function toggle(i: number): void {
		picked = picked.includes(i) ? picked.filter((p) => p !== i) : [...picked, i];
	}

	function stateOf(i: number): ChipState {
		const isPicked = picked.includes(i);
		if (verdict === null) return isPicked ? 'selected' : 'default';
		const right = spec.correct.includes(i);
		if (isPicked) return right ? 'correct' : 'wrong';
		return right ? 'revealed' : 'default';
	}
</script>

<Stack gap="md">
	<span class="stamp"><Stamp text="List card" /></span>
	{#if spec.entry === 'type'}
		<form
			onsubmit={(event) => {
				event.preventDefault();
				enter();
			}}
		>
			<Stack gap="sm">
				{#each rows as _row, i (i)}
					<Input
						label="Item {i + 1} of {spec.required}"
						hideLabel
						bind:value={rows[i]}
						bind:ref={refs[i]}
						disabled={verdict !== null}
						placeholder="Item {i + 1}"
						enterkeyhint={i === spec.required - 1 ? 'done' : 'next'}
						data-list-row={i}
					/>
				{/each}
			</Stack>
			<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
		</form>
	{:else}
		<PawTrail
			total={spec.required}
			current={shown}
			label="{picked.length} of {spec.required} picked"
			meta="{picked.length}/{spec.required}"
		/>
		<div class="chips" role="group" aria-label="Items to pick">
			{#each spec.options as option, i (i)}
				<span data-option-index={i}>
					<TapChip
						text={option.text}
						state={stateOf(i)}
						disabled={verdict !== null}
						onclick={() => toggle(i)}
					/>
				</span>
			{/each}
		</div>
	{/if}
</Stack>

<style>
	.stamp {
		justify-self: start;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-sm);
	}
</style>
