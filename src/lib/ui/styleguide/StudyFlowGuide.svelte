<!--
	Layer 6 in the style guide, part three: the Phase 8.6 study-flow components — idea-unit and list
	exercises, the hint link, Meet the terms, the reader, the flashcard deck, the scope picker and
	the disabled mode door. Dev builds only.
-->
<script lang="ts">
	import Exercise from '#lib/exercises/Exercise.svelte';
	import type { ExerciseResponse, MicroHint } from '#lib/services/study-types.ts';
	import FlashcardDeck from '../components/FlashcardDeck.svelte';
	import HintLink from '../components/HintLink.svelte';
	import MeetTerms from '../components/MeetTerms.svelte';
	import ModeDoor from '../components/ModeDoor.svelte';
	import ModeDoorRow from '../components/ModeDoorRow.svelte';
	import Reader from '../components/Reader.svelte';
	import ScopePicker from '../components/ScopePicker.svelte';
	import SoundToggle from '../components/SoundToggle.svelte';
	import TapChip from '../components/TapChip.svelte';
	import Button from '../primitives/Button.svelte';
	import { initialPicks } from '../scope/scope-selection.ts';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';
	import {
		SAMPLE_CHOOSE,
		SAMPLE_DECK,
		SAMPLE_IDEA_UNIT,
		SAMPLE_LIST_PICK,
		SAMPLE_LIST_TYPED,
		SAMPLE_READER,
		SAMPLE_SCOPE,
		SAMPLE_TERMS
	} from './guide-data-study.ts';

	const noop = () => undefined;
	const REMOVE: MicroHint = { kind: 'remove', index: 2 };
	const REVEAL: MicroHint = { kind: 'reveal', text: 'Ma_____ th__ sp______' };
	let asked: MicroHint | null = $state(null);
	let ideaResponse: ExerciseResponse | null = $state(null);
	let typedResponse: ExerciseResponse | null = $state(null);
	let pickResponse: ExerciseResponse | null = $state(null);
	let chooseResponse: ExerciseResponse | null = $state(null);
	let picks = $state(initialPicks(SAMPLE_SCOPE));
</script>

<GuideSection id="study-flow" title="Study flow (Phase 8.6)" layer="Layer 6">
	<GuideRow label="Idea unit: type, then Next shows the definition and pre-ticked key words">
		<div class="wide">
			<Exercise
				spec={SAMPLE_IDEA_UNIT}
				verdict={null}
				bind:response={ideaResponse}
				onsubmit={noop}
			/>
		</div>
	</GuideRow>
	<GuideRow label="List card, typed (N of M rows)">
		<div class="wide">
			<Exercise
				spec={SAMPLE_LIST_TYPED}
				verdict={null}
				bind:response={typedResponse}
				onsubmit={noop}
			/>
		</div>
	</GuideRow>
	<GuideRow label="List card, tap-pick (paw trail counts picks against N)">
		<div class="wide">
			<Exercise
				spec={SAMPLE_LIST_PICK}
				verdict={null}
				bind:response={pickResponse}
				onsubmit={noop}
			/>
		</div>
	</GuideRow>
	<GuideRow label="Pick one after a remove hint (C is gone; letters keep their places)">
		<div class="wide">
			<Exercise
				spec={SAMPLE_CHOOSE}
				verdict={null}
				hint={REMOVE}
				bind:response={chooseResponse}
				onsubmit={noop}
			/>
		</div>
	</GuideRow>
	<GuideRow label="Tap chips after checking: correct, wrong, missed (revealed)">
		<TapChip text="worm" state="correct" disabled />
		<TapChip text="phishing" state="wrong" disabled />
		<TapChip text="rootkit" state="revealed" disabled />
	</GuideRow>
	<GuideRow label="Hint link: ask (tap it), revealed letters, option removed">
		<div class="wide stack">
			<HintLink label="Hint · first letters" hint={asked} onrequest={() => (asked = REVEAL)} />
			<HintLink label="Hint · first letters" hint={REVEAL} onrequest={noop} />
			<HintLink label="Hint · remove one wrong answer" hint={REMOVE} onrequest={noop} />
		</div>
	</GuideRow>
	<GuideRow label="Sound toggle (study and Practice top bar; one tap mutes, saved at once)">
		<SoundToggle />
	</GuideRow>
	<GuideRow label="Meet the terms (then one matching check)">
		<div class="wide"><MeetTerms terms={SAMPLE_TERMS} onstart={noop} /></div>
	</GuideRow>
	<GuideRow label="Reader: key terms underlined once, tip aside; three columns from 1024 px">
		<div class="wide">
			<Reader
				eyebrow="Section 2 of 3"
				title={SAMPLE_READER.title}
				text={SAMPLE_READER.text}
				tip={SAMPLE_READER.tip}
				terms={SAMPLE_READER.terms}
				outlineTitle="The TCP/IP model"
				outline={SAMPLE_READER.outline}
			>
				{#snippet footer()}
					<Button full meta="2 questions">Two quick questions</Button>
				{/snippet}
			</Reader>
		</div>
	</GuideRow>
	<GuideRow label="Reader: a section the chatbot wrote, no terms or tip">
		<div class="wide">
			<Reader title="Flow control" text="TCP slows the sender down." generated />
		</div>
	</GuideRow>
	<GuideRow label="Flashcard deck (tap to flip; Still learning / Know it)">
		<div class="wide">
			<FlashcardDeck cards={SAMPLE_DECK} keyboard={false}>
				{#snippet done(result)}
					<p>Pass done: {result.known.length} know it, {result.learning.length} still learning.</p>
				{/snippet}
			</FlashcardDeck>
		</div>
	</GuideRow>
	<GuideRow label="Scope picker (one topic whole, one partly, one not)">
		<div class="wide"><ScopePicker view={SAMPLE_SCOPE} bind:picks /></div>
	</GuideRow>
	<GuideRow label="Mode doors with Play disabled">
		<div class="wide">
			<ModeDoorRow>
				<ModeDoor mode="learn" hint="3 topics" hasWork onclick={noop} />
				<ModeDoor mode="practice" hint="42 cards" onclick={noop} />
				<ModeDoor mode="exam" hint="In 4 days" onclick={noop} />
				<ModeDoor mode="play" hint="Study games" disabled />
			</ModeDoorRow>
		</div>
	</GuideRow>
</GuideSection>

<style>
	.wide {
		width: 100%;
	}

	.stack {
		display: grid;
		gap: var(--gap-md);
	}
</style>
