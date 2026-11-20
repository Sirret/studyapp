<!--
	Welcome (SESSION_NOTES §K, DESIGN §12 "Welcome"): shown whenever there are no courses. Yuki says
	hello, a 3-step "how it works", then "Try a sample course" (primary), "Bring my lectures" and
	"Make cards by hand". Never a payment-style push to add a course.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { prefs } from '#lib/services/preferences.svelte.ts';
	import Hero from '../components/Hero.svelte';
	import SpeechBubble from '../components/SpeechBubble.svelte';
	import Yuki from '../components/yuki/Yuki.svelte';
	import { effectOn } from '../delight/delight.ts';
	import Row from '../layout/Row.svelte';
	import Stack from '../layout/Stack.svelte';
	import Button from '../primitives/Button.svelte';
	import Card from '../primitives/Card.svelte';

	let { adding, onsample }: { adding: boolean; onsample: () => void } = $props();

	/** DESIGN §9: big (about 100-180 px) on Welcome. */
	const YUKI_SIZE = 120;

	const STEPS = [
		{
			title: 'Bring your lectures',
			text: 'Your chatbot turns slides into notes and cards. You paste them here.'
		},
		{
			title: 'Learn a topic at a time',
			text: 'Short sections to read, then a couple of questions on each.'
		},
		{
			title: 'Keep it fresh',
			text: 'Cards come back just before you would forget them, planned around your exam.'
		}
	] as const;
</script>

<Hero
	title="Welcome."
	subline="A warm den for your lectures."
	snow={effectOn('snowFall', prefs.companion)}
/>
{#if prefs.companion !== 'off'}
	<Row gap="md">
		<Yuki state="idle" size={YUKI_SIZE} />
		<SpeechBubble text="Hi, I'm {prefs.companionName}. Here's how it works." />
	</Row>
{/if}
<Card label="How it works" tag="section">
	<ol class="steps">
		{#each STEPS as step, i (step.title)}
			<li>
				<span class="number" aria-hidden="true">{i + 1}</span>
				<span class="text"><strong>{step.title}.</strong> {step.text}</span>
			</li>
		{/each}
	</ol>
</Card>
<Stack gap="sm">
	<Button full loading={adding} onclick={onsample} data-try-sample>Try a sample course</Button>
	<Button full variant="secondary" href={resolve('/import')}>Bring my lectures</Button>
	<Button full variant="ghost" href={resolve('/course/new')} data-make-by-hand
		>Make cards by hand</Button
	>
</Stack>

<style>
	.steps {
		display: grid;
		gap: var(--gap-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: var(--touch-min) 1fr;
		align-items: start;
		gap: var(--gap-sm);
	}

	.number {
		display: grid;
		place-items: center;
		width: var(--touch-min);
		height: var(--touch-min);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-pill);
		color: var(--text-strong);
		font-family: var(--font-wordmark);
		font-size: var(--type-heading-size);
	}

	.text {
		color: var(--text);
	}
</style>
