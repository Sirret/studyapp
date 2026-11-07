import Dexie, { type Table } from 'dexie';
import { DB_NAME } from '#lib/config/defaults.ts';
import type { Card } from './schemas/card.ts';
import type { Chunk, Course, Media, Topic } from './schemas/course.ts';
import type { StudyEvent } from './schemas/event.ts';
import type { KvKey } from './schemas/kv.ts';
import type { LogEntry, NewLogEntry } from './schemas/log-entry.ts';
import type { Note } from './schemas/note.ts';
import type { Session } from './schemas/session.ts';

/** The Dexie database. */
export type SnowpackDb = Dexie & {
	courses: Table<Course, string>;
	topics: Table<Topic, string>;
	chunks: Table<Chunk, string>;
	notes: Table<Note, string>;
	cards: Table<Card, string>;
	events: Table<StudyEvent, string>;
	media: Table<Media, string>;
	sessions: Table<Session, string>;
	/** Values are validated by `KvRepo`, the only code that touches this table. */
	kv: Table<{ key: KvKey; value: unknown }, KvKey>;
	logs: Table<LogEntry, number, NewLogEntry>;
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
