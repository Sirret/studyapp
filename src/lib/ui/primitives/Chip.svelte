<!--
	Chip (DESIGN §7): a paper pill with a 1.5 px outline in Literata 15, always with its text. A
	course colour tints the fill. As a tab (`onselect` given) it is a toggle button; selected fills
	ink with a paper label (`--btn-primary-*`, so lamp-light inverts it the same way).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CourseColor } from '#lib/design/tokens.ts';

	type Props = {
		color?: CourseColor | 'neutral';
		selected?: boolean;
		onselect?: () => void;
		children: Snippet;
	};

	let { color = 'neutral', selected = false, onselect, children }: Props = $props();
</script>

{#if onselect}
	<button
		type="button"
		class="chip tab {color}"
		class:selected
		aria-pressed={selected}
		onclick={onselect}
		data-paw
	>
		{@render children()}
	</button>
{:else}
	<span class="chip {color}">{@render children()}</span>
{/if}

<style>
	.chip {
		--chip-bg: var(--surface);
		--chip-fg: var(--text);

		display: inline-flex;
		align-items: center;
		gap: var(--gap-xs);
		min-height: var(--chip-height);
		padding: 0 var(--gap-md);
		border: var(--border-dashed) solid var(--outline);
		border-radius: var(--r-pill);
		background: var(--chip-bg);
		color: var(--chip-fg);
		font-family: var(--font-body);
		font-size: var(--type-chip-size);
		font-weight: var(--type-body-weight);
		line-height: var(--type-caption-leading);
		white-space: nowrap;
	}

	.lavender,
	.peach,
	.sage,
	.sky,
	.rose,
	.butter {
		--chip-fg: var(--on-course);
	}

	.lavender {
		--chip-bg: var(--course-lavender);
	}

	.peach {
		--chip-bg: var(--course-peach);
	}

	.sage {
		--chip-bg: var(--course-sage);
	}

	.sky {
		--chip-bg: var(--course-sky);
	}

	.rose {
		--chip-bg: var(--course-rose);
	}

	.butter {
		--chip-bg: var(--course-butter);
	}

	.tab {
		min-height: var(--touch-min);
		cursor: pointer;
		touch-action: manipulation;
	}

	.tab.selected {
		--chip-bg: var(--btn-primary-bg);
		--chip-fg: var(--btn-primary-fg);

		font-weight: var(--type-strong-weight);
	}
</style>
