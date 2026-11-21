<!--
	Import preview, images and diagrams (Decisions log "Phase 6 Q9", "Phase 6 Q10–Q13"): one line
	summing up the images the reply names but that weren't attached (those blocks are left out), and
	the diagrams drawn differently from one of the same name already in the course (both are kept).
-->
<script lang="ts">
	import type { ChangedDiagram } from '#lib/services/import-service.ts';
	import { countOf } from '#lib/util/plural.ts';
	import Disclosure from '../components/Disclosure.svelte';
	import Button from '../primitives/Button.svelte';

	interface Props {
		missingImages: readonly string[];
		changedDiagrams: readonly ChangedDiagram[];
		onJumpToLine: (line: number) => void;
	}

	let { missingImages, changedDiagrams, onJumpToLine }: Props = $props();

	const isOne = $derived(missingImages.length === 1);
</script>

{#if missingImages.length > 0}
	<p data-missing-images>
		{countOf(missingImages.length, 'image')} not found: {missingImages.join(', ')}. Attach
		{isOne ? 'it' : 'them'} and paste again to add {isOne ? 'its cards' : 'their cards'}.
	</p>
{/if}

{#if changedDiagrams.length > 0}
	<Disclosure
		summary="{countOf(
			changedDiagrams.length,
			'changed diagram',
			'changed diagrams'
		)}: the course has one with the same name, drawn differently. Both are kept."
	>
		{#each changedDiagrams as diagram (diagram.line)}
			<Button variant="ghost" onclick={() => onJumpToLine(diagram.line)}>
				Line {diagram.line}: {diagram.name} ({diagram.topic})
			</Button>
		{/each}
	</Disclosure>
{/if}

<style>
	p {
		margin: 0;
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}
</style>
