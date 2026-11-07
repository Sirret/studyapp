<!-- Paw print motif, filled with the current colour (DESIGN §11.1). Decorative. -->
<script lang="ts">
	let { size = 24 }: { size?: number } = $props();
</script>

<svg
	class="paw"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="currentColor"
	aria-hidden="true"
	focusable="false"
>
	<path
		d="M12 11.2c2.9 0 5.4 2.2 5.4 4.6 0 1.8-1.4 2.6-3 2.6-.9 0-1.6-.4-2.4-.4s-1.5.4-2.4.4c-1.6 0-3-.8-3-2.6 0-2.4 2.5-4.6 5.4-4.6z"
	/>
	<ellipse cx="6.6" cy="9.6" rx="1.7" ry="2.2" transform="rotate(-20 6.6 9.6)" />
	<ellipse cx="10" cy="6.6" rx="1.7" ry="2.3" />
	<ellipse cx="14" cy="6.6" rx="1.7" ry="2.3" />
	<ellipse cx="17.4" cy="9.6" rx="1.7" ry="2.2" transform="rotate(20 17.4 9.6)" />
</svg>

<style>
	.paw {
		display: block;
		flex: none;
	}
</style>
