<!--
	Progress strip (DESIGN §5, §7.3, §11.2): a 10 px track with the moon at the end, a fill with a
	faint paw trail (Yuki full), and Yuki trotting along the fill (hidden when Yuki is off). The
	fill and runner move by transform only. Read as "12 of 30 cards".
-->
<script lang="ts">
	import Moon from '../motifs/Moon.svelte';
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
		<div class="fill"></div>
	</div>
	<span class="moon"><Moon size={18} /></span>
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
		--strip-height: var(--size-px-10);

		position: relative;
		padding-top: var(--space-20);
		padding-right: var(--size-px-6);
		/* The runner moves in container units and never widens the page (it would scroll sideways). */
		container-type: inline-size;
		overflow-x: clip;
	}

	.track {
		height: var(--strip-height);
		overflow: hidden;
		border-radius: var(--r-pill);
		background: var(--primary-soft);
	}

	.fill {
		position: relative;
		height: 100%;
		border-radius: var(--r-pill);
		background: var(--primary);
		transform: scaleX(var(--share));
		transform-origin: left center;
		transition: transform var(--dur-trot) var(--ease-out);
	}

	:global([data-companion='full']) .fill::after {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--paw-trail);
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 11.2c2.9 0 5.4 2.2 5.4 4.6 0 1.8-1.4 2.6-3 2.6-.9 0-1.6-.4-2.4-.4s-1.5.4-2.4.4c-1.6 0-3-.8-3-2.6 0-2.4 2.5-4.6 5.4-4.6z'/%3E%3Cellipse cx='6.6' cy='9.6' rx='1.7' ry='2.2'/%3E%3Cellipse cx='10' cy='6.6' rx='1.7' ry='2.3'/%3E%3Cellipse cx='14' cy='6.6' rx='1.7' ry='2.3'/%3E%3Cellipse cx='17.4' cy='9.6' rx='1.7' ry='2.2'/%3E%3C/svg%3E")
			repeat-x left center / var(--strip-height) var(--strip-height);
	}

	.moon {
		position: absolute;
		right: 0;
		bottom: calc(var(--size-px-4) * -1);
	}

	.lane {
		position: absolute;
		inset: 0 auto auto 0;
		transform: translateX(calc(var(--share) * (100cqw - var(--size-px-20))));
		transition: transform var(--dur-trot) var(--ease-out);
	}

	.runner {
		position: absolute;
		top: calc(var(--size-px-10) * -1);
		left: 0;
	}
</style>
