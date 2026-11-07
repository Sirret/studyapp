import { describe, expect, it, vi } from 'vitest';
import type { NewLogEntry } from '#lib/db/schemas/log-entry.ts';
import { installErrorCapture } from '#lib/log/error-capture.ts';
import { Logger, type LogConsole, type LogSink } from '#lib/log/logger.ts';

const NOW = 1_000;

function setup(options: { console?: LogConsole; debugEnabled?: boolean } = {}) {
	const entries: NewLogEntry[] = [];
	const sink: LogSink = {
		append: async (entry) => {
			entries.push(entry);
		}
	};
	return { entries, logger: new Logger({ sink, clock: () => NOW, ...options }) };
}

describe('Logger', () => {
	it('stores each level with the injected time', async () => {
		const { entries, logger } = setup();
		logger.info('a', 'one', { n: 1 });
		logger.warn('b', 'two');
		logger.error('c', 'three');
		await logger.flush();

		expect(entries).toEqual([
			{ ts: NOW, level: 'info', area: 'a', message: 'one', data: { n: 1 } },
			{ ts: NOW, level: 'warn', area: 'b', message: 'two' },
			{ ts: NOW, level: 'error', area: 'c', message: 'three' }
		]);
	});

	it('drops debug entries until debug logging is turned on', async () => {
		const { entries, logger } = setup();
		logger.debug('a', 'hidden');
		logger.setDebugEnabled(true);
		logger.debug('a', 'shown');
		await logger.flush();

		expect(entries.map((entry) => entry.message)).toEqual(['shown']);
	});

	it('mirrors to the console only when given one', async () => {
		const mirror: LogConsole = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn()
		};
		const { logger } = setup({ console: mirror });
		logger.error('a', 'boom');
		await logger.flush();

		expect(mirror.error).toHaveBeenCalledOnce();
	});

	it('never throws when the sink rejects, and keeps logging', async () => {
		const stored: string[] = [];
		const append = vi
			.fn<LogSink['append']>()
			.mockRejectedValueOnce(new Error('disk full'))
			.mockImplementation(async (entry) => {
				stored.push(entry.message);
			});
		const logger = new Logger({ sink: { append }, clock: () => NOW });

		expect(() => logger.info('a', 'lost')).not.toThrow();
		logger.info('a', 'kept');
		await expect(logger.flush()).resolves.toBeUndefined();

		expect(stored).toEqual(['kept']);
	});

	it('stores data as a JSON value, even when it cannot be serialised', async () => {
		const { entries, logger } = setup();
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		logger.info('a', 'dropped keys', { keep: 1, drop: () => 0 });
		logger.info('a', 'circular', circular);
		await logger.flush();

		expect(entries[0]?.data).toEqual({ keep: 1 });
		expect(entries[1]?.data).toHaveProperty('unserialisable');
	});
});

describe('installErrorCapture', () => {
	function rejection(reason: unknown): Event {
		return Object.assign(new Event('unhandledrejection'), { reason });
	}

	it('logs uncaught errors with their stack', async () => {
		const { entries, logger } = setup();
		const target = new EventTarget();
		installErrorCapture(target, logger);

		const error = new Error('boom');
		target.dispatchEvent(Object.assign(new Event('error'), { error, filename: 'a.js', lineno: 7 }));
		await logger.flush();

		expect(entries[0]).toMatchObject({
			level: 'error',
			message: 'boom',
			data: { stack: error.stack, filename: 'a.js', lineno: 7 }
		});
	});

	it('logs an error event that has only a message', async () => {
		const { entries, logger } = setup();
		const target = new EventTarget();
		installErrorCapture(target, logger);

		target.dispatchEvent(Object.assign(new Event('error'), { message: 'script error' }));
		await logger.flush();

		expect(entries[0]?.message).toBe('script error');
	});

	it('logs unhandled rejections, with or without an Error', async () => {
		const { entries, logger } = setup();
		const target = new EventTarget();
		installErrorCapture(target, logger);

		const error = new Error('rejected');
		target.dispatchEvent(rejection(error));
		target.dispatchEvent(rejection('plain reason'));
		await logger.flush();

		expect(entries[0]).toMatchObject({ message: 'rejected', data: { stack: error.stack } });
		expect(entries[1]?.message).toBe('plain reason');
	});

	it('stops logging once uninstalled', async () => {
		const { entries, logger } = setup();
		const target = new EventTarget();
		const uninstall = installErrorCapture(target, logger);

		uninstall();
		target.dispatchEvent(rejection('ignored'));
		target.dispatchEvent(new Event('error'));
		await logger.flush();

		expect(entries).toEqual([]);
	});
});
