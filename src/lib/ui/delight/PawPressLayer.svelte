<!--
	Paw press (DESIGN §11.2): a tap on anything marked `data-paw` leaves a small paw print at the
	touch point that grows and fades in 300 ms. Runs beside the tap, never blocks it, and does
	nothing under reduced motion. One listener for the whole app, so controls stay plain.
-->
<script lang="ts">
	import Paw from '../motifs/Paw.svelte';

	type Press = { id: number; x: number; y: number };

	const PAW_PX = 20;
	let presses: Press[] = $state([]);
	let next = 0;

	$effect(() => {
		const reduced = matchMedia('(prefers-reduced-motion: reduce)');
		const onDown = (event: PointerEvent) => {
			if (reduced.matches || !(event.target instanceof Element)) return;
			if (!event.target.closest('[data-paw]:not(:disabled)')) return;
			presses = [...presses, { id: next++, x: event.clientX, y: event.clientY }];
		};
		document.addEventListener('pointerdown', onDown, { passive: true });
		return () => document.removeEventListener('pointerdown', onDown);
	});

	function done(id: number): void {
		presses = presses.filter((press) => press.id !== id);
	}
</script>

<div class="layer" aria-hidden="true">
	{#each presses as press (press.id)}
		<span
			class="press"
			style:translate="{press.x}px {press.y}px"
			onanimationend={() => done(press.id)}
		>
			<Paw size={PAW_PX} />
		</span>
	{/each}
</div>

<style>
	.layer {
		position: fixed;
		inset: 0;
		z-index: var(--z-effect);
		pointer-events: none;
	}

	.press {
		position: absolute;
		top: calc(var(--size-px-20) / -2);
		left: calc(var(--size-px-20) / -2);
		color: var(--paw-press);
		animation: press var(--dur-paw-press) var(--ease-out) forwards;
	}

	@keyframes press {
		from {
			opacity: 1;
			transform: scale(0.6);
		}

		to {
			opacity: 0;
			transform: scale(1);
		}
	}
</style>
