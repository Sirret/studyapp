<!--
	Layer 6 in the style guide, part four: the Phase 6 figures — occlusion images (hide one, hide
	all, place a label), drawn diagrams (stack, flow, too big to draw, connect), Show original, and
	the two editors. Dev builds only.
-->
<script lang="ts">
	import Exercise from '#lib/exercises/Exercise.svelte';
	import type { ExerciseResponse } from '#lib/services/study-types.ts';
	import DiagramFigure from '../figures/DiagramFigure.svelte';
	import DiagramTextEditor from '../figures/DiagramTextEditor.svelte';
	import FigureView from '../figures/FigureView.svelte';
	import { watchMedia } from '../figures/media-url.ts';
	import OcclusionEditor from '../figures/OcclusionEditor.svelte';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';
	import {
		FLOW_RIGHT,
		GUIDE_MEDIA,
		PLACE_WRONG,
		SAMPLE_CONNECT,
		SAMPLE_EDIT,
		SAMPLE_FLOW,
		SAMPLE_FLOW_NODES,
		SAMPLE_FLOW_TEXT,
		SAMPLE_OCCLUSION_ALL,
		SAMPLE_OCCLUSION_TYPE,
		SAMPLE_PLACE,
		SAMPLE_STACK,
		SAMPLE_TOO_BIG
	} from './guide-data-figures.ts';

	const noop = () => undefined;
	let response: ExerciseResponse | null = $state(null);
	let picture: string | null = $state(null);
	let edit = $state(structuredClone(SAMPLE_EDIT));
	let flowText = $state(SAMPLE_FLOW_TEXT);
	let badText = $state('Filter -> Sort\nSort Output');

	$effect(() => watchMedia(GUIDE_MEDIA, SAMPLE_PLACE.figure.mediaId, (url) => (picture = url)));
</script>

<GuideSection id="figures" title="Figures (Phase 6)" layer="Layer 6">
	<GuideRow label="Occlusion, hide one: the asked box is highlighted">
		<div class="wide">
			<Exercise
				spec={SAMPLE_OCCLUSION_TYPE}
				verdict={null}
				media={GUIDE_MEDIA}
				bind:response
				onsubmit={noop}
			/>
		</div>
	</GuideRow>
	<GuideRow label="Occlusion, hide all, checked: the answer shows in its box">
		<div class="wide">
			<FigureView figure={SAMPLE_OCCLUSION_ALL} media={GUIDE_MEDIA} reveal="Switch" />
		</div>
	</GuideRow>
	<GuideRow label="Place a label: drag the chip, or tap a box">
		<div class="wide">
			<Exercise spec={SAMPLE_PLACE} verdict={null} media={GUIDE_MEDIA} onsubmit={noop} />
		</div>
	</GuideRow>
	<GuideRow label="Place, checked wrong: ✕ on the pick, the right box revealed">
		<div class="wide">
			<Exercise spec={SAMPLE_PLACE} verdict={PLACE_WRONG} media={GUIDE_MEDIA} onsubmit={noop} />
		</div>
	</GuideRow>
	<GuideRow label="Stack with a hidden layer">
		<div class="wide">
			<Exercise spec={SAMPLE_STACK} verdict={null} onsubmit={noop} />
		</div>
	</GuideRow>
	<GuideRow label="Flow, arrow label checked, with Show original">
		<div class="wide">
			<Exercise spec={SAMPLE_FLOW} verdict={FLOW_RIGHT} media={GUIDE_MEDIA} onsubmit={noop} />
		</div>
	</GuideRow>
	<GuideRow label="Connect: tap a box, then its target; tap an arrow chip to remove it">
		<div class="wide">
			<Exercise spec={SAMPLE_CONNECT} verdict={null} onsubmit={noop} />
		</div>
	</GuideRow>
	<GuideRow label="Too big to draw: shown as text">
		<div class="wide"><DiagramFigure figure={SAMPLE_TOO_BIG} /></div>
	</GuideRow>
	<GuideRow label="Occlusion editor: boxes, labels to place, hide mode">
		<div class="wide">
			<OcclusionEditor src={picture} fileName="network.png" bind:edit newId={() => 'guide-new'} />
		</div>
	</GuideRow>
	<GuideRow label="Diagram text editor with the rename list">
		<div class="wide">
			<DiagramTextEditor
				kind="flow"
				title="Query plan"
				bind:text={flowText}
				nodes={SAMPLE_FLOW_NODES}
				onrename={noop}
			/>
		</div>
	</GuideRow>
	<GuideRow label="Diagram text editor with an unreadable line">
		<div class="wide">
			<DiagramTextEditor kind="flow" title="Draft" bind:text={badText} />
		</div>
	</GuideRow>
</GuideSection>

<style>
	.wide {
		width: 100%;
		max-width: var(--content-max);
	}
</style>
