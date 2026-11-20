<!--
	Meet the terms (SESSION_NOTES §C; Decisions log "Phase 8.6 Q6"; DESIGN §12 "Meet the terms,
	Match check"): before a section is read, its 2–4 key terms as small cards — the term, what it
	means, and a tiny example when the section has one — then one button to the matching check.
	Two columns from tablet width.
-->
<script lang="ts">
	import type { MeetTermView } from '#lib/services/learn-types.ts';
	import Button from '../primitives/Button.svelte';
	import KeyTerm from './KeyTerm.svelte';

	let {
		terms,
		busy = false,
		onstart
	}: {
		terms: MeetTermView[];
		busy?: boolean;
		/** Starts the matching check. */
		onstart: () => void;
	} = $props();
	const id = $props.id();
</script>

<section class="meet" aria-labelledby="{id}-title">
	<h2 id="{id}-title">Meet the terms</h2>
	<p class="lead">
		{terms.length} words this section leans on. Have a look, then match them up.
	</p>
	<ul class="terms">
		{#each terms as term (term.noteId)}
			<li class="term" data-meet-term>
				<span class="name"><KeyTerm>{term.term}</KeyTerm></span>
				<span class="meaning">{term.meaning}</span>
				{#if term.example}<span class="example">e.g. {term.example}</span>{/if}
			</li>
		{/each}
	</ul>
	<Button full size="session" meta="1 check" loading={busy} onclick={onstart} data-meet-start>
		Match them up
	</Button>
</section>

<style>
	.meet {
		display: grid;
		gap: var(--gap-lg);
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--type-title-size);
		line-height: var(--type-title-leading);
		font-weight: var(--type-title-weight);
	}

	.lead {
		margin: 0;
		color: var(--text-soft);
		font-size: var(--type-body-size);
		line-height: var(--type-body-leading);
	}

	.terms {
		display: grid;
		gap: var(--gap-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	@media (min-width: 768px) {
		.terms {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.term {
		display: grid;
		align-content: start;
		gap: var(--gap-xs);
		padding: var(--gap-lg);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-md);
		background: var(--surface);
		box-shadow: var(--shadow-raised);
	}

	.name {
		font-size: var(--type-answer-size);
		line-height: var(--type-answer-leading);
	}

	.meaning {
		color: var(--text);
		font-size: var(--type-body-size);
		line-height: var(--type-body-leading);
	}

	.example {
		color: var(--text-soft);
		font-size: var(--type-small-size);
		font-style: italic;
		line-height: var(--type-small-leading);
	}
</style>
