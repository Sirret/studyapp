import { CardRepo } from '#lib/db/repos/content-repos.ts';
import { ContentStore } from '#lib/db/repos/content-store.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { EventRepo } from '#lib/db/repos/event-repo.ts';
import { db, logger } from './app.ts';
import { DiagramService } from './diagram-service.ts';
import { NoteRegenWriter } from './note-regen.ts';
import { OcclusionService } from './occlusion-service.ts';
import { kvReplayConfig, ReplayService } from './replay-service.ts';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import { StorageGuard } from './storage-guard.ts';
import { WebImageEncoder } from './web-image-encoder.ts';

export { addBox, clampBox, moveBox, placeLabel, removeBox, resizeBox } from './figure-edit.ts';
export type { DiagramDoc, DiagramPreview, DiagramSaveError } from './diagram-service.ts';
export type { OcclusionBox, OcclusionDoc, OcclusionEdit } from './occlusion-service.ts';

const newId = () => crypto.randomUUID();
const clock = () => Date.now();
const device = new DeviceRepo(db, newId);
const context = { clock, newId, getDeviceId: () => device.getDeviceId() };
const store = new ContentStore(db, context);
const tzOffsetMin = (): number => -new Date().getTimezoneOffset();
const events = new EventRepo(db, { clock, newId, device, tzOffsetMin });
const replay = new ReplayService(
	events,
	new CardRepo(db, context),
	logger,
	kvReplayConfig(new KvRepo(db), tzOffsetMin)
);
const writer = new NoteRegenWriter(store, replay, logger);

/** Ids for the editors' new boxes (the pure edit helpers take `newId`). */
export const newFigureId = newId;

/**
 * The figure editors' services. Imported only by the lazy editor routes, so the engine, zod and
 * the image encoder stay out of the app shell.
 *
 * @see CLAUDE.md rule 9; BUILD_PLAN §7
 */
export const occlusionService = new OcclusionService(
	store,
	writer,
	new WebImageEncoder(),
	new StorageGuard(typeof navigator === 'undefined' ? undefined : navigator.storage, logger),
	logger
);

/** @see BUILD_PLAN §7.2 */
export const diagramService = new DiagramService(store, writer, newId, logger);
