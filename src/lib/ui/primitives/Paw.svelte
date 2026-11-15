<!--
	Paw glyph, the shared motif: one pad plus four toes, filled with the current colour (DESIGN §7).
	Solid by default; `outline` draws it as a stroke (PawRing "current"), `dashed` as a dashed
	stroke (PawTrail upcoming).
	Decorative.
-->
<script lang="ts">
	let {
		size = 24,
		outline = false,
		dashed = false
	}: { size?: number; outline?: boolean; dashed?: boolean } = $props();
</script>

<svg
	class="paw"
	class:outline={outline || dashed}
	class:dashed
	viewBox="0 0 24 24"
	width={size}
	height={size}
	aria-hidden="true"
	focusable="false"
>
	<path d="M12,22 C7,22 5,18 7,15 C9,12 10,11 12,11 C14,11 15,12 17,15 C19,18 17,22 12,22 Z" />
	<circle cx="6" cy="9" r="2.3" />
	<circle cx="10" cy="5.5" r="2.4" />
	<circle cx="14" cy="5.5" r="2.4" />
	<circle cx="18" cy="9" r="2.3" />
</svg>

<style>
	.paw {
		display: block;
		flex: none;
		fill: currentcolor;
	}

	.outline {
		fill: none;
		stroke: currentcolor;
		stroke-width: 1.5;
	}

	.dashed {
		stroke-dasharray: 2 1.5;
	}
</style>
