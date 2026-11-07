<!--
	The app's outermost layout: resolves the theme (system, light, dark or auto-night) and the
	companion level onto <html> as data attributes the token layer and effects read, remembers the
	theme on this device so the next start doesn't flash, and hosts the paw-press effect.
	@see DESIGN §3.1 (theme setting), §11.2 (settings mapping), §13.2
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { logger } from '#lib/services/app.ts';
	import {
		loadPreferences,
		prefs,
		resolveTheme,
		sleep,
		THEME_HINT_KEY
	} from '#lib/services/preferences.svelte.ts';
	import { THEME_COLORS } from '#lib/design/tokens.ts';
	import PawPressLayer from '../delight/PawPressLayer.svelte';

	let { children }: { children: Snippet } = $props();

	const MS_PER_MINUTE = 60_000;
	const MINUTES_PER_HOUR = 60;

	let systemDark = $state(false);
	let minuteOfDay = $state(0);

	$effect(() => {
		const query = matchMedia('(prefers-color-scheme: dark)');
		systemDark = query.matches;
		const onChange = (event: MediaQueryListEvent) => (systemDark = event.matches);
		query.addEventListener('change', onChange);
		const tick = () => {
			const now = new Date();
			minuteOfDay = now.getHours() * MINUTES_PER_HOUR + now.getMinutes();
		};
		tick();
		const timer = setInterval(tick, MS_PER_MINUTE);
		loadPreferences().catch((error: unknown) =>
			logger.warn('prefs', 'settings not loaded', { error: String(error) })
		);
		return () => {
			query.removeEventListener('change', onChange);
			clearInterval(timer);
		};
	});

	const theme = $derived(
		resolveTheme(prefs.theme, { systemDark, minuteOfDay, sleepWindow: sleep.window })
	);

	$effect(() => {
		const root = document.documentElement;
		root.dataset.theme = theme;
		root.dataset.companion = prefs.companion;
		try {
			localStorage.setItem(THEME_HINT_KEY, theme);
		} catch {
			// Storage can be blocked; the hint is only a convenience.
		}
	});
</script>

<svelte:head>
	<meta name="theme-color" content={THEME_COLORS[theme].bg} />
</svelte:head>

{@render children()}

{#if prefs.companion !== 'off'}
	<PawPressLayer />
{/if}
