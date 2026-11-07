<script lang="ts">
	import type { Snippet } from 'svelte';
	import { APP_NAME } from '#lib/config/defaults.ts';
	import '#lib/design/tokens.css';
	import AppRoot from '#lib/ui/layout/AppRoot.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<AppRoot>
	{@render children()}
</AppRoot>
