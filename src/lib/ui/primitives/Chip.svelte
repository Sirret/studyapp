<!--
	Chip / course tab (DESIGN §5, §12): a pill in a course colour, always with its text. As a tab
	(`onselect` given) it is a toggle button, and the selected tab gets an underline bar.
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
		--chip-bg: var(--surface-alt);
		--chip-fg: var(--text);

		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--gap-xs);
		min-height: var(--chip-height);
		padding: 0 var(--gap-md);
		border: 0;
		border-radius: var(--r-pill);
		background: var(--chip-bg);
		color: var(--chip-fg);
		font-size: var(--type-chip-size);
		font-weight: var(--type-strong-weight);
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

	.tab.selected::after {
		content: '';
		position: absolute;
		inset: auto var(--gap-md) var(--size-px-4);
		height: var(--stroke);
		border-radius: var(--r-pill);
		background: var(--text);
	}
</style>
