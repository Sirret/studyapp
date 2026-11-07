<!-- A 3/4 crescent moon in `--moon` (DESIGN §11.1). Decorative. -->
<script lang="ts">
	let { size = 24 }: { size?: number } = $props();
</script>

<svg
	class="moon"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	aria-hidden="true"
	focusable="false"
>
	<path d="M15.5 2.8A9.5 9.5 0 1 0 21.2 15 7.6 7.6 0 0 1 15.5 2.8z" />
</svg>

<style>
	.moon {
		display: block;
		flex: none;
		fill: var(--moon);
	}
</style>
