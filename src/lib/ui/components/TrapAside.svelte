<!--
	Trap aside (DESIGN §7): a dashed accent box with a Stamp label overlapping its top edge, for
	exam traps and other "watch out" notes beside the reading.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Stamp from './Stamp.svelte';

	let { label = 'Exam trap', children }: { label?: string; children: Snippet } = $props();
</script>

<aside class="trap" aria-label={label}>
	<span class="label"><Stamp text={label} /></span>
	<div class="body">{@render children()}</div>
</aside>

<style>
	.trap {
		position: relative;
		margin-top: var(--gap-sm);
		padding: var(--gap-lg) var(--gap-lg) var(--gap-md);
		border: var(--border-dashed) dashed var(--accent);
		border-radius: var(--r-sm);
		color: var(--text);
		font-size: var(--type-body-size);
		line-height: var(--type-body-leading);
	}

	.label {
		position: absolute;
		top: 0;
		left: var(--gap-md);
		transform: translateY(-50%);
	}

	.body > :global(:first-child) {
		margin-top: 0;
	}

	.body > :global(:last-child) {
		margin-bottom: 0;
	}
</style>
