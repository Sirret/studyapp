import { z } from 'zod';
import {
	ChunkIdSchema,
	CourseIdSchema,
	MediaIdSchema,
	MetaSchema,
	NoteIdSchema,
	PrioritySchema,
	TopicIdSchema
} from './common.ts';

/** Fewest steps a sequence or worked example can have. @see DATA_MODEL §4.2 */
export const MIN_STEPS = 2;

const DiagramPayloadSchema = z
	.object({
		kind: z.enum(['stack', 'flow']),
		name: z.string(),
		nodes: z.array(z.object({ id: z.uuid(), label: z.string(), role: z.string().optional() })),
		edges: z.array(
			z.object({
				id: z.uuid(),
				from: z.uuid(),
				to: z.uuid(),
				label: z.string().optional()
			})
		),
		layout: z.record(z.uuid(), z.object({ x: z.number(), y: z.number() })).optional(),
		sourceMediaId: MediaIdSchema.optional()
	})
	.refine((diagram) => diagram.kind !== 'stack' || diagram.edges.length === 0, {
		message: 'A stack diagram has no edges'
	})
	.refine(
		(diagram) => {
			const ids = new Set(diagram.nodes.map((node) => node.id));
			return diagram.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to));
		},
		{ message: 'Edge endpoints must exist' }
	);

const ComparePayloadSchema = z
	.object({
		items: z.array(z.string()),
		rows: z.array(z.object({ attribute: z.string(), values: z.array(z.string()) }))
	})
	.refine((table) => table.rows.every((row) => row.values.length === table.items.length), {
		message: 'Each row needs one value per item'
	});

const FractionSchema = z.number().min(0).max(1);

const OcclusionPayloadSchema = z.object({
	mediaId: MediaIdSchema,
	boxes: z.array(
		z.object({
			id: z.uuid(),
			x: FractionSchema,
			y: FractionSchema,
			w: FractionSchema,
			h: FractionSchema,
			label: z.string()
		})
	)
});

const NoteBaseSchema = MetaSchema.extend({
	courseId: CourseIdSchema,
	topicId: TopicIdSchema,
	chunkId: ChunkIdSchema.optional(),
	priority: PrioritySchema,
	tags: z.array(z.string()),
	generated: z.boolean(),
	check: z.boolean(),
	accept: z.record(z.string(), z.array(z.string()))
}).extend({ id: NoteIdSchema });

/**
 * A note: the `type` decides the shape of its `payload`.
 *
 * @see DATA_MODEL §3.4 and §4.2
 */
export const NoteSchema = z.discriminatedUnion('type', [
	NoteBaseSchema.extend({
		type: z.literal('keyterm'),
		payload: z.object({ term: z.string(), meaning: z.string() })
	}),
	NoteBaseSchema.extend({
		type: z.literal('fact'),
		payload: z.object({ term: z.string(), definition: z.string() })
	}),
	NoteBaseSchema.extend({ type: z.literal('cloze'), payload: z.object({ text: z.string() }) }),
	NoteBaseSchema.extend({
		type: z.literal('sequence'),
		payload: z.object({ name: z.string(), steps: z.array(z.string()).min(MIN_STEPS) })
	}),
	NoteBaseSchema.extend({
		type: z.literal('example'),
		payload: z.object({
			name: z.string(),
			steps: z.array(z.object({ subgoal: z.string(), step: z.string() })).min(MIN_STEPS)
		})
	}),
	NoteBaseSchema.extend({ type: z.literal('compare'), payload: ComparePayloadSchema }),
	NoteBaseSchema.extend({
		type: z.literal('scenario'),
		payload: z.object({ situation: z.string(), answer: z.string() })
	}),
	NoteBaseSchema.extend({ type: z.literal('diagram'), payload: DiagramPayloadSchema }),
	NoteBaseSchema.extend({ type: z.literal('occlusion'), payload: OcclusionPayloadSchema })
]);
export type Note = z.infer<typeof NoteSchema>;
export type NoteType = Note['type'];
