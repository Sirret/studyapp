<!-- Layer 6 in the style guide: every component in its states. Dev builds only. -->
<script lang="ts">
	import { CARD_STATUSES } from './guide-data.ts';
	import Banner from '../components/Banner.svelte';
	import ConfirmDialog from '../components/ConfirmDialog.svelte';
	import Disclosure from '../components/Disclosure.svelte';
	import EmptyState from '../components/EmptyState.svelte';
	import ExerciseCard from '../components/ExerciseCard.svelte';
	import FeedbackPanel from '../components/FeedbackPanel.svelte';
	import OptionButton from '../components/OptionButton.svelte';
	import PhaseLabel from '../components/PhaseLabel.svelte';
	import ProgressDots from '../components/ProgressDots.svelte';
	import ProgressStrip from '../components/ProgressStrip.svelte';
	import ReadinessRing from '../components/ReadinessRing.svelte';
	import RoundSummary from '../components/RoundSummary.svelte';
	import SessionSummary from '../components/SessionSummary.svelte';
	import Slot from '../components/Slot.svelte';
	import SpeechBubble from '../components/SpeechBubble.svelte';
	import StatusBadge from '../components/StatusBadge.svelte';
	import StepList from '../components/StepList.svelte';
	import StickyNote from '../components/StickyNote.svelte';
	import TapChip from '../components/TapChip.svelte';
	import Button from '../primitives/Button.svelte';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';

	const optionStates = ['default', 'selected', 'correct', 'wrong', 'revealed'] as const;
	const summary = {
		index: 2,
		finished: 5,
		carried: 3,
		remaining: 9,
		suggestBreak: true,
		breakMinutes: 5
	};
	const noop = () => undefined;
	let confirmOpen = $state(false);
</script>

<GuideSection id="components" title="Components" layer="Layer 6">
	<GuideRow label="Option button states">
		{#each optionStates as state, i (state)}
			<OptionButton letter={'ABCDE'[i] ?? 'A'} text="Transmission Control Protocol" {state} />
		{/each}
	</GuideRow>
	<GuideRow label="Progress dots, phase label, progress strip">
		<ProgressDots count={0} required={3} />
		<ProgressDots count={2} required={3} />
		<ProgressDots count={2} required={2} />
		<PhaseLabel phase="discrimination" />
		<div class="wide"><ProgressStrip done={12} total={30} /></div>
		<div class="wide"><ProgressStrip done={4} total={30} runner={false} /></div>
	</GuideRow>
	<GuideRow label="Status badges">
		{#each CARD_STATUSES as status (status)}<StatusBadge {status} />{/each}
	</GuideRow>
	<GuideRow label="Readiness rings">
		<ReadinessRing percent={62} color="lavender" />
		<ReadinessRing percent={18} color="peach" label="secure" />
	</GuideRow>
	<GuideRow label="Tap chips and slots">
		<TapChip text="SYN" />
		<TapChip text="SYN-ACK" state="selected" />
		<TapChip text="ACK" state="used" />
		<TapChip text="FIN" state="correct" />
		<TapChip text="RST" state="wrong" />
		<Slot label="Step 1" state="empty" />
		<Slot label="Step 2" state="ready" />
		<Slot label="Step 3" value="ACK" state="filled" />
		<Slot label="TCP" value="Reliable" state="correct" />
		<Slot label="UDP" value="Ordered" state="wrong" />
	</GuideRow>
	<GuideRow label="Exercise card with feedback (correct, wrong with contrast)">
		<div class="wide">
			<ExerciseCard
				instruction="Pick the answer"
				prompt="reliable, connection-oriented byte stream"
				dots={{ count: 1, required: 3 }}
			>
				{#snippet body()}
					<OptionButton letter="A" text="TCP" state="correct" disabled />
					<OptionButton letter="B" text="UDP" disabled />
				{/snippet}
				{#snippet feedback()}
					<FeedbackPanel correct={true} reveal={['TCP']}>
						{#snippet actions()}<Button full>Continue</Button>{/snippet}
					</FeedbackPanel>
				{/snippet}
			</ExerciseCard>
		</div>
		<div class="wide">
			<FeedbackPanel
				correct={false}
				reveal={['TCP']}
				contrast={{ chosen: 'UDP', answers: 'connectionless datagrams' }}
			>
				{#snippet actions()}<Button full>Try again</Button>{/snippet}
			</FeedbackPanel>
		</div>
	</GuideRow>
	<GuideRow label="Confirm dialog (popup)">
		<Button variant="secondary" onclick={() => (confirmOpen = true)}>Open confirm dialog</Button>
		<ConfirmDialog
			bind:open={confirmOpen}
			title="Delete Networking?"
			confirmLabel="Delete course"
			onconfirm={() => (confirmOpen = false)}
		>
			Its topics and cards are removed. Your past study sessions aren't affected.
		</ConfirmDialog>
	</GuideRow>
	<GuideRow label="Disclosure (folded details)">
		<div class="wide">
			<Disclosure summary="2 parts couldn't be read and will be left out.">
				<span>Line 12: Expected "A -> B".</span>
			</Disclosure>
		</div>
	</GuideRow>
	<GuideRow label="Step list (worked example)">
		<StepList
			steps={[
				{ subgoal: 'Find the mask', step: '/24 means 255.255.255.0' },
				{ subgoal: 'Count hosts', step: '254 usable hosts' }
			]}
		/>
	</GuideRow>
	<GuideRow label="Sticky note, speech bubble, banners">
		<div class="wide">
			<StickyNote title="Not everything fits">
				4 hours short for Networking before Thursday.
				{#snippet actions()}<Button variant="secondary">See cuts</Button>{/snippet}
			</StickyNote>
		</div>
		<SpeechBubble text="Morning! Databases first — 25 minutes." />
		<div class="wide"><Banner>You're offline. Everything still works.</Banner></div>
		<div class="wide">
			<Banner tone="success">Ready offline ✓</Banner>
		</div>
		<div class="wide">
			<Banner tone="warning">
				Update available
				{#snippet action()}<Button variant="ghost">Reload</Button>{/snippet}
			</Banner>
		</div>
	</GuideRow>
	<GuideRow label="Empty state, round summary, session summary">
		<div class="wide">
			<EmptyState message="No courses yet.">
				{#snippet action()}<Button>Import your first lecture</Button>{/snippet}
			</EmptyState>
		</div>
		<div class="wide"><RoundSummary {summary} oncontinue={noop} onstop={noop} /></div>
		<div class="wide">
			<SessionSummary practised={14} ready={6} next="Retest tomorrow evening.">
				{#snippet actions()}<Button full>Back to Today</Button>{/snippet}
			</SessionSummary>
		</div>
	</GuideRow>
</GuideSection>

<style>
	.wide {
		width: 100%;
	}
</style>
