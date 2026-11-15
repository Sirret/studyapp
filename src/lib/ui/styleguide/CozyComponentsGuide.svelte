<!--
	Layer 6 in the style guide, part two: the components new in the cozy design (DESIGN §7) — mode
	doors, stamps, trap aside, key term, hanging tag, paw trail and rings, readiness meter,
	flashcard and checklist rows. Dev builds only.
-->
<script lang="ts">
	import ChecklistRow from '../components/ChecklistRow.svelte';
	import Flashcard from '../components/Flashcard.svelte';
	import Hero from '../components/Hero.svelte';
	import SectionHeading from '../components/SectionHeading.svelte';
	import HangingTag from '../components/HangingTag.svelte';
	import KeyTerm from '../components/KeyTerm.svelte';
	import ModeDoor from '../components/ModeDoor.svelte';
	import ModeDoorRow from '../components/ModeDoorRow.svelte';
	import PawRing from '../components/PawRing.svelte';
	import PawTrail from '../components/PawTrail.svelte';
	import ReadinessMeter from '../components/ReadinessMeter.svelte';
	import Stamp from '../components/Stamp.svelte';
	import TrapAside from '../components/TrapAside.svelte';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';

	const noop = () => undefined;
	let flipped = $state(true);
</script>

<GuideSection id="cozy-components" title="Cozy components" layer="Layer 6">
	<GuideRow label="Mode doors (label colour follows the fill; dot = has work)">
		<div class="doors">
			<ModeDoor mode="learn" hint="Read, then check" hasWork onclick={noop} />
			<ModeDoor mode="practice" hint="12 cards due" hasWork onclick={noop} />
			<ModeDoor mode="exam" hint="Thursday · 4 days" onclick={noop} />
			<ModeDoor mode="play" hint="Coming soon" hasWork onclick={noop} />
		</div>
	</GuideRow>
	<GuideRow label="Mode door row (course page: three doors in one row)">
		<div class="wide">
			<ModeDoorRow>
				<ModeDoor mode="learn" hint="3 parts to learn" hasWork onclick={noop} />
				<ModeDoor mode="practice" hint="12 cards due" hasWork onclick={noop} />
				<ModeDoor mode="exam" hint="In 4 days" href="#cozy-components" />
			</ModeDoorRow>
		</div>
	</GuideRow>
	<GuideRow label="Stamps (solid, dashed, link)">
		<Stamp text="Exam trap" />
		<Stamp text="Next" />
		<Stamp text="Added" dashed />
		<Stamp text="Coming soon · Phase 11" dashed />
		<Stamp text="Cheat sheet" dashed href="#cozy-components" />
	</GuideRow>
	<GuideRow label="Trap aside and key term">
		<div class="wide">
			<TrapAside>
				<p>
					A <KeyTerm>three-way handshake</KeyTerm> opens a TCP connection; UDP has none, so "UDP handshake"
					answers are a trap.
				</p>
			</TrapAside>
		</div>
	</GuideRow>
	<GuideRow label="Hero (with and without snow, with eyebrow) and section heading">
		<div class="wide stack">
			<Hero title="Welcome back." subline="Snow's still falling. Your place is kept." snow />
			<Hero title="Welcome." />
			<Hero eyebrow="Course · 42 cards" title="Data Communication & Networks" />
			<SectionHeading title="Your shelf">
				{#snippet action()}<a href="#cozy-components">+ Add</a>{/snippet}
			</SectionHeading>
			<SectionHeading title="Topics" />
		</div>
	</GuideRow>
	<GuideRow label="Hanging tag (hero greetings only)">
		<HangingTag>Good evening, Sam</HangingTag>
	</GuideRow>
	<GuideRow label="Paw trail: start, middle, all done">
		<div class="wide stack">
			<PawTrail total={3} current={0} label="Section 1 of 3" meta="§1 of 3 · 6 min" />
			<PawTrail total={3} current={1} label="Section 2 of 3" meta="§2 of 3 · 3 min" />
			<PawTrail total={5} current={5} label="All 5 sections done" meta="Done" />
		</div>
	</GuideRow>
	<GuideRow label="Paw rings: done, current, not started (24 and 22 px)">
		<PawRing state="done" />
		<PawRing state="current" />
		<PawRing state="todo" />
		<PawRing state="done" small />
		<PawRing state="current" small />
		<PawRing state="todo" small />
	</GuideRow>
	<GuideRow label="Readiness meter: 0%, 68%, 100%">
		<div class="wide stack">
			<ReadinessMeter percent={0} />
			<ReadinessMeter percent={68} />
			<ReadinessMeter percent={100} />
		</div>
	</GuideRow>
	<GuideRow label="Flashcard: front with hint, back (tap to flip)">
		<div class="wide">
			<Flashcard term="Subnet mask" answer="Splits an IP address into its network and host parts" />
		</div>
		<div class="wide">
			<Flashcard
				term="TCP"
				answer="Reliable, ordered, connection-oriented byte stream"
				bind:flipped
			/>
		</div>
	</GuideRow>
	<GuideRow label="Checklist rows (import map, scope picker)">
		<div class="wide stack">
			<ChecklistRow
				title="Transport layer"
				state="current"
				onclick={noop}
				sections={[
					{ title: 'TCP vs UDP', state: 'done' },
					{ title: 'The three-way handshake', state: 'current' },
					{ title: 'Flow control', state: 'todo' }
				]}
			/>
			<ChecklistRow title="Network layer" state="done" />
			<ChecklistRow title="Application layer" state="todo" />
			<ChecklistRow title="Web security" state="done" meta="imported" label="Imported" />
			<ChecklistRow title="Digital forensics" state="todo" meta="to come" label="To come" />
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

	.doors {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--gap-md);
		width: 100%;
	}
</style>
