/**
 * Where a finished session may send the student: only a path on this app's own origin. Anything
 * that could leave the origin (`//x`, `/\x`, `https://x`, encoded tricks) gives `null`, and the
 * screen falls back to Today.
 *
 * @see BUILD_PLAN §9 (`/study/[sessionId]?back=`)
 */
export function safeBackPath(back: string | null, origin: string): string | null {
	const FIRST_PRINTABLE = 0x20;
	const unsafe = [...(back ?? '')].some((c) => c === '\\' || c.charCodeAt(0) < FIRST_PRINTABLE);
	if (!back || !back.startsWith('/') || unsafe) return null;
	let parsed: URL;
	try {
		parsed = new URL(back, origin);
	} catch {
		return null;
	}
	if (parsed.origin !== new URL(origin).origin) return null;
	return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
