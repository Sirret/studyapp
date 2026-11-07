<!--
	A style-guide section: its title, then the same content in the light and the dark theme, so
	every piece is reviewed (and screenshot-tested) in both. Dev builds only (DESIGN §13.4).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		title,
		layer,
		children
	}: { id: string; title: string; layer: string; children: Snippet } = $props();
</script>

<section class="section" {id} data-guide-section={id} aria-labelledby="{id}-title">
	<header class="header">
		<span class="layer">{layer}</span>
		<h2 id="{id}-title">{title}</h2>
	</header>
	<div class="themes">
		{#each ['light', 'dark'] as theme (theme)}
			<div class="pane" data-theme={theme} data-guide-theme={theme}>
				<span class="theme-name">{theme}</span>
				{@render children()}
			</div>
		{/each}
	</div>
</section>

<style>
	.section {
		display: grid;
		gap: var(--gap-md);
		padding: var(--gap-xl) 0;
	}

	.header {
		display: grid;
		gap: var(--gap-xs);
		padding: 0 var(--screen-gutter);
	}

	.layer {
		color: var(--text-muted);
		font-size: var(--type-caption-size);
		font-weight: var(--type-caption-weight);
		text-transform: uppercase;
	}

	h2 {
		margin: 0;
		font-size: var(--type-title-size);
		line-height: var(--type-title-leading);
		font-weight: var(--type-title-weight);
	}

	.themes {
		display: grid;
		gap: var(--gap-md);
	}

	@media (min-width: 1024px) {
		.themes {
			grid-template-columns: 1fr 1fr;
		}
	}

	.pane {
		display: grid;
		gap: var(--gap-lg);
		align-content: start;
		padding: var(--gap-lg) var(--screen-gutter);
		background: var(--bg);
		color: var(--text);
	}

	.theme-name {
		color: var(--text-muted);
		font-size: var(--type-caption-size);
		font-weight: var(--type-caption-weight);
	}
</style>
