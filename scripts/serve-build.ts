/**
 * Serves `build/` the way the static host does: real files first, then the SPA fallback. Kit's own
 * preview serves its intermediate output, which has no `index.html`, so the service worker's
 * precache cannot complete there.
 *
 * Usage: `npm run preview -- --port 4173`
 *
 * @see BUILD_PLAN §1 (Hosting) and §8.3
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';

const BUILD_DIR = path.resolve('build');
const FALLBACK = path.join(BUILD_DIR, 'index.html');
const DEFAULT_PORT = '4173';
const CONTENT_TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
	'.woff2': 'font/woff2',
	'.wasm': 'application/wasm'
};

/** Maps a request path to a file inside `build/`, or to the fallback for anything else. */
function resolveFile(urlPath: string): string {
	const file = path.join(BUILD_DIR, decodeURIComponent(urlPath));
	const isInside = file.startsWith(BUILD_DIR + path.sep);
	return isInside && existsSync(file) && statSync(file).isFile() ? file : FALLBACK;
}

if (!existsSync(FALLBACK)) {
	console.error('No build found. Run `npm run build` first.');
	process.exitCode = 1;
} else {
	const { values } = parseArgs({
		options: { port: { type: 'string', default: DEFAULT_PORT } },
		allowPositionals: true,
		strict: false
	});
	const port = Number(values.port);

	createServer((request, response) => {
		const { pathname } = new URL(request.url ?? '/', 'http://localhost');
		const file = resolveFile(pathname);
		const contentType = CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream';
		response.writeHead(200, { 'Content-Type': contentType });
		createReadStream(file).pipe(response);
	}).listen(port, () => console.log(`Serving build/ at http://localhost:${port}`));
}
