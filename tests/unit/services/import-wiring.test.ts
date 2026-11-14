import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { seed, error } = vi.hoisted(() => ({ seed: vi.fn(), error: vi.fn() }));
vi.mock('#lib/services/sample-course.ts', () => ({ seedSampleCourse: seed }));
// app.ts needs Kit's `$app/env`; the wiring only uses its db and logger.
vi.mock('#lib/services/app.ts', async () => {
	const { createDb } = await import('#lib/db/schema.ts');
	return { db: createDb(`wiring-${crypto.randomUUID()}`), logger: { error, info: vi.fn() } };
});

/** A fresh copy of the wiring module, so its once-per-load promise starts empty. */
async function load(): Promise<typeof import('#lib/services/import-wiring.ts')> {
	vi.resetModules();
	return import('#lib/services/import-wiring.ts');
}

beforeEach(() => {
	seed.mockReset();
	error.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('ensureSampleCourse', () => {
	it('runs once per load: a second call gets the same promise and does not seed again', async () => {
		seed.mockResolvedValue('added');
		const { ensureSampleCourse } = await load();
		const first = ensureSampleCourse();
		const second = ensureSampleCourse();
		expect(second).toBe(first);
		expect(await first).toBe(true);
		expect(seed).toHaveBeenCalledTimes(1);
	});

	it('resolves to false when the seeder found nothing to add', async () => {
		seed.mockResolvedValue('has-courses');
		const { ensureSampleCourse } = await load();
		expect(await ensureSampleCourse()).toBe(false);
	});

	it('logs and swallows a failure, resolving to false', async () => {
		seed.mockRejectedValue(new Error('boom'));
		const { ensureSampleCourse } = await load();
		await expect(ensureSampleCourse()).resolves.toBe(false);
		expect(seed).toHaveBeenCalledTimes(1);
		expect(error).toHaveBeenCalledWith('sample', 'sample course not added', {
			error: 'Error: boom'
		});
	});
});
