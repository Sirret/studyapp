<!-- Layer 7 in the style guide: every delight effect, with buttons to replay it. Dev builds only. -->
<script lang="ts">
	import StatusBadge from '../components/StatusBadge.svelte';
	import CountUp from '../delight/CountUp.svelte';
	import PawLoader from '../delight/PawLoader.svelte';
	import PawStamp from '../delight/PawStamp.svelte';
	import PawWalk from '../delight/PawWalk.svelte';
	import SnowBurst from '../delight/SnowBurst.svelte';
	import SnowFlurry from '../delight/SnowFlurry.svelte';
	import Button from '../primitives/Button.svelte';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';

	let burst = $state(0);
	let flurry = $state(0);
	let stamp = $state(0);
	let count = $state(0);
	let walk = $state(0);
</script>

<GuideSection id="delight" title="Delight" layer="Layer 7">
	<GuideRow label="Paw press: tap any button (Yuki full or quiet)">
		<Button variant="secondary">Tap me</Button>
	</GuideRow>
	<GuideRow label="Check draw + snow burst">
		<span class="stage">
			✓
			<SnowBurst key={burst} />
		</span>
		<Button variant="ghost" onclick={() => (burst += 1)}>Replay</Button>
	</GuideRow>
	<GuideRow label="Snow flurry (3 in a row)">
		<span class="flurry-stage"><SnowFlurry key={flurry} /></span>
		<Button variant="ghost" onclick={() => (flurry += 1)}>Replay</Button>
	</GuideRow>
	<GuideRow label="Paw stamp, count-up, paw loader">
		{#key stamp}<PawStamp><StatusBadge status="exam-ready" /></PawStamp>{/key}
		<Button variant="ghost" onclick={() => (stamp += 1)}>Stamp</Button>
		{#key count}<span class="figure"><CountUp value={14} /></span>{/key}
		<Button variant="ghost" onclick={() => (count += 1)}>Count</Button>
		<PawLoader />
	</GuideRow>
	<GuideRow label="Paw walk (session summary)">
		<span class="walk-stage"
			>{#key walk}<PawWalk />{/key}</span
		>
		<Button variant="ghost" onclick={() => (walk += 1)}>Replay</Button>
	</GuideRow>
</GuideSection>

<style>
	.stage {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: var(--size-px-44);
		height: var(--size-px-44);
		color: var(--success);
		font-size: var(--type-title-size);
		font-weight: var(--type-display-weight);
	}

	.flurry-stage,
	.walk-stage {
		position: relative;
		display: block;
		width: 100%;
		height: var(--space-56);
		border-radius: var(--r-md);
		background: var(--surface);
	}

	.figure {
		font-size: var(--type-display-size);
		font-weight: var(--type-display-weight);
	}
</style>
