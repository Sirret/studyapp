<!--
	"Where you left off" (DESIGN §12 Home, mockup 01-home): the course stripe, a Courier eyebrow, the
	topic, "Course · Mode", a paw trail of the topic's sections read, and Continue.
-->
<script lang="ts">
	import type { LeftOffView } from '#lib/services/home-service.ts';
	import PawTrail from '../components/PawTrail.svelte';
	import Stack from '../layout/Stack.svelte';
	import Button from '../primitives/Button.svelte';
	import Card from '../primitives/Card.svelte';
	import { modeLabel } from './home-text.ts';

	let { view, href }: { view: LeftOffView; href: string } = $props();

	const readLine = $derived(`${view.read} of ${view.sections} read`);
</script>

<Card stripe={view.color} tag="section" label="Where you left off" raised>
	<Stack gap="md">
		<Stack gap="xs">
			<span class="eyebrow">Where you left off</span>
			<strong class="topic" data-left-off={view.topicName}>{view.topicName}</strong>
			<span class="meta">{view.courseName} · {modeLabel(view.mode)}</span>
		</Stack>
		{#if view.sections > 0}
			<PawTrail
				total={view.sections}
				current={view.read}
				label="{readLine} in this topic"
				meta={readLine}
			/>
		{/if}
		<Button full {href} data-continue>Continue</Button>
	</Stack>
</Card>

<style>
	.eyebrow {
		color: var(--accent);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking-wide);
		text-transform: uppercase;
	}

	.topic {
		color: var(--text-strong);
		font-size: var(--type-heading-size);
		font-weight: var(--type-heading-weight);
		overflow-wrap: anywhere;
	}

	.meta {
		color: var(--text-soft);
	}
</style>
