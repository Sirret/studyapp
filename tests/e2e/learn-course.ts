import { expect, type Page } from '@playwright/test';

/**
 * A two-topic Import v2 course for the Phase 8.6 specs: Security (summary; Crypto with key terms
 * and a tip, Access) and Networks (summary; Layers, Addresses, Ports). Five sections in all.
 */
export const LEARN_TEXT = `@topic sec Security | from: Lecture I
@summary
Security keeps data safe.
@section Crypto
@keyterms
Cipher :: algorithm that encrypts data
Key :: secret that unlocks a cipher
@read
Encryption hides data. A key unlocks it again.
@tip
Lock and key.
@fact
Hash :: one-way fingerprint of data
@section Access
@read
Access control limits who can do what.
@fact
ACL :: list of permissions on a resource
RBAC :: permissions given by role
@topic net Networks | from: Lecture II
@summary
Networks move data.
@section Layers
@read
The OSI model has seven layers.
@fact
Router :: forwards packets between networks
Switch :: forwards frames within a network
@section Addresses
@read
IP addresses name hosts.
@fact
IPv4 :: thirty-two bit address
IPv6 :: hundred twenty-eight bit address
@section Ports
@read
Ports name services.
@fact
HTTP :: web traffic on port eighty
HTTPS :: secure web traffic on port four four three
@end`;

/** Imports the course and opens its course page. */
export async function openLearnCourse(page: Page): Promise<void> {
	await page.goto('/import');
	await page.getByLabel('New course').fill('Security and Networks');
	await page.getByRole('button', { name: 'Create course' }).click();
	await expect(page.getByRole('combobox', { name: 'Course' })).toHaveValue(/.+/);
	await page.getByLabel("Paste the chatbot's text").fill(LEARN_TEXT);
	await page.getByRole('button', { name: 'Check' }).click();
	await page.getByRole('button', { name: 'Add to course' }).click();
	await expect(page.getByRole('status')).toContainText('Added');
	await page.locator('[data-start-studying]').click();
	await expect(page).toHaveURL(/\/course\/[0-9a-f-]+$/);
	await expect(page.locator('[data-topics-read]')).toBeVisible();
}
