<script module lang="ts">
	/** No image store (the style guide without samples): every image reads as missing. */
	export const noMedia: MediaLoader = () => Promise.resolve(null);
</script>

<!--
	A question's figure, whatever its kind (BUILD_PLAN §7): an image with hide boxes, or a drawn
	diagram. Loads the image through `media` and frees its URL when it goes. `reveal` is the answer,
	written into the asked part once the question is checked.
-->
<script lang="ts">
	import type { Figure } from '#lib/services/study-types.ts';
	import DiagramFigure from './DiagramFigure.svelte';
	import { occlusionBoxes } from './figure-geometry.ts';
	import { watchMedia, type MediaLoader } from './media-url.ts';
	import OcclusionFigure from './OcclusionFigure.svelte';

	let {
		figure,
		media = noMedia,
		reveal
	}: { figure: Figure; media?: MediaLoader; reveal?: string } = $props();

	let src: string | null = $state(null);

	$effect(() => {
		if (figure.kind !== 'occlusion') return;
		return watchMedia(media, figure.mediaId, (url) => (src = url ?? ''));
	});
</script>

{#if figure.kind === 'occlusion'}
	<OcclusionFigure {src} title={figure.title} boxes={occlusionBoxes(figure, reveal)} />
{:else}
	<DiagramFigure {figure} {reveal} />
{/if}
