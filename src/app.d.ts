/// <reference types="vite-plugin-pwa/client" />

declare global {
	/** True in dev and e2e (`--mode test`) builds, false in the deploy build (vite.config.ts). */
	const __DEV_ROUTES__: boolean;
}

export {};
