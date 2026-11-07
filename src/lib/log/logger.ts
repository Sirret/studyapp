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

/**
 * The app logger. Logging must never break the app, so failures to store an entry are swallowed.
 *
 * @see BUILD_PLAN §11.5
 */
export class Logger {
	constructor(private readonly deps: LoggerDeps) {}

	/** Turns the `debug` level on or off (the settings toggle). */
	setDebugEnabled(_enabled: boolean): void {
		void this.deps;
		throw new Error('not implemented');
	}

	/** Records a `debug` entry, only if debug logging is on. */
	debug(_area: string, _message: string, _data?: unknown): void {
		throw new Error('not implemented');
	}

	/** Records an `info` entry. */
	info(_area: string, _message: string, _data?: unknown): void {
		throw new Error('not implemented');
	}

	/** Records a `warn` entry. */
	warn(_area: string, _message: string, _data?: unknown): void {
		throw new Error('not implemented');
	}

	/** Records an `error` entry. */
	error(_area: string, _message: string, _data?: unknown): void {
		throw new Error('not implemented');
	}

	/** Resolves once every entry recorded so far has been stored (or has failed to). */
	async flush(): Promise<void> {
		throw new Error('not implemented');
	}
}
