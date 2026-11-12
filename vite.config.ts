import adapter from '@sveltejs/adapter-static';
import { withPwa } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';
import {
	APP_DESCRIPTION,
	APP_NAME,
	APP_SHORT_NAME,
	PWA_BACKGROUND_COLOR
} from './src/lib/config/defaults.ts';

/**
 * Sub-path the app is served from: empty locally, `/studyapp` on GitHub Pages (set by
 * `.github/workflows/pages.yml`). All in-app links go through `resolve()`, so they follow it.
 */
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

/**
 * @see BUILD_PLAN §1 (adapter-static SPA) and §8.3 (service worker). Dev-only routes (`/dev/*`) are
 * compiled in for `vite dev` and `vite build --mode test` (e2e), and left out of the deploy build.
 */
export default defineConfig(({ mode }) => ({
	define: { __DEV_ROUTES__: JSON.stringify(mode !== 'production') },
	plugins: [
		withPwa(
			{
				adapter: adapter({ fallback: 'index.html' }),
				paths: { base }
			},
			{
				// Absolute, so nested routes (e.g. /dev/ui) register /sw.js, not ./sw.js.
				base: `${base}/`,
				scope: `${base}/`,
				strategies: 'generateSW',
				registerType: 'prompt',
				injectRegister: false,
				kit: { adapterFallback: 'index.html', spa: true },
				manifest: {
					name: APP_NAME,
					short_name: APP_SHORT_NAME,
					description: APP_DESCRIPTION,
					start_url: `${base}/`,
					scope: `${base}/`,
					display: 'standalone',
					orientation: 'portrait',
					background_color: PWA_BACKGROUND_COLOR,
					theme_color: PWA_BACKGROUND_COLOR,
					icons: [
						{
							src: `${base}/icons/icon-192.png`,
							sizes: '192x192',
							type: 'image/png',
							purpose: 'any'
						},
						{
							src: `${base}/icons/icon-512.png`,
							sizes: '512x512',
							type: 'image/png',
							purpose: 'any'
						},
						{
							src: `${base}/icons/icon-maskable-512.png`,
							sizes: '512x512',
							type: 'image/png',
							purpose: 'maskable'
						}
					]
				},
				generateSW: {
					globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff2,webmanifest}'],
					// A pure SPA prerenders nothing, so the plugin's added prerendered/ glob matches no files.
					globStrict: false
				}
			}
		)
	]
}));
