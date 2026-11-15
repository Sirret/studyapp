<!--
	End-of-session summary (DESIGN §6 Study session): Yuki celebrating, cards practised, how many are
	now exam-ready or secure, and what comes next. No scores against anyone. `figure` lets the caller
	animate the numbers (count-up) and `footer` add the paw walk.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Yuki from './yuki/Yuki.svelte';

	let {
		practised,
		ready,
		next,
		companion = true,
		figure,
		footer,
		actions
	}: {
		practised: number;
		ready: number;
		next: string;
		companion?: boolean;
		figure?: Snippet<[number]>;
		footer?: Snippet;
		actions: Snippet;
	} = $props();
</script>

<section class="summary" aria-labelledby="summary-title" data-session-summary>
	{#if companion}<Yuki state="celebrate" size={140} />{/if}
	<h2 id="summary-title">Session done</h2>
	<dl class="stats">
		<div>
			<dt>Cards practised</dt>
			<dd>
				{#if figure}{@render figure(practised)}{:else}{practised}{/if}
			</dd>
		</div>
		<div>
			<dt>Exam-ready or secure</dt>
			<dd>
				{#if figure}{@render figure(ready)}{:else}{ready}{/if}
			</dd>
		</div>
	</dl>
	<p class="next">{next}</p>
	<div class="actions">{@render actions()}</div>
	{#if footer}{@render footer()}{/if}
</section>

<style>
	.summary {
		position: relative;
		display: grid;
		justify-items: center;
		gap: var(--gap-md);
		overflow: hidden;
		padding: var(--gap-xl) var(--gap-lg) var(--gap-2xl);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
		font-family: var(--font-body);
		box-shadow: var(--shadow-raised);
		text-align: center;
	}

	h2 {
		margin: 0;
		color: var(--text-strong);
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--type-display-size);
		line-height: var(--type-display-leading);
		font-weight: var(--type-display-weight);
	}

	.stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--gap-md);
		width: 100%;
		margin: 0;
	}

	dt {
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		line-height: var(--type-caption-leading);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
	}

	dd {
		margin: 0;
		color: var(--text-strong);
		font-family: var(--font-display);
		font-size: var(--type-display-size);
		font-weight: var(--type-display-weight);
		font-variant-numeric: tabular-nums;
	}

	.next {
		margin: 0;
	}

	.actions {
		display: grid;
		gap: var(--gap-sm);
		width: 100%;
	}
</style>
