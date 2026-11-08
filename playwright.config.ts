import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCi = Boolean(process.env.CI);

/** @see BUILD_PLAN §11.1 (e2e at 360 × 740) and §11.3 (reports) */
export default defineConfig({
	testDir: 'tests/e2e',
	outputDir: 'test-results/playwright',
	forbidOnly: true,
	// Locally, more parallel browsers (each recording video) made context teardown time out under
	// load; two keep the full run stable. CI uses Playwright's default.
	workers: isCi ? undefined : 2,
	retries: 0,
	reporter: [
		['list'],
		['html', { outputFolder: 'playwright-report', open: 'never' }],
		['json', { outputFile: 'test-results/e2e.json' }]
	],
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		// Finalising every test's video on browser close timed out under load locally (the repo is in
		// a synced OneDrive folder); traces and screenshots remain for debugging. CI keeps video.
		video: isCi ? 'retain-on-failure' : 'off'
	},
	projects: [
		{
			name: 'mobile',
			use: {
				...devices['Pixel 7'],
				viewport: { width: 360, height: 740 }
			}
		},
		{ name: 'laptop', use: { ...devices['Desktop Chrome'] } }
	],
	webServer: {
		command: `npm run preview -- --port ${PORT} --strictPort`,
		port: PORT,
		reuseExistingServer: !isCi
	}
});
