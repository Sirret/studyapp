<!--
	Count-up (DESIGN §11.2): a summary number counts up from 0 over --dur-count-up. Shows the final value
	at once under reduced motion or when `play` is false. Screen readers get the final value.
-->
<script lang="ts">
	let { value, play = true }: { value: number; play?: boolean } = $props();

	let shown = $state(0);

	$effect(() => {
		const target = value;
		// The token's value; reduced motion sets it to 0ms.
		const duration = Number.parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue('--dur-count-up')
		);
		if (!play || !(duration > 0) || target === 0) {
			shown = target;
			return;
		}
		const start = performance.now();
		let frame = 0;
		const step = (now: number) => {
			const t = Math.min((now - start) / duration, 1);
			shown = Math.round(target * (1 - (1 - t) ** 3));
			if (t < 1) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});
</script>

<span class="count" aria-label={String(value)}><span aria-hidden="true">{shown}</span></span>

<style>
	.count {
		font-variant-numeric: tabular-nums;
	}
</style>
