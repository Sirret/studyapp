<!--
	Progress strip (DESIGN §7 PawTrail, for long sessions): a dashed path walked by a row of ink paws,
	a Courier "12/30" counter, and Yuki trotting along (hidden when Yuki is off). PawTrail replaces
	bars, so there is no filled bar. The paws and runner move by transform only. Read as "12 of 30 cards".
-->
<script lang="ts">
	import Yuki from './yuki/Yuki.svelte';

	let { done, total, runner = true }: { done: number; total: number; runner?: boolean } = $props();

	const share = $derived(total === 0 ? 0 : Math.min(done / total, 1));
	let trotting = $state(false);
	let last = 0;

	$effect(() => {
		if (done !== last) {
			trotting = done > last;
			last = done;
		}
	});
</script>

<div
	class="strip"
	role="progressbar"
	aria-valuemin={0}
	aria-valuemax={total}
	aria-valuenow={done}
	aria-label="{done} of {total} cards"
	style:--share={share}
>
	<div class="track">
		<div class="fill"><div class="paws"></div></div>
	</div>
	<span class="count" aria-hidden="true">{done}/{total}</span>
	{#if runner}
		<div class="lane" aria-hidden="true">
			<span class="runner" onanimationend={() => (trotting = false)} class:trotting>
				<Yuki state={trotting ? 'trot' : 'idle'} size={28} still={!trotting} />
			</span>
		</div>
	{/if}
</div>

<style>
	.strip {
		--strip-height: var(--size-px-16);

		position: relative;
		display: flex;
		align-items: center;
		gap: var(--gap-sm);
		padding-top: var(--space-20);
		/* The runner moves in container units and never widens the page (it would scroll sideways). */
		container-type: inline-size;
		overflow-x: clip;
	}

	.track {
		position: relative;
		flex: 1;
		overflow: hidden;
		height: var(--strip-height);
	}

	/* Upcoming path: a dashed faint line; the walked part is a row of ink paws over it. */
	.track::before {
		content: '';
		position: absolute;
		inset: 50% 0 auto;
		border-top: var(--border-dashed) dashed var(--decor);
	}

	/* A sliding window: .fill moves right by the walked share and .paws moves back the same
	   amount, so the paws stay put and only the window over them grows (transform only). */
	.fill,
	.paws {
		height: 100%;
		transition: transform var(--dur-trot) var(--ease-out);
	}

	.fill {
		position: relative;
		overflow: hidden;
		background: var(--bg);
		transform: translateX(calc((var(--share) - 1) * 100%));
	}

	.paws {
		background: var(--text);
		mask: var(--mask-paw) repeat-x left center / var(--strip-height) var(--strip-height);
		transform: translateX(calc((1 - var(--share)) * 100%));
	}

	.count {
		flex: none;
		color: var(--text);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		font-weight: var(--type-label-weight);
		font-variant-numeric: tabular-nums;
	}

	.lane {
		position: absolute;
		inset: 0 auto auto 0;
		transform: translateX(calc(var(--share) * (100cqw - var(--size-px-64))));
		transition: transform var(--dur-trot) var(--ease-out);
	}

	.runner {
		position: absolute;
		top: calc(var(--size-px-10) * -1);
		left: 0;
	}
</style>
