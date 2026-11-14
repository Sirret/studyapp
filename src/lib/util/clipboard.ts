/**
 * Copies text to the clipboard. Resolves to `false` when the browser refuses (no permission,
 * insecure context), so the caller can show the text for copying by hand instead.
 */
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
