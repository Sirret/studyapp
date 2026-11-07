<!-- Snowflake motif, stroked with the current colour (DESIGN §11.1). Decorative. -->
<script lang="ts">
	let { size = 24 }: { size?: number } = $props();
</script>

<svg
	class="snowflake"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	aria-hidden="true"
	focusable="false"
>
	<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
	<path
		d="M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5M4 10.4l2.6.1 1.2-2.4M20 13.6l-2.6-.1-1.2 2.4M4 13.6l2.6-.1 1.2 2.4M20 10.4l-2.6.1-1.2-2.4"
	/>
</svg>

<style>
	.snowflake {
		display: block;
		flex: none;
	}
</style>
