import type { Logger } from './logger';

/** The part of `window` that error capture listens on. */
export interface ErrorEventTarget {
	addEventListener(type: string, listener: (event: Event) => void): void;
	removeEventListener(type: string, listener: (event: Event) => void): void;
}

/**
 * Writes uncaught errors and unhandled promise rejections to the log as `error` entries with stack
 * traces. Returns a function that removes the listeners.
 *
 * @see BUILD_PLAN §11.5
 */
export function installErrorCapture(_target: ErrorEventTarget, _logger: Logger): () => void {
	throw new Error('not implemented');
}
