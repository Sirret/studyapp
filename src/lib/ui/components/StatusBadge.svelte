<!--
	Status badge (DESIGN §7 Stamp style): a Courier label with an icon and the status label, never colour alone.
	Exam-ready, Long-term secure and One-night triage use the paw, snowflake and moon motifs; the
	rest use Lucide. Labels follow DATA_MODEL §4.4.
-->
<script lang="ts">
	import { Circle, Contrast, RefreshCw, Sparkles } from '@lucide/svelte';
	import type { CardStatus } from '#lib/db/schemas/common.ts';
	import Moon from '../motifs/Moon.svelte';
	import Paw from '../primitives/Paw.svelte';
	import Snowflake from '../primitives/Snowflake.svelte';
	import Icon from '../primitives/Icon.svelte';

	let { status }: { status: CardStatus } = $props();

	const LABEL: Record<CardStatus, string> = {
		unseen: 'Not seen yet',
		learning: 'New — retest tomorrow',
		'needs-work': 'Needs work',
		provisional: 'Provisional',
		'exam-ready': 'Exam-ready',
		secure: 'Long-term secure',
		'one-night': 'One-night triage'
	};
	const ICONS = {
		unseen: Circle,
		learning: Sparkles,
		'needs-work': RefreshCw,
		provisional: Contrast
	};
</script>

<span class="badge {status}" data-status={status}>
	{#if status === 'exam-ready'}
		<Paw size={16} />
	{:else if status === 'secure'}
		<Snowflake size={16} />
	{:else if status === 'one-night'}
		<Moon size={16} />
	{:else}
		<Icon icon={ICONS[status]} />
	{/if}
	<span>{LABEL[status]}</span>
</span>

<style>
	.badge {
		--badge-border: var(--line-strong);
		--badge-style: solid;
		--badge-icon: var(--text-soft);

		display: inline-flex;
		align-items: center;
		gap: var(--gap-xs);
		min-height: var(--size-px-28);
		padding: 0 var(--gap-sm);
		border: var(--border-dashed) var(--badge-style) var(--badge-border);
		border-radius: var(--r-xs);
		background: var(--surface);
		color: var(--text);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		line-height: var(--type-caption-leading);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
		white-space: nowrap;
	}

	.badge > :first-child {
		color: var(--badge-icon);
	}

	.badge :global(.icon svg) {
		width: var(--size-px-16);
		height: var(--size-px-16);
	}

	.unseen {
		--badge-border: var(--decor);
		--badge-style: dashed;
	}

	.needs-work {
		--badge-border: var(--wrong);
		--badge-style: dashed;
		--badge-icon: var(--wrong);
	}

	.provisional,
	.learning {
		--badge-border: var(--outline);
		--badge-icon: var(--text);
	}

	.exam-ready,
	.secure {
		--badge-border: var(--correct);
		--badge-icon: var(--correct);
	}

	.one-night {
		--badge-border: var(--accent);
		--badge-icon: var(--accent);
	}
</style>
