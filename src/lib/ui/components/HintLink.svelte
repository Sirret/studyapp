<!--
	Hint link (SESSION_NOTES J micro hint; Decisions log "Phase 8.6 Q10"; DESIGN §7 link button):
	a link button under the exercise, labelled with what the hint gives ("Hint · first letters").
	One per attempt: once asked, it is replaced by the hint itself (revealed text, or a note that a
	wrong option was removed), announced politely. The answer is then logged `hinted`, so it never
	counts toward the criterion; the label doesn't say so, to keep it free of guilt.
-->
<script lang="ts">
	import type { MicroHint } from '#lib/services/study-types.ts';
	import Button from '../primitives/Button.svelte';

	let {
		label,
		hint = null,
		disabled = false,
		onrequest
	}: {
		label: string;
		/** The hint once asked for; null before. */
		hint?: MicroHint | null;
		disabled?: boolean;
		onrequest: () => void;
	} = $props();
</script>

<div class="hint-link" aria-live="polite" data-hint-link>
	{#if hint === null}
		<Button variant="ghost" {disabled} onclick={onrequest} data-hint-request>{label}</Button>
	{:else if hint.kind === 'reveal'}
		<p class="reveal" data-hint-text><span class="sr-only">Hint: </span>{hint.text}</p>
	{:else if hint.kind === 'remove'}
		<p class="note" data-hint-text>One wrong answer removed.</p>
	{/if}
</div>

<style>
	.hint-link {
		display: grid;
		justify-items: center;
		min-height: var(--touch-min);
	}

	p {
		margin: 0;
		line-height: var(--touch-min);
		text-align: center;
	}

	.reveal {
		color: var(--text);
		font-family: var(--font-label);
		font-size: var(--type-body-size);
		letter-spacing: var(--type-label-tracking-wide);
		text-decoration: underline var(--keyterm) var(--border-width);
		text-underline-offset: var(--gap-2xs);
		overflow-wrap: anywhere;
	}

	.note {
		color: var(--text-soft);
		font-size: var(--type-small-size);
		font-style: italic;
	}
</style>
