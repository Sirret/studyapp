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

describe('addSampleCourse', () => {
	it('a second tap while the first runs gets the same promise and does not seed again', async () => {
		seed.mockResolvedValue({ kind: 'added', courseId: 'c1' });
		const { addSampleCourse } = await load();
		const first = addSampleCourse();
		const second = addSampleCourse();
		expect(second).toBe(first);
		expect(await first).toBe('c1');
		expect(seed).toHaveBeenCalledTimes(1);
	});

	it('a later tap seeds again (Welcome shows whenever there are no courses)', async () => {
		seed.mockResolvedValue({ kind: 'added', courseId: 'c1' });
		const { addSampleCourse } = await load();
		await addSampleCourse();
		await addSampleCourse();
		expect(seed).toHaveBeenCalledTimes(2);
	});

	it('resolves to null when the student already has courses', async () => {
		seed.mockResolvedValue({ kind: 'has-courses' });
		const { addSampleCourse } = await load();
		expect(await addSampleCourse()).toBeNull();
	});

	it('logs and swallows a failure, resolving to null', async () => {
		seed.mockRejectedValue(new Error('boom'));
		const { addSampleCourse } = await load();
		await expect(addSampleCourse()).resolves.toBeNull();
		expect(error).toHaveBeenCalledWith('sample', 'sample course not added', {
			error: 'Error: boom'
		});
	});
});
