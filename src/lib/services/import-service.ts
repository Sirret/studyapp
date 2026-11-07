import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type { CourseId, Placement } from '#lib/db/schemas/common.ts';
import type { Course, Topic } from '#lib/db/schemas/course.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import type { ImportError } from '#lib/import/ast.ts';
import type { ImportPlan } from '#lib/import/build.ts';
import type { ImportZip } from '#lib/import/zip.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { Result } from '#lib/util/result.ts';

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
 * The import screen's work: images, preview, and the commit in one transaction.
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
		throw new Error('not implemented');
	}

	/** Creates a course with the default format and the next colour. @see DATA_MODEL §3.1 */
	async createCourse(_name: string): Promise<Course> {
		throw new Error('not implemented');
	}

	/** Takes the text and images out of a dropped zip. @see BUILD_PLAN §4.2 */
	openZip(_bytes: Uint8Array): Result<ImportZip, string> {
		throw new Error('not implemented');
	}

	/** Resizes, re-encodes and hashes images. @see BUILD_PLAN §4.2 */
	async prepareImages(
		_sources: ImageSource[]
	): Promise<{ images: PreparedImage[]; errors: string[] }> {
		throw new Error('not implemented');
	}

	/** Parses and builds, writing nothing. @see BUILD_PLAN §4.1 */
	async preview(
		_courseId: CourseId,
		_text: string,
		_images: PreparedImage[]
	): Promise<ImportPreview> {
		throw new Error('not implemented');
	}

	/** Writes a previewed import, all or nothing. @see BUILD_PLAN §4.1 */
	async commit(
		_courseId: CourseId,
		_preview: ImportPreview,
		_placements: ReadonlyMap<string, Placement>
	): Promise<Result<ImportSummary, string>> {
		void [this.store, this.encoder, this.newId, this.logger];
		throw new Error('not implemented');
	}
}
