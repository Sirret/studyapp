<!--
	Stamp (DESIGN §7): a Courier uppercase label in a thin accent border, slightly rotated, on the
	surface. "EXAM TRAP", "NEXT", "ADDED", "Coming soon · Phase 11". At most about six words (§5).
	The stamp-landing motion is delight (§8), not part of this component.
-->
<script lang="ts">
	let { text, dashed = false }: { text: string; dashed?: boolean } = $props();
</script>

<span class="stamp" class:dashed>{text}</span>

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

	.dashed {
		--stamp-border: dashed;
	}
</style>
