<!--
	Status badge (DESIGN §5, §11.1): a pill with an icon and the status label, never colour alone.
	Exam-ready, Long-term secure and One-night triage use the paw, snowflake and moon motifs; the
	rest use Lucide. Labels follow DATA_MODEL §4.4.
-->
<script lang="ts">
	import { Circle, Contrast, RefreshCw, Sparkles } from '@lucide/svelte';
	import type { CardStatus } from '#lib/db/schemas/common.ts';
	import Moon from '../motifs/Moon.svelte';
	import Paw from '../motifs/Paw.svelte';
	import Snowflake from '../motifs/Snowflake.svelte';
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
		--badge-bg: var(--surface-alt);
		--badge-fg: var(--text);

		display: inline-flex;
		align-items: center;
		gap: var(--gap-xs);
		min-height: var(--size-px-28);
		padding: 0 var(--gap-md) 0 var(--gap-sm);
		border-radius: var(--r-pill);
		background: var(--badge-bg);
		color: var(--badge-fg);
		font-size: var(--type-caption-size);
		line-height: var(--type-caption-leading);
		font-weight: var(--type-caption-weight);
		white-space: nowrap;
	}

	.badge :global(.icon svg) {
		width: var(--size-px-16);
		height: var(--size-px-16);
	}

	.needs-work {
		--badge-bg: var(--error-soft);
	}

	.provisional,
	.learning {
		--badge-bg: var(--primary-soft);
	}

	.exam-ready,
	.secure {
		--badge-bg: var(--success-soft);
	}

	.one-night {
		--badge-bg: var(--warning-soft);
	}
</style>
