<!--
	Exercise card (DESIGN §5): the one frame every exercise kind uses — instruction, progress dots
	top-right, optional context lines (a worked example's shown steps), the prompt, the body, then
	feedback. Yuki never appears inside it (§7.3).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import ProgressDots from './ProgressDots.svelte';

	let {
		instruction,
		prompt,
		context = [],
		dots,
		body,
		feedback
	}: {
		instruction: string;
		prompt: string;
		context?: string[];
		dots?: { count: number; required: number };
		body: Snippet;
		feedback?: Snippet;
	} = $props();
</script>

<article class="exercise" aria-labelledby="exercise-prompt">
	<header class="head">
		<span class="instruction">{instruction}</span>
		{#if dots}<ProgressDots count={dots.count} required={dots.required} />{/if}
	</header>
	{#if context.length > 0}
		<ol class="context">
			{#each context as line, i (i)}<li>{line}</li>{/each}
		</ol>
	{/if}
	<p class="prompt" id="exercise-prompt">{prompt}</p>
	<div class="body">{@render body()}</div>
	{#if feedback}{@render feedback()}{/if}
</article>

<style>
	.exercise {
		display: grid;
		gap: var(--gap-lg);
		padding: var(--gap-lg);
		border: var(--hairline) solid var(--card-edge);
		border-radius: var(--r-lg);
		background: var(--surface);
		box-shadow: var(--shadow-1);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap-md);
	}

	.instruction {
		color: var(--text-muted);
		font-size: var(--type-small-size);
		line-height: var(--type-small-leading);
		font-weight: var(--type-small-weight);
	}

	.context {
		display: grid;
		gap: var(--gap-xs);
		margin: 0;
		padding: var(--gap-md) var(--gap-md) var(--gap-md) var(--gap-2xl);
		border-radius: var(--r-sm);
		background: var(--surface-alt);
		color: var(--text-muted);
		font-size: var(--type-small-size);
		line-height: var(--type-small-leading);
	}

	.prompt {
		margin: 0;
		font-size: var(--type-answer-size);
		line-height: var(--type-answer-leading);
		font-weight: var(--type-answer-weight);
		overflow-wrap: anywhere;
		white-space: pre-line;
	}

	.body {
		display: grid;
		gap: var(--gap-sm);
	}
</style>
