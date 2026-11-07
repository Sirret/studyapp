import { z } from 'zod';

/** @see BUILD_PLAN §11.5 */
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

/**
 * One line of the app log, as stored in the `logs` table.
 *
 * @see DATA_MODEL §6
 */
export const LogEntrySchema = z.object({
	seq: z.number().int().positive(),
	ts: z.number(),
	level: LogLevelSchema,
	area: z.string().min(1),
	message: z.string(),
	data: z.json().optional()
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

/** A log line before IndexedDB assigns its `seq`. */
export type NewLogEntry = Omit<LogEntry, 'seq'>;
