<!--
	Card (DESIGN §5, §12): surface, large radius, soft shadow by day and a hairline edge by night.
	An optional course-colour stripe runs along the top. At most one motif per card.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CourseColor } from '#lib/design/tokens.ts';

	type Props = {
		stripe?: CourseColor;
		padding?: 'md' | 'lg' | 'none';
		radius?: 'lg' | 'xl';
		tag?: 'div' | 'section' | 'article';
		label?: string;
		children: Snippet;
	};

	let { stripe, padding = 'md', radius = 'lg', tag = 'div', label, children }: Props = $props();
</script>

<svelte:element
	this={tag}
	class="card pad-{padding} radius-{radius}"
	style:--card-stripe={stripe ? `var(--course-${stripe})` : undefined}
	class:striped={stripe !== undefined}
	aria-label={label}
>
	{@render children()}
</svelte:element>

<style>
	.card {
		--card-bg: var(--surface);
		--card-radius: var(--r-lg);
		--card-padding: var(--gap-lg);
		--card-shadow: var(--shadow-1);

		position: relative;
		overflow: hidden;
		padding: var(--card-padding);
		border: var(--hairline) solid var(--card-edge);
		border-radius: var(--card-radius);
		background: var(--card-bg);
		box-shadow: var(--card-shadow);
	}

	.radius-xl {
		--card-radius: var(--r-xl);
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
