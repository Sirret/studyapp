import type { ClientInit, HandleClientError } from '@sveltejs/kit/hooks';
import { logger, startApp } from '#lib/services/app.ts';

export const init: ClientInit = () => {
	startApp();
};

/** Unexpected errors SvelteKit catches while rendering go to the log too (BUILD_PLAN §11.5). */
export const handleError: HandleClientError = (input) => {
	if (input.kind !== 'unknown') return;
	const { error } = input;
	logger.error('app', error instanceof Error ? error.message : String(error), {
		stack: error instanceof Error ? error.stack : undefined
	});
};
