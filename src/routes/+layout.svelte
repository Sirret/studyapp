<script lang="ts">
	import type { Snippet } from 'svelte';
	import { APP_NAME, PWA_BACKGROUND_COLOR } from '#lib/config/defaults.ts';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<title>{APP_NAME}</title>
	<meta name="theme-color" content={PWA_BACKGROUND_COLOR} />
</svelte:head>

{@render children()}
