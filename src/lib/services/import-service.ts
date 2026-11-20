import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type { CourseId, ImportId, Placement } from '#lib/db/schemas/common.ts';
import type { Course, ImportGoal, LastImport, Topic } from '#lib/db/schemas/course.ts';
import type { Note, NoteType } from '#lib/db/schemas/note.ts';
import type { ImportError } from '#lib/import/ast.ts';
import { buildPlan, type ImportPlan } from '#lib/import/build.ts';
import type { ReplyStatus } from '#lib/import/completeness.ts';
import { dropDuplicateNotes, type SkippedDuplicate } from '#lib/import/duplicates.ts';
import { starredGaps, type StarredGap } from '#lib/import/validate.ts';
import { parseImport } from '#lib/import/parser.ts';
import { fileKey, readImportZip } from '#lib/import/zip.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { Result } from '#lib/util/result.ts';
import { createEmptyCourse } from './course-new.ts';
import { addsRecords, ImportBatchDrafter } from './import-batch.ts';
import {
	checkedItems,
	countNoteTypes,
	flagGaps,
	referencedFiles,
	sha256Hex,
	type CheckedItem
} from './import-preview-parts.ts';
import {
	mapChecklist,
	matchTopic,
	nextCourseMap,
	resumeFor,
	type ChecklistItem
} from './import-map.ts';

/** An attached image before processing. */
export interface ImageSource {
	name: string;
	blob: Blob;
}

/** An attached image ready to store: resized, WebP, hashed. @see BUILD_PLAN §4.2 */
export interface PreparedImage {
	fileName: string;
	hash: string;
	width: number;
	height: number;
	blob: Blob;
}

/** A resized WebP image. */
export interface EncodedImage {
	blob: Blob;
	width: number;
	height: number;
}

/** Decodes and re-encodes images. The browser version lives in `web-image-encoder.ts`. */
export interface ImageEncoder {
	encode(source: Blob): Promise<Result<EncodedImage, string>>;
}

/** What one topic of an import would add. */
export interface TopicPreview {
	name: string;
	existing?: Topic;
	chunks: number;
	notes: number;
	cards: number;
}

/** Everything the preview screen shows, and what a commit writes. @see DESIGN Import */
export interface ImportPreview {
	plan: ImportPlan;
	/** The attached images some block names. */
	images: PreparedImage[];
	errors: ImportError[];
	topics: TopicPreview[];
	noteCounts: Partial<Record<NoteType, number>>;
	cardCount: number;
	chunkCount: number;
	generatedChunkCount: number;
	checked: CheckedItem[];
	/** Attached images no block names; they are not stored. */
	unusedImages: string[];
	/** The reply was finished (`@end`, or `@coverage` from older prompts); false: it may be cut off. */
	ended: boolean;
	/** Import v2: complete, stopped at `@next`, or cut off (its half-written last section dropped). */
	status: ReplyStatus;
	/** Skipped but harmless (unknown directives, text outside the code block). */
	warnings: ImportError[];
	/** The course map's topics, ticked when imported ("5 of 8 topics imported"). */
	checklist: ChecklistItem[];
	/** What the chatbot couldn't read (`@missing`). */
	missing: string[];
	/** A prompt to finish the course in a new chat, when topics are missing or the reply stopped. */
	resumePrompt: string | null;
	/** Cards whose starred words their reading doesn't say; their notes are flagged. */
	starredGaps: StarredGap[];
	/** Notes left out because the course (or an earlier line of the paste) already has them. */
	duplicates: SkippedDuplicate[];
}

/** What a commit wrote. */
export interface ImportSummary {
	topics: number;
	chunks: number;
	notes: number;
	cards: number;
	images: number;
}

/**
 * The import screen's work: images, preview, and an all-or-nothing commit.
 *
 * @see BUILD_PLAN §4
 */
export class ImportService {
	constructor(
		private readonly store: ContentStore,
		private readonly encoder: ImageEncoder,
		private readonly newId: () => string,
		private readonly logger: Logger
	) {}

	/** Lists courses to import into. */
	async listCourses(): Promise<Course[]> {
		return this.store.courses.list();
	}

	/** Creates a course with the default format and the next colour. @see DATA_MODEL §3.1 */
	async createCourse(name: string): Promise<Course> {
		return createEmptyCourse(this.store.courses, name);
	}

	/** Takes the text and images out of a zip. @see BUILD_PLAN §4.2 */
	openZip(bytes: Uint8Array): Result<{ text: string; images: ImageSource[] }, string> {
		const zip = readImportZip(bytes);
		if (!zip.ok) return zip;
		const images = zip.value.images.map(({ name, bytes: content, mime }) => ({
			name,
			blob: new Blob([new Uint8Array(content)], { type: mime })
		}));
		return { ok: true, value: { text: zip.value.text, images } };
	}

	/** Resizes, re-encodes and hashes images. @see BUILD_PLAN §4.2 */
	async prepareImages(
		sources: ImageSource[]
	): Promise<{ images: PreparedImage[]; errors: string[] }> {
		const images: PreparedImage[] = [];
		const errors: string[] = [];
		for (const { name, blob } of sources) {
			const encoded = await this.encoder.encode(blob);
			if (encoded.ok) {
				images.push({
					fileName: name,
					hash: await sha256Hex(encoded.value.blob),
					...encoded.value
				});
			} else {
				errors.push(`${name}: ${encoded.error}`);
			}
		}
		return { images, errors };
	}

	/** Parses and builds, writing nothing. @see BUILD_PLAN §4.1 */
	async preview(courseId: CourseId, text: string, images: PreparedImage[]): Promise<ImportPreview> {
		const parsed = parseImport(text);
		const built = buildPlan(parsed.document, {
			files: new Set(images.map((image) => fileKey(image.fileName))),
			newId: this.newId
		});
		const { plan } = built;
		const deduped = dropDuplicateNotes(plan.topics, await this.courseNotes(courseId));
		plan.topics = deduped.result.topics;
		const gaps = starredGaps(plan);
		flagGaps(plan, gaps);
		const existing = await this.store.topics.listByCourse(courseId);
		const course = await this.store.courses.get(courseId);
		const map = course ? nextCourseMap(course, plan) : undefined;
		const checklist = mapChecklist(map, plan, existing);
		const referenced = referencedFiles(plan);
		const isUsed = (image: PreparedImage) => referenced.has(fileKey(image.fileName));
		return {
			plan,
			images: images.filter(isUsed),
			errors: [...parsed.errors, ...built.errors].sort((a, b) => a.line - b.line),
			topics: plan.topics.map((topic) => ({
				name: topic.name,
				existing: matchTopic(existing, topic),
				chunks: topic.chunks.length,
				notes: topic.notes.length,
				cards: topic.notes.reduce((sum, note) => sum + note.cards.length, 0)
			})),
			noteCounts: countNoteTypes(plan),
			cardCount: plan.topics.flatMap((topic) => topic.notes).flatMap((note) => note.cards).length,
			chunkCount: plan.topics.flatMap((topic) => topic.chunks).length,
			generatedChunkCount: plan.topics
				.flatMap((topic) => topic.chunks)
				.filter((chunk) => chunk.source === 'generated').length,
			checked: checkedItems(plan, text),
			unusedImages: images.filter((image) => !isUsed(image)).map((image) => image.fileName),
			ended:
				plan.status === 'complete' ||
				parsed.document.blocks.some((block) => block.kind === 'coverage'),
			status: plan.status,
			warnings: parsed.warnings,
			checklist,
			missing: map?.missing ?? [],
			resumePrompt: resumeFor(map, checklist, plan),
			starredGaps: gaps,
			duplicates: deduped.result.skipped
		};
	}

	/** The course's live notes, which a new import must not repeat. */
	private async courseNotes(courseId: CourseId): Promise<Note[]> {
		const topics = await this.store.topics.listByCourse(courseId);
		const perTopic = await Promise.all(topics.map((t) => this.store.notes.listByTopic(t.id)));
		return perTopic.flat();
	}

	/**
	 * Writes a previewed import, all or nothing. A placement missing from `placements` leaves an
	 * existing topic as it is and starts a new one as unread.
	 *
	 * @see BUILD_PLAN §4.1
	 */
	async commit(
		courseId: CourseId,
		preview: ImportPreview,
		placements: ReadonlyMap<string, Placement>,
		goal?: ImportGoal
	): Promise<Result<ImportSummary, string>> {
		const course = await this.store.courses.get(courseId);
		if (!course) return { ok: false, error: 'That course no longer exists.' };
		try {
			const deviceId = await this.store.getDeviceId();
			const importId = this.newId() as ImportId;
			const drafter = new ImportBatchDrafter(this.store, deviceId, importId);
			const batch = await drafter.draft({
				courseId,
				topics: preview.plan.topics,
				images: preview.images,
				placements
			});
			const map = nextCourseMap(course, preview.plan, goal);
			const lastImport: LastImport = {
				importId,
				at: this.store.now(),
				topicsBefore: drafter.topicsBefore(),
				mapBefore: course.map ?? null
			};
			// A paste whose every note was a duplicate adds nothing to undo: keep the previous lastImport.
			const changes = {
				...(map ? { map } : {}),
				...(addsRecords(batch, importId) ? { lastImport } : {})
			};
			batch.courses = [this.store.courses.draftChange(course, changes, deviceId)];
			await this.store.writeBatch(batch);
			const summary = {
				topics: preview.topics.length,
				chunks: batch.chunks.length,
				notes: batch.notes.length,
				cards: batch.cards.length,
				images: batch.media.length
			};
			this.logger.info('import', 'committed', summary);
			return { ok: true, value: summary };
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			this.logger.error('import', 'commit failed', { reason });
			return { ok: false, error: `The import could not be saved: ${reason}` };
		}
	}
}
