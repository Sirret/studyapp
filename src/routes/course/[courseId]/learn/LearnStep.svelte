<!--
	One screen of a Learn topic (SESSION_NOTES C): the topic summary, Meet the terms, the reader
	(with its tip and outline), a session step's short intro, or the "Added by the chatbot" review.
	The button on each screen says what it leads into; `onnext` moves on (starting a session when
	the next screen is one), `onstart` starts this screen's own session.
-->
<script lang="ts">
	import type { LearnScreen } from '#lib/services/learn-types.ts';
	import Hero from '#lib/ui/components/Hero.svelte';
	import MeetTerms from '#lib/ui/components/MeetTerms.svelte';
	import Reader from '#lib/ui/components/Reader.svelte';
	import { readerOutline, sectionPosition, stepLabel, stepMeta } from '#lib/ui/learn/learn-nav.ts';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import AddedReview from './AddedReview.svelte';

	let {
		screens,
		index,
		topicName,
		busy,
		onnext,
		onstart
	}: {
		screens: LearnScreen[];
		index: number;
		topicName: string;
		busy: boolean;
		onnext: () => void;
		onstart: () => void;
	} = $props();

	const screen = $derived(screens[index]);
	const following = $derived(screens[index + 1]);
	const position = $derived(sectionPosition(screens, index));

	const INTROS = {
		questions: 'A couple of questions on what you just read. Nothing here is graded.',
		lookBack: 'One question from a section you read earlier, so it stays fresh.',
		figures: 'The topic’s pictures and diagrams: name the hidden parts and rebuild them.',
		mixedQuiz: 'Questions from the whole topic, mixed. Tomorrow’s retest is what counts.'
	} as const;
</script>

{#snippet next()}
	<Button
		full
		size="session"
		loading={busy}
		meta={stepMeta(following)}
		onclick={onnext}
		data-learn-next
	>
		{stepLabel(following)}
	</Button>
{/snippet}

<div data-learn-screen={screen?.step}>
	{#if screen?.step === 'summary'}
		<Stack gap="md">
			<Hero eyebrow={screen.at === 'start' ? 'Topic' : 'Recap'} title={topicName} />
			<p class="text" data-learn-summary>{screen.text}</p>
			{@render next()}
		</Stack>
	{:else if screen?.step === 'meetTerms'}
		<MeetTerms terms={screen.terms} {busy} {onstart} />
	{:else if screen?.step === 'read'}
		<Reader
			eyebrow={position ? `Section ${position.n} of ${position.of}` : undefined}
			title={screen.title}
			text={screen.text}
			tip={screen.tip}
			terms={screen.terms}
			generated={screen.generated}
			outlineTitle={topicName}
			outline={readerOutline(screens, index)}
			footer={next}
		/>
	{:else if screen?.step === 'added'}
		<AddedReview sections={screen.sections} next={onnext} nextLabel={stepLabel(following)} />
	{:else if screen}
		<Stack gap="md">
			<Hero eyebrow={topicName} title={stepLabel(screen)} />
			<p class="text">{INTROS[screen.step]}</p>
			<Button
				full
				size="session"
				loading={busy}
				meta={stepMeta(screen)}
				onclick={onstart}
				data-learn-start
			>
				Start
			</Button>
		</Stack>
	{/if}
</div>

<style>
	.text {
		margin: 0;
		font-size: var(--type-reading-size);
		line-height: var(--type-reading-leading);
	}
</style>
