import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type {
	ChunkId,
	CourseId,
	DeviceId,
	MediaId,
	NoteId,
	TopicId
} from '#lib/db/schemas/common.ts';
import type { Media } from '#lib/db/schemas/course.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { clampBox, type OcclusionBox } from '#lib/engine/occlusion-edit.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { Result } from '#lib/util/result.ts';
import type { ImageEncoder, ImageSource } from './import-service.ts';
import { sha256Hex } from './import-preview-parts.ts';
import { draftNewNote, type NoteRegenWriter } from './note-regen.ts';
import { saveErrorMessage, type StorageGuard } from './storage-guard.ts';

const LOG_AREA = 'occlusion';

type OcclusionNote = Extract<Note, { type: 'occlusion' }>;

export type { OcclusionBox };

/** What the occlusion editor changes: boxes, labels still to place, hide mode and title. */
export interface OcclusionEdit {
	boxes: OcclusionBox[];
	unplaced: string[];
	hide: 'one' | 'all';
	/** The image's name for screen readers; empty = the file name. */
	title: string;
}

/** An occlusion note as the editor opens it: its edit fields and its image. */
export interface OcclusionDoc {
	noteId: NoteId;
	courseId: CourseId;
	topicId: TopicId;
	edit: OcclusionEdit;
	image: { mediaId: MediaId; blob: Blob; width: number; height: number; fileName?: string };
}

/**
 * The occlusion editor's service: open an image note, save its boxes (card IDs kept by box ID,
 * so moving, resizing or renaming a box keeps its history; a deleted box tombstones only its
 * card), and make a new image note from an upload, paste or photo.
 *
 * @see BUILD_PLAN §7.1; CONCEPT §13; Decisions log "Phase 6 Q10–Q13"
 */
export class OcclusionService {
	constructor(
		private readonly store: ContentStore,
		private readonly writer: NoteRegenWriter,
		private readonly encoder: ImageEncoder,
		private readonly guard: StorageGuard,
		private readonly logger: Logger
	) {}

	/** The note and its image, or `null` when either is gone or the note is not an image note. */
	async load(noteId: NoteId): Promise<OcclusionDoc | null> {
		const note = await this.store.notes.get(noteId);
		if (note?.type !== 'occlusion') return null;
		const media = await this.store.media.get(note.payload.mediaId);
		if (!media) return null;
		const { boxes, unplaced, hide, title } = note.payload;
		return {
			noteId: note.id,
			courseId: note.courseId,
			topicId: note.topicId,
			edit: { boxes, unplaced: unplaced ?? [], hide: hide ?? 'one', title: title ?? '' },
			image: {
				mediaId: media.id,
				blob: media.blob,
				width: media.width,
				height: media.height,
				...(media.fileName ? { fileName: media.fileName } : {})
			}
		};
	}

	/**
	 * Saves the editor's state: boxes clamped onto the image and labels trimmed. A box with no
	 * label makes no card; a note with no named box is still saved (no cards).
	 */
	async save(noteId: NoteId, edit: OcclusionEdit): Promise<Result<{ cards: number }, string>> {
		const note = await this.store.notes.get(noteId);
		if (note?.type !== 'occlusion') return { ok: false, error: 'This image no longer exists.' };
		const payload = toPayload(note.payload.mediaId, edit);
		return this.writer.save(
			note,
			{ type: 'occlusion', payload },
			{
				area: LOG_AREA,
				allowNoCards: true
			}
		);
	}

	/**
	 * A new image note with no boxes yet, at the end of the topic. The image is re-encoded like an
	 * import's and stored once (reused by original-file hash, then stored hash). Asks for
	 * persistent storage before the first image write; a full device gives the out-of-space message.
	 */
	async create(
		topicId: TopicId,
		chunkId: ChunkId | null,
		source: ImageSource
	): Promise<Result<NoteId, string>> {
		const topic = await this.store.topics.get(topicId);
		if (!topic) return { ok: false, error: 'This topic no longer exists.' };
		const deviceId = await this.store.getDeviceId();
		const image = await this.imageMedia(source, deviceId);
		if (!image.ok) return image;
		const { media, reused } = image.value;
		const content = { type: 'occlusion' as const, payload: { mediaId: media.id, boxes: [] } };
		const note = await draftNewNote(this.store, topic, chunkId, content, deviceId);
		try {
			if (!reused) await this.guard.ensurePersisted();
			await this.store.putBatch({ notes: [note], ...(reused ? {} : { media: [media] }) });
		} catch (error) {
			this.logger.error(LOG_AREA, 'image note not saved', { topicId, error: String(error) });
			return { ok: false, error: saveErrorMessage(error, 'Could not save this image.') };
		}
		this.logger.info(LOG_AREA, 'image note added', { noteId: note.id, reused });
		return { ok: true, value: note.id };
	}

	/** The stored image for an upload: an existing one (same original or stored bytes) or a new draft. */
	private async imageMedia(
		source: ImageSource,
		deviceId: DeviceId
	): Promise<Result<{ media: Media; reused: boolean }, string>> {
		const encoded = await this.encoder.encode(source.blob);
		if (!encoded.ok) return { ok: false, error: `${source.name}: ${encoded.error}` };
		const hash = await sha256Hex(encoded.value.blob);
		const sourceHash = await sha256Hex(source.blob);
		const stored =
			(await this.store.media.findBySourceHash(sourceHash)) ??
			(await this.store.media.findByHash(hash));
		if (stored) return { ok: true, value: { media: stored, reused: true } };
		const { blob, mime, width, height } = encoded.value;
		const media = this.store.media.draft(
			{ hash, sourceHash, mime, width, height, bytes: blob.size, blob, fileName: source.name },
			deviceId
		);
		return { ok: true, value: { media, reused: false } };
	}
}

/** The stored payload for an edit; defaults (hide one, file-name title, nothing unplaced) are left out. */
function toPayload(mediaId: MediaId, edit: OcclusionEdit): OcclusionNote['payload'] {
	const boxes = edit.boxes.map((box) => clampBox({ ...box, label: box.label.trim() }));
	const unplaced = edit.unplaced.map((label) => label.trim()).filter(Boolean);
	const title = edit.title.trim();
	return {
		mediaId,
		boxes,
		...(edit.hide === 'all' ? { hide: 'all' as const } : {}),
		...(title ? { title } : {}),
		...(unplaced.length > 0 ? { unplaced } : {})
	};
}
