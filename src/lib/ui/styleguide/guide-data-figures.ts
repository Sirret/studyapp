/**
 * Sample data for the Phase 6 figure components in the style guide (dev builds only). The picture
 * is a small inline SVG, so screenshots never depend on a stored image; diagram layouts come from
 * the real preview, as the editor's would. Nothing here is stored.
 */
import { previewDiagram } from '#lib/services/figure-edit.ts';
import type { OcclusionEdit } from '#lib/services/occlusion-service.ts';
import type {
	ConnectSpec,
	DiagramFigure,
	ExerciseVerdict,
	MediaId,
	OcclusionFigure,
	PlaceSpec,
	TypeSpec
} from '#lib/services/study-types.ts';
import { previewFigure } from '../figures/figure-geometry.ts';
import type { MediaLoader } from '../figures/media-url.ts';

const PICTURE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200">
<rect width="400" height="200" fill="#f4efe4"/>
<g fill="none" stroke="#3b3a36" stroke-width="3"><path d="M80 100H200M200 100H320M200 100V40"/></g>
<g fill="#ffffff" stroke="#3b3a36" stroke-width="3">
<rect x="30" y="80" width="100" height="40" rx="6"/><rect x="150" y="80" width="100" height="40" rx="6"/>
<rect x="270" y="80" width="100" height="40" rx="6"/><rect x="150" y="20" width="100" height="40" rx="6"/></g>
<g font-family="sans-serif" font-size="16" text-anchor="middle" fill="#3b3a36">
<text x="80" y="106">Host</text><text x="200" y="106">Switch</text>
<text x="320" y="106">Host</text><text x="200" y="46">Router</text></g></svg>`;

/** Gives the sample picture for any id. */
export const GUIDE_MEDIA: MediaLoader = () =>
	Promise.resolve(new Blob([PICTURE], { type: 'image/svg+xml' }));

const PICTURE_ID = 'guide-picture' as MediaId;
const BOXES = [
	{ id: 'router', x: 0.375, y: 0.1, w: 0.25, h: 0.2 },
	{ id: 'switch', x: 0.375, y: 0.4, w: 0.25, h: 0.2 },
	{ id: 'left', x: 0.075, y: 0.4, w: 0.25, h: 0.2 }
];

const occlusion = (covered: string[], target: string | null): OcclusionFigure => ({
	kind: 'occlusion',
	mediaId: PICTURE_ID,
	title: 'Small network',
	boxes: BOXES,
	covered,
	target
});

export const SAMPLE_OCCLUSION_TYPE = {
	shape: 'type',
	kind: 'occlusionType',
	cardId: 'guide-occ-type',
	prompt: 'What is hidden here?',
	instruction: 'Type the hidden label',
	figure: occlusion(['router'], 'router')
} as unknown as TypeSpec;

export const SAMPLE_OCCLUSION_ALL = occlusion(['router', 'switch', 'left'], 'switch');

export const SAMPLE_PLACE = {
	shape: 'place',
	kind: 'occlusionDrag',
	cardId: 'guide-place',
	prompt: 'Where does it go?',
	instruction: 'Place the label',
	figure: occlusion(['router', 'switch', 'left'], null),
	label: 'Switch',
	boxId: 'switch'
} as unknown as PlaceSpec;

export const PLACE_WRONG: ExerciseVerdict = {
	correct: false,
	reveal: ['Switch'],
	chosen: 'router',
	marks: []
};

const stack = previewFigure(
	'stack',
	'OSI model',
	previewDiagram('stack', 'Application\nTransport\nNetwork\nData link\nPhysical')
);

export const SAMPLE_STACK = {
	shape: 'type',
	kind: 'nodeCloze',
	cardId: 'guide-stack',
	prompt: 'Which layer is hidden?',
	instruction: 'Name the hidden part',
	figure: {
		...stack,
		nodes: stack.nodes.map((n, i) => (i === 2 ? { ...n, label: null } : n)),
		target: stack.nodes[2]?.id ?? null
	}
} as unknown as TypeSpec;

const FLOW_TEXT = 'Table scan -> Filter : rows\nFilter -> Sort\nSort -> Output : sorted';
const flow = previewFigure('flow', 'Query plan', previewDiagram('flow', FLOW_TEXT));
const asked = flow.edges[0];

export const SAMPLE_FLOW = {
	shape: 'type',
	kind: 'edgeCloze',
	cardId: 'guide-flow',
	prompt: 'What flows along the highlighted arrow?',
	instruction: 'Name the hidden part',
	figure: {
		...flow,
		edges: flow.edges.map((e) => (e.id === asked?.id ? { ...e, label: null } : e)),
		target: asked?.id ?? null,
		sourceMediaId: PICTURE_ID
	}
} as unknown as TypeSpec;

export const FLOW_RIGHT: ExerciseVerdict = { correct: true, reveal: ['rows'], marks: [] };

export const SAMPLE_CONNECT = {
	shape: 'connect',
	kind: 'structureRebuild',
	cardId: 'guide-connect',
	prompt: 'Draw the arrows of the query plan.',
	instruction: 'Rebuild the diagram',
	figure: { ...flow, edges: [], target: null },
	edges: flow.edges.map((e) => ({ from: e.from, to: e.to }))
} as unknown as ConnectSpec;

export const SAMPLE_TOO_BIG: DiagramFigure = { ...flow, layout: null };

export const SAMPLE_EDIT: OcclusionEdit = {
	boxes: [
		{ ...BOXES[0]!, label: 'Router' },
		{ ...BOXES[1]!, label: '' }
	],
	unplaced: ['Host', 'Host B'],
	hide: 'one',
	title: ''
};

export const SAMPLE_FLOW_TEXT = FLOW_TEXT;
export const SAMPLE_FLOW_NODES = flow.nodes.map((n) => ({ id: n.id, label: n.label ?? '' }));
