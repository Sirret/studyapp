<!--
	Hanging tag (DESIGN §7): a kraft label with a punched hole, tilted about 4°, with the printed
	raised-paper shadow. Hero greetings only. It sways gently (§8 `sway`: 4° ↔ 1.5°, 5 s); still
	under reduced motion.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<span class="tag">
	<span class="hole" aria-hidden="true"></span>
	<span class="text">{@render children()}</span>
</span>

<style>
	.tag {
		display: inline-flex;
		align-items: center;
		gap: var(--gap-sm);
		padding: var(--gap-sm) var(--gap-lg) var(--gap-sm) var(--gap-md);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-xs);
		background: var(--surface-tag);
		box-shadow: var(--shadow-raised);
		color: var(--text);
		font-family: var(--font-wordmark);
		font-size: var(--type-wordmark-size);
		letter-spacing: var(--type-heading-tracking);
		transform: rotate(var(--tag-tilt));
		transform-origin: left center;
		animation: sway var(--dur-sway) ease-in-out infinite alternate;
	}

	.hole {
		flex: none;
		width: var(--size-px-10);
		height: var(--size-px-10);
		border: var(--border-dashed) solid var(--outline);
		border-radius: var(--r-full);
		background: var(--bg);
	}

	@keyframes sway {
		from {
			transform: rotate(var(--tag-tilt));
		}

		to {
			transform: rotate(var(--sway-rest));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tag {
			animation: none !important;
		}
	}
</style>
