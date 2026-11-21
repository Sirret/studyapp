<!--
	"Show original" (BUILD_PLAN §7.2): after a diagram question is checked, a link opens the picture
	the diagram was made from in a Sheet. The image loads only when the Sheet opens.
-->
<script lang="ts">
	import type { MediaId } from '#lib/services/study-types.ts';
	import Sheet from '../components/Sheet.svelte';
	import Button from '../primitives/Button.svelte';
	import { watchMedia, type MediaLoader } from './media-url.ts';

	let { mediaId, title, media }: { mediaId: MediaId; title: string; media: MediaLoader } = $props();

	let open = $state(false);
	let src: string | null = $state(null);

	$effect(() => {
		if (!open) return;
		return watchMedia(media, mediaId, (url) => (src = url ?? ''));
	});
</script>

<Button variant="ghost" onclick={() => (open = true)} data-show-original>Show original</Button>
<Sheet bind:open title="Original: {title}">
	{#if src}
		<img class="original" {src} alt="Original picture of {title}" />
	{:else}
		<p class="note">{src === null ? 'Loading image…' : 'Image not found'}</p>
	{/if}
	<Button variant="secondary" full onclick={() => (open = false)}>Close</Button>
</Sheet>

<style>
	.original {
		display: block;
		width: 100%;
		height: auto;
		margin-bottom: var(--gap-lg);
		border: var(--hairline) solid var(--line);
		border-radius: var(--r-sm);
	}

	.note {
		margin: 0 0 var(--gap-lg);
		color: var(--text-soft);
	}
</style>
