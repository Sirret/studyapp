import { defineConfig } from 'vitest/config';
import { COVERAGE_DATA_MIN, COVERAGE_ENGINE_MIN } from './src/lib/config/defaults.ts';

const engineThreshold = { lines: COVERAGE_ENGINE_MIN, branches: COVERAGE_ENGINE_MIN };
const dataThreshold = { lines: COVERAGE_DATA_MIN, branches: COVERAGE_DATA_MIN };

/** @see BUILD_PLAN §11.1 (coverage) and §11.3 (reports) */
export default defineConfig({
	test: {
		environment: 'node',
		includeTaskLocation: true,
		include: ['tests/unit/**/*.test.ts', 'tests/sim/**/*.test.ts'],
		reporters: ['default', 'junit', 'json'],
		outputFile: {
			junit: 'test-results/unit.junit.xml',
			json: 'test-results/unit.json'
		},
		coverage: {
			provider: 'v8',
			include: ['src/lib/**/*.ts', 'scripts/lib/**/*.ts'],
			reporter: ['text-summary', 'html', 'json-summary'],
			reportsDirectory: 'coverage',
			reportOnFailure: true,
			thresholds: {
				'src/lib/engine/**': engineThreshold,
				'src/lib/import/**': dataThreshold,
				'src/lib/transfer/**': dataThreshold,
				'src/lib/db/**': dataThreshold
			}
		}
	}
});
