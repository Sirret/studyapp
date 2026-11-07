import type { Logger } from './logger.ts';

/** The part of `window` that error capture listens on. */
export interface ErrorEventTarget {
	addEventListener(type: string, listener: (event: Event) => void): void;
	removeEventListener(type: string, listener: (event: Event) => void): void;
}

const AREA = 'app';

function describe(reason: unknown): { message: string; stack?: string } {
	if (reason instanceof Error) return { message: reason.message, stack: reason.stack };
	try {
		return { message: String(reason) };
	} catch {
		return { message: 'unprintable value' };
	}
}

/**
 * Writes uncaught errors and unhandled promise rejections to the log as `error` entries with stack
 * traces. Returns a function that removes the listeners.
 *
 * @see BUILD_PLAN §11.5
 */
export function installErrorCapture(target: ErrorEventTarget, logger: Logger): () => void {
	const onError = (event: Event) => {
		const { error, message, filename, lineno, colno } = event as ErrorEvent;
		const described = describe(error ?? message);
		logger.error(AREA, described.message, {
			stack: described.stack,
			filename,
			lineno,
			colno
		});
	};
	const onRejection = (event: Event) => {
		const described = describe((event as PromiseRejectionEvent).reason);
		logger.error(AREA, described.message, { stack: described.stack });
	};
	target.addEventListener('error', onError);
	target.addEventListener('unhandledrejection', onRejection);
	return () => {
		target.removeEventListener('error', onError);
		target.removeEventListener('unhandledrejection', onRejection);
	};
}
