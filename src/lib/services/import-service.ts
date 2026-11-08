import { DEFAULT_EXAM_FORMAT } from '#lib/config/defaults.ts';
import type { ContentStore } from '#lib/db/repos/content-store.ts';
import {
	CourseColorSchema,
	type CourseColor,
	type CourseId,
	type Placement
} from '#lib/db/schemas/common.ts';
import type { Course, Topic } from '#lib/db/schemas/course.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import type { ImportError } from '#lib/import/ast.ts';
import { buildPlan, type ImportPlan } from '#lib/import/build.ts';
import { readLine, splitLines } from '#lib/import/lexer.ts';
import { parseImport } from '#lib/import/parser.ts';
import { fileKey, readImportZip } from '#lib/import/zip.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { Result } from '#lib/util/result.ts';
import { ImportBatchDrafter } from './import-batch.ts';

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

/** A line the chatbot marked `[CHECK]`. */
export interface CheckedItem {
	line: number;
	text: string;
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
}

/** What a commit wrote. */
export interface ImportSummary {
	topics: number;
	chunks: number;
	notes: number;
	cards: number;
	images: number;
}

async function sha256Hex(blob: Blob): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The file keys a plan needs images for. */
function referencedFiles(plan: ImportPlan): Set<string> {
	const files = plan.topics
		.flatMap((topic) => topic.notes)
		.flatMap((note) => [
			...(note.content.type === 'occlusion' ? [note.content.file] : []),
			...(note.sourceFile ? [note.sourceFile] : [])
		]);
	return new Set(files.map(fileKey));
}

function countNoteTypes(plan: ImportPlan): Partial<Record<NoteType, number>> {
	const counts: Partial<Record<NoteType, number>> = {};
	for (const note of plan.topics.flatMap((topic) => topic.notes)) {
		counts[note.content.type] = (counts[note.content.type] ?? 0) + 1;
	}
	return counts;
}

function checkedItems(plan: ImportPlan, text: string): CheckedItem[] {
	const sourceLines = splitLines(text);
	const fromNotes = plan.topics
		.flatMap((topic) => topic.notes)
		.filter((note) => note.isChecked)
		.map(({ line }) => ({ line, text: readLine(sourceLines[line - 1] ?? '').text }));
	const fromChunks = plan.topics
		.flatMap((topic) => topic.chunks)
		.filter((chunk) => chunk.check)
		.map(({ line, text: chunkText }) => ({ line, text: chunkText.split('\n')[0] ?? '' }));
	return [...fromNotes, ...fromChunks].sort((a, b) => a.line - b.line);
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
		const colors = CourseColorSchema.options;
		const existing = await this.store.courses.list();
		return this.store.courses.create({
			name,
			status: 'active',
			examFormat: DEFAULT_EXAM_FORMAT,
			color: colors[existing.length % colors.length] as CourseColor
		});
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
		const existing = await this.store.topics.listByCourse(courseId);
		const referenced = referencedFiles(plan);
		const isUsed = (image: PreparedImage) => referenced.has(fileKey(image.fileName));
		return {
			plan,
			images: images.filter(isUsed),
			errors: [...parsed.errors, ...built.errors].sort((a, b) => a.line - b.line),
			topics: plan.topics.map((topic) => ({
				name: topic.name,
				existing: existing.find((candidate) => candidate.name === topic.name),
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
			ended: parsed.document.blocks.some(
				(block) => block.kind === 'end' || block.kind === 'coverage'
			)
		};
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
		placements: ReadonlyMap<string, Placement>
	): Promise<Result<ImportSummary, string>> {
		if (!(await this.store.courses.get(courseId))) {
			return { ok: false, error: 'That course no longer exists.' };
		}
		try {
			const drafter = new ImportBatchDrafter(this.store, await this.store.getDeviceId());
			const batch = await drafter.draft({
				courseId,
				topics: preview.plan.topics,
				images: preview.images,
				placements
			});
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
