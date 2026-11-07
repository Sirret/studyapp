<!--
	Round summary (DESIGN §5, BUILD_PLAN §6.4): between rounds — the round number, cards finished,
	carried over and left, and three choices: Continue, Take a break, Stop here. After long study
	one line suggests a break. Take a break shows a countdown whose Continue works at any time:
	a suggestion, never a lock (CLAUDE.md rule 11).
-->
<script lang="ts">
	import Button from '../primitives/Button.svelte';
	import Yuki from './yuki/Yuki.svelte';

	type Summary = {
		index: number;
		finished: number;
		carried: number;
		remaining: number;
		suggestBreak: boolean;
		breakMinutes: number;
	};

	let {
		summary,
		companion = true,
		oncontinue,
		onstop
	}: {
		summary: Summary;
		companion?: boolean;
		oncontinue: (options: { afterBreak: boolean }) => void;
		onstop: () => void;
	} = $props();

	const SECOND_MS = 1000;
	const SECONDS_PER_MINUTE = 60;
	let breakLeft: number | null = $state(null);

	$effect(() => {
		if (breakLeft === null) return;
		const timer = setInterval(() => {
			if (breakLeft !== null && breakLeft > 0) breakLeft -= 1;
		}, SECOND_MS);
		return () => clearInterval(timer);
	});

	const clock = $derived(
		breakLeft === null
			? ''
			: `${Math.floor(breakLeft / SECONDS_PER_MINUTE)}:${String(breakLeft % SECONDS_PER_MINUTE).padStart(2, '0')}`
	);
</script>

<section class="round" aria-labelledby="round-title" data-round-summary={summary.index}>
	{#if companion}<Yuki state={breakLeft === null ? 'idle' : 'sleepy'} size={96} />{/if}
	<h2 id="round-title">Round {summary.index} done</h2>
	<dl class="stats">
		<div>
			<dt>Finished</dt>
			<dd>{summary.finished}</dd>
		</div>
		<div>
			<dt>Carried over</dt>
			<dd>{summary.carried}</dd>
		</div>
		<div>
			<dt>Left</dt>
			<dd>{summary.remaining}</dd>
		</div>
	</dl>
	{#if breakLeft !== null}
		<p class="timer" role="timer" aria-live="off">{clock}</p>
		<p class="hint">Stretch, drink some water. Continue whenever you're ready.</p>
		<Button full onclick={() => oncontinue({ afterBreak: true })}>Continue</Button>
	{:else}
		{#if summary.suggestBreak}
			<p class="hint">Good moment for a {summary.breakMinutes}-minute break.</p>
		{/if}
		<div class="actions">
			<Button full onclick={() => oncontinue({ afterBreak: false })}>Continue</Button>
			<Button
				full
				variant="secondary"
				onclick={() => (breakLeft = summary.breakMinutes * SECONDS_PER_MINUTE)}>Take a break</Button
			>
			<Button full variant="ghost" onclick={onstop}>Stop here</Button>
		</div>
	{/if}
</section>

<style>
	.round {
		display: grid;
		justify-items: center;
		gap: var(--gap-md);
		padding: var(--gap-xl) var(--gap-lg);
		border: var(--hairline) solid var(--card-edge);
		border-radius: var(--r-xl);
		background: var(--surface);
		box-shadow: var(--shadow-1);
		text-align: center;
	}

	h2 {
		margin: 0;
		font-size: var(--type-title-size);
		line-height: var(--type-title-leading);
		font-weight: var(--type-title-weight);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--gap-sm);
		width: 100%;
		margin: 0;
	}

	dt {
		color: var(--text-muted);
		font-size: var(--type-caption-size);
		font-weight: var(--type-caption-weight);
	}

	dd {
		margin: 0;
		font-size: var(--type-title-size);
		font-weight: var(--type-title-weight);
		font-variant-numeric: tabular-nums;
	}

	.timer {
		margin: 0;
		font-size: var(--type-display-size);
		font-weight: var(--type-display-weight);
		font-variant-numeric: tabular-nums;
	}

	.hint {
		margin: 0;
		color: var(--text-muted);
	}

	.actions {
		display: grid;
		gap: var(--gap-sm);
		width: 100%;
	}
</style>
