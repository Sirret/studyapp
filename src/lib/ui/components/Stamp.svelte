<!--
	Stamp (DESIGN §7): a Courier uppercase label in a thin accent border, slightly rotated, on the
	surface. "EXAM TRAP", "NEXT", "ADDED", "Coming soon · Phase 11". At most about six words (§5).
	The stamp-landing motion is delight (§8), not part of this component.
-->
<script lang="ts">
	let {
		text,
		dashed = false,
		href
	}: {
		text: string;
		dashed?: boolean;
		/** Makes the stamp a link (a resolve()d href or an in-page `#id`), with a 44 px target. */
		href?: string;
	} = $props();
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs or #ids -->
	<a class="stamp-link" {href}><span class="stamp" class:dashed>{text}</span></a>
{:else}
	<span class="stamp" class:dashed>{text}</span>
{/if}

<style>
	.stamp {
		--stamp-border: solid;

		display: inline-block;
		padding: var(--gap-2xs) var(--gap-sm);
		border: var(--border-dashed) var(--stamp-border) var(--accent);
		border-radius: var(--r-xs);
		background: var(--surface);
		color: var(--accent);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		line-height: var(--type-caption-leading);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
		white-space: nowrap;
		transform: rotate(var(--stamp-tilt));
	}

	.stamp-link {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch-min);
		text-decoration: none;
	}

	.dashed {
		--stamp-border: dashed;
	}
</style>
