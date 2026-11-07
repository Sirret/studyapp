import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCi = Boolean(process.env.CI);

/** @see BUILD_PLAN §11.1 (e2e at 360 × 740) and §11.3 (reports) */
export default defineConfig({
	testDir: 'tests/e2e',
	outputDir: 'test-results/playwright',
	forbidOnly: true,
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
		video: 'retain-on-failure'
	},
	projects: [
		{
			name: 'mobile',
			use: {
				...devices['Pixel 7'],
				viewport: { width: 360, height: 740 }
			}
		}
	],
	webServer: {
		command: `npm run preview -- --port ${PORT} --strictPort`,
		port: PORT,
		reuseExistingServer: !isCi
	}
});
