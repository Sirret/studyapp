import { expect, test, type Page } from '@playwright/test';
import { DB_NAME } from '../../src/lib/config/defaults.ts';

interface StoredLog {
	level: string;
	area: string;
	message: string;
	data?: { stack?: string };
}

/** Reads the `logs` store with plain IndexedDB, as an outside observer. */
function readLogs(page: Page): Promise<StoredLog[]> {
	return page.evaluate(
		(dbName) =>
			indexedDB.databases().then(
				(databases) =>
					new Promise<StoredLog[]>((resolve, reject) => {
						// Opening a database that does not exist yet would create an empty one.
						if (!databases.some((database) => database.name === dbName)) {
							resolve([]);
							return;
						}
						const open = indexedDB.open(dbName);
						open.onerror = () => reject(open.error);
						open.onsuccess = () => {
							const db = open.result;
							if (!db.objectStoreNames.contains('logs')) {
								db.close();
								resolve([]);
								return;
							}
							const all = db.transaction('logs').objectStore('logs').getAll();
							all.onerror = () => reject(all.error);
							all.onsuccess = () => {
								db.close();
								resolve(all.result as StoredLog[]);
							};
						};
					})
			),
		DB_NAME
	);
}

async function expectErrorLogged(page: Page, message: string): Promise<void> {
	await expect
		.poll(async () => {
			const logs = await readLogs(page);
			return logs.find((log) => log.level === 'error' && log.message.includes(message));
		})
		.toMatchObject({ data: { stack: expect.stringContaining(message) } });
}

test.describe('app log', () => {
	test('records that the app started', async ({ page }) => {
		await page.goto('/');
		await expect
			.poll(async () => (await readLogs(page)).map((log) => log.message))
			.toContain('started');
	});

	test('captures an uncaught error with its stack', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('heading').waitFor();
		await page.evaluate(() => {
			setTimeout(() => {
				throw new Error('e2e uncaught boom');
			});
		});
		await expectErrorLogged(page, 'e2e uncaught boom');
	});

	test('captures an unhandled rejection with its stack', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('heading').waitFor();
		await page.evaluate(() => {
			void Promise.reject(new Error('e2e rejected boom'));
		});
		await expectErrorLogged(page, 'e2e rejected boom');
	});
});
