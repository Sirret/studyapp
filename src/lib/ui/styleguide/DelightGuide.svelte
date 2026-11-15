<!-- Layer 7 in the style guide: every delight effect (DESIGN §8), with buttons to replay it. Dev builds only. -->
<script lang="ts">
	import Flashcard from '../components/Flashcard.svelte';
	import PawTrail from '../components/PawTrail.svelte';
	import Stamp from '../components/Stamp.svelte';
	import CardFly from '../delight/CardFly.svelte';
	import CountUp from '../delight/CountUp.svelte';
	import PawLoader from '../delight/PawLoader.svelte';
	import PawStamp from '../delight/PawStamp.svelte';
	import PawWalk from '../delight/PawWalk.svelte';
	import SnowBurst from '../delight/SnowBurst.svelte';
	import SnowFall from '../delight/SnowFall.svelte';
	import SnowFlurry from '../delight/SnowFlurry.svelte';
	import Button from '../primitives/Button.svelte';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';

	const TRAIL = 5;
	let burst = $state(0);
	let flurry = $state(0);
	let stamp = $state(0);
	let count = $state(0);
	let walk = $state(0);
	let step = $state(1);
	let card = $state(0);
	let fly: 'left' | 'right' | null = $state(null);
</script>

<GuideSection id="delight" title="Delight" layer="Layer 7">
	<GuideRow label="paw-press: tap any button (Yuki full or quiet)">
		<Button variant="secondary">Tap me</Button>
	</GuideRow>
	<GuideRow label="stamp (exam-ready, Know it)">
		{#key stamp}<PawStamp><Stamp text="Exam-ready" /></PawStamp>{/key}
		<Button variant="ghost" onclick={() => (stamp += 1)}>Stamp</Button>
	</GuideRow>
	<GuideRow label="pawstep + pawin (paw trail advancing)">
		<PawTrail total={TRAIL} current={step} label="Step {step + 1} of {TRAIL}" />
		<Button variant="ghost" onclick={() => (step = (step + 1) % (TRAIL + 1))}>Advance</Button>
	</GuideRow>
	<GuideRow label="card-fly + rise (Still learning / Know it)">
		<span class="fly-stage">
			<CardFly
				key={card}
				{fly}
				onflown={() => {
					fly = null;
					card += 1;
				}}
			>
				<Flashcard
					term="Primary key #{card + 1}"
					answer="A column that uniquely identifies each row"
				/>
			</CardFly>
		</span>
		<Button variant="ghost" onclick={() => (fly = 'left')}>Still learning</Button>
		<Button variant="ghost" onclick={() => (fly = 'right')}>Know it</Button>
	</GuideRow>
	<GuideRow label="fall (Welcome, Home, empty states; ≤ 8 flakes)">
		<span class="stage-wide"><SnowFall /></span>
	</GuideRow>
	<GuideRow label="Check draw + snow burst">
		<span class="stage">
			✓
			<SnowBurst key={burst} />
		</span>
		<Button variant="ghost" onclick={() => (burst += 1)}>Replay</Button>
	</GuideRow>
	<GuideRow label="Snow flurry (3 in a row)">
		<span class="stage-wide"><SnowFlurry key={flurry} /></span>
		<Button variant="ghost" onclick={() => (flurry += 1)}>Replay</Button>
	</GuideRow>
	<GuideRow label="count-up, paw loader">
		{#key count}<span class="figure"><CountUp value={14} /></span>{/key}
		<Button variant="ghost" onclick={() => (count += 1)}>Count</Button>
		<PawLoader />
	</GuideRow>
	<GuideRow label="Paw walk (session summary)">
		<span class="stage-wide"
			>{#key walk}<PawWalk />{/key}</span
		>
		<Button variant="ghost" onclick={() => (walk += 1)}>Replay</Button>
	</GuideRow>
	<GuideRow label="Elsewhere in the guide">
		<span>sway: Hanging tag · nudge: Option bubble · card-flip: Flashcard · Yuki: below</span>
	</GuideRow>
</GuideSection>

<style>
	.stage {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: var(--size-px-44);
		height: var(--size-px-44);
		color: var(--correct);
		font-size: var(--type-title-size);
		font-weight: var(--type-display-weight);
	}

	.stage-wide {
		position: relative;
		display: block;
		width: 100%;
		height: var(--size-px-110);
		border-radius: var(--r-md);
		background: var(--surface);
	}

	.fly-stage {
		display: block;
		width: 100%;
		overflow-x: clip;
	}

	.figure {
		font-size: var(--type-display-size);
		font-weight: var(--type-display-weight);
	}
</style>
