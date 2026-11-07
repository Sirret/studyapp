import type { LogLevel, NewLogEntry } from '#lib/db/schemas/log-entry.ts';

/** Where entries are stored. `LogRepo` implements this. */
export interface LogSink {
	append(entry: NewLogEntry): Promise<void>;
}

/** The part of `console` the logger mirrors to in development. */
export type LogConsole = Pick<Console, LogLevel>;

export interface LoggerDeps {
	sink: LogSink;
	/** Returns the current time in epoch ms. */
	clock: () => number;
	/** Set in development only: entries are mirrored here too. */
	console?: LogConsole;
	/** Whether `debug` entries are kept; off by default. */
	debugEnabled?: boolean;
}

/** Stored `data` must be a JSON value (DATA_MODEL §6); anything else is reduced to one. */
function toJsonValue(data: unknown): NewLogEntry['data'] {
	if (data === undefined) return undefined;
	try {
		return JSON.parse(JSON.stringify(data)) as NewLogEntry['data'];
	} catch {
		return { unserialisable: String(data) };
	}
}

/**
 * The app logger. Logging must never break the app, so failures to store an entry are swallowed.
 *
 * @see BUILD_PLAN §11.5
 */
export class Logger {
	private debugEnabled: boolean;
	private pending: Promise<void> = Promise.resolve();

	constructor(private readonly deps: LoggerDeps) {
		this.debugEnabled = deps.debugEnabled ?? false;
	}

	/** Turns the `debug` level on or off (the settings toggle). */
	setDebugEnabled(enabled: boolean): void {
		this.debugEnabled = enabled;
	}

	/** Records a `debug` entry, only if debug logging is on. */
	debug(area: string, message: string, data?: unknown): void {
		if (this.debugEnabled) this.record('debug', area, message, data);
	}

	/** Records an `info` entry. */
	info(area: string, message: string, data?: unknown): void {
		this.record('info', area, message, data);
	}

	/** Records a `warn` entry. */
	warn(area: string, message: string, data?: unknown): void {
		this.record('warn', area, message, data);
	}

	/** Records an `error` entry. */
	error(area: string, message: string, data?: unknown): void {
		this.record('error', area, message, data);
	}

	/** Resolves once every entry recorded so far has been stored (or has failed to). */
	async flush(): Promise<void> {
		await this.pending;
	}

	private record(level: LogLevel, area: string, message: string, data: unknown): void {
		const json = toJsonValue(data);
		const entry: NewLogEntry = { ts: this.deps.clock(), level, area, message };
		if (json !== undefined) entry.data = json;
		this.deps.console?.[level](`[${area}] ${message}`, json ?? '');
		// Chained, so entries reach the sink in the order they were logged.
		this.pending = this.pending.then(() => this.store(entry));
	}

	private async store(entry: NewLogEntry): Promise<void> {
		try {
			await this.deps.sink.append(entry);
		} catch (error) {
			this.deps.console?.warn('[log] could not store an entry', error);
		}
	}
}
