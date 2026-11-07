<!--
	Lucide icon at a standard size (DESIGN §3.3): 20 px in lists, 24 px in navigation, 2 px
	rounded stroke. Decorative unless `label` is given.
-->
<script lang="ts">
	import type { Component } from 'svelte';

	type IconProps = { size?: number; strokeWidth?: number; 'aria-hidden'?: boolean };

	let {
		icon,
		size = 'list',
		label
	}: { icon: Component<IconProps>; size?: 'list' | 'nav'; label?: string } = $props();

	const PX = { list: 20, nav: 24 } as const;
	const IconComponent = $derived(icon);
</script>

<span class="icon" role={label ? 'img' : undefined} aria-label={label}>
	<IconComponent size={PX[size]} strokeWidth={2} aria-hidden={true} />
</span>

<style>
	.icon {
		display: inline-flex;
		flex: none;
	}
</style>
