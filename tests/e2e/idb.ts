import type { Page } from '@playwright/test';

/** Reads every record of a table straight from IndexedDB, as the app stored it. */
export async function readTable(page: Page, table: string): Promise<Record<string, unknown>[]> {
	return page.evaluate(
		(name) =>
			new Promise<Record<string, unknown>[]>((resolve, reject) => {
				const open = indexedDB.open('snowpack');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const request = open.result.transaction(name).objectStore(name).getAll();
					request.onerror = () => reject(request.error);
					request.onsuccess = () => {
						open.result.close();
						resolve(request.result);
					};
				};
			}),
		table
	);
}
