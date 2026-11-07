<script lang="ts">
	import ComponentsGuide from '#lib/ui/styleguide/ComponentsGuide.svelte';
	import DelightGuide from '#lib/ui/styleguide/DelightGuide.svelte';
	import LayoutGuide from '#lib/ui/styleguide/LayoutGuide.svelte';
	import PrimitivesGuide from '#lib/ui/styleguide/PrimitivesGuide.svelte';
	import TokensGuide from '#lib/ui/styleguide/TokensGuide.svelte';
	import YukiGuide from '#lib/ui/styleguide/YukiGuide.svelte';
</script>

<svelte:head><title>Style guide</title></svelte:head>

<main>
	<TokensGuide />
	<PrimitivesGuide />
	<ComponentsGuide />
	<YukiGuide />
	<DelightGuide />
	<LayoutGuide />
</main>
