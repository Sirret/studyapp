<!--
	Key term (DESIGN §7): a <dfn> in the running text, weight 600, normal style, with a 2 px
	key-term underline. The underline is decorative; the weight carries the meaning.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<dfn class="term">{@render children()}</dfn>

<style>
	.term {
		font-style: normal;
		font-weight: var(--type-strong-weight);
		text-decoration: underline var(--stroke) var(--keyterm);
		text-underline-offset: var(--size-px-3);
	}
</style>
