import Dexie, { type EntityTable } from 'dexie';
import { DB_NAME } from '#lib/config/defaults.ts';
import type { LogEntry } from './schemas/log-entry';

/** The Dexie database. Entity tables gain their record types as their schemas are added. */
export type SnowpackDb = Dexie & {
	logs: EntityTable<LogEntry, 'seq'>;
};

/**
 * Opens the database with the version 1 tables and indexes.
 *
 * @see BUILD_PLAN §3.1
 * @see DATA_MODEL §3
 */
export function createDb(name: string = DB_NAME): SnowpackDb {
	const db = new Dexie(name) as SnowpackDb;
	db.version(1).stores({
		courses: 'id, status, examDate, updatedAt',
		topics: 'id, courseId, [courseId+order], updatedAt',
		chunks: 'id, topicId, [topicId+order], updatedAt',
		notes: 'id, courseId, topicId, chunkId, type, updatedAt',
		cards: 'id, noteId, courseId, status, due, updatedAt',
		events: 'id, ts, cardId, sessionId, type, [cardId+ts]',
		media: 'id, hash',
		sessions: 'id, startedAt, mode',
		kv: 'key',
		logs: '++seq, ts, level, area'
	});
	return db;
}
