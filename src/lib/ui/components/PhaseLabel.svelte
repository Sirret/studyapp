<!-- Phase label (DESIGN §5): the current session phase as an uppercase caption. -->
<script lang="ts">
	import type { SessionPhase } from '#lib/db/schemas/session.ts';

	let { phase }: { phase: SessionPhase } = $props();

	const LABEL: Record<SessionPhase, string> = {
		warmup: 'Warm-up',
		new: 'New',
		recall: 'Recall',
		discrimination: 'Compare',
		cleanup: 'Cleanup'
	};
</script>

<span class="phase">{LABEL[phase]}</span>

<style>
	.phase {
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		line-height: var(--type-caption-leading);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking-wide);
		text-transform: uppercase;
	}
</style>
