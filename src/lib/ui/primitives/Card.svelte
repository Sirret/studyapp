<!--
	Card (DESIGN §6, §7): raised paper with a 2 px outline and the medium radius; `raised` adds the
	flat printed shadow. An optional course-colour stripe runs along the top. At most one motif per
	card.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CourseColor } from '#lib/design/tokens.ts';

	type Props = {
		stripe?: CourseColor;
		padding?: 'md' | 'lg' | 'none';
		raised?: boolean;
		tag?: 'div' | 'section' | 'article';
		label?: string;
		children: Snippet;
	};

	let { stripe, padding = 'md', raised = false, tag = 'div', label, children }: Props = $props();
</script>

<svelte:element
	this={tag}
	class="card pad-{padding}"
	class:raised
	style:--card-stripe={stripe ? `var(--course-${stripe})` : undefined}
	class:striped={stripe !== undefined}
	aria-label={label}
>
	{@render children()}
</svelte:element>

<style>
	.card {
		--card-bg: var(--surface);
		--card-padding: var(--gap-lg);

		position: relative;
		overflow: hidden;
		padding: var(--card-padding);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-md);
		background: var(--card-bg);
		color: var(--text);
	}

	.raised {
		box-shadow: var(--shadow-raised);
	}

	.pad-lg {
		--card-padding: var(--gap-xl);
	}

	.pad-none {
		--card-padding: 0;
	}

	.striped {
		padding-top: calc(var(--card-padding) + var(--size-px-4));
	}

	.striped::before {
		content: '';
		position: absolute;
		inset: 0 0 auto;
		height: var(--size-px-4);
		background: var(--card-stripe);
	}
</style>
