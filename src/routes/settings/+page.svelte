<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Settings } from '#lib/db/schemas/kv.ts';
	import { logger } from '#lib/services/app.ts';
	import { prefs, savePreference, type DisplayPrefs } from '#lib/services/preferences.svelte.ts';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import SectionHeading from '#lib/ui/components/SectionHeading.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import BottomNav from '#lib/ui/layout/BottomNav.svelte';
	import { bottomNavHrefs } from '#lib/ui/layout/nav-hrefs.ts';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Sidebar from '#lib/ui/layout/Sidebar.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Card from '#lib/ui/primitives/Card.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { ArrowLeft } from '@lucide/svelte';

	/**
	 * Settings (DESIGN §12 "Settings", SESSION_NOTES A11): theme (the dark one is "Lamp-light"),
	 * companion, haptics, sound effects and spelling. Each change saves straight away. The music
	 * toggle stays hidden until Phase 10 (Decisions log, "Phase 8.6 Q11").
	 */
	const navHrefs = bottomNavHrefs();

	const THEMES = [
		{ value: 'system', label: 'Follow the system' },
		{ value: 'light', label: 'Light (cabin)' },
		{ value: 'dark', label: 'Lamp-light (dark)' },
		{ value: 'auto-night', label: 'Lamp-light near bedtime' }
	] as const satisfies readonly { value: DisplayPrefs['theme']; label: string }[];

	const COMPANIONS = [
		{ value: 'full', label: 'Full' },
		{ value: 'quiet', label: 'Quiet' },
		{ value: 'off', label: 'Off' }
	] as const satisfies readonly { value: DisplayPrefs['companion']; label: string }[];

	const SPELLING = [
		{ value: 'fuzzy', label: 'Type them' },
		{ value: 'firstLetter', label: 'Word bank' }
	] as const satisfies readonly { value: Settings['spellingMode']; label: string }[];

	let spelling = $state<Settings['spellingMode'] | null>(null);
	let theme = $state<DisplayPrefs['theme']>(prefs.theme);
	let haptics = $state(prefs.haptics);
	let sounds = $state(prefs.sounds);
	let failed = $state(false);

	async function service() {
		return (await import('#lib/services/preferences-wiring.ts')).settingsService;
	}

	$effect(() => {
		void (async () => {
			try {
				const stored = await (await service()).get();
				theme = stored.theme;
				haptics = stored.haptics;
				sounds = stored.sounds;
				spelling = stored.spellingMode;
			} catch (error: unknown) {
				logger.error('settings', 'settings not loaded', { error: String(error) });
				failed = true;
			}
		})();
	});

	/** Saves a change; a failure shows the note (the screen keeps what was chosen). */
	function save(change: Promise<unknown>): void {
		change.catch((error: unknown) => {
			logger.error('settings', 'setting not saved', { error: String(error) });
			failed = true;
		});
	}

	function setSpelling(value: Settings['spellingMode']): void {
		spelling = value;
		save(service().then((settings) => settings.update({ spellingMode: value })));
	}
</script>

<Screen nav>
	{#snippet side()}<Sidebar active="den" hrefs={navHrefs} />{/snippet}
	{#snippet top()}
		<TopBar title="Settings">
			{#snippet leading()}
				<Button variant="ghost" size="icon" href={resolve('/')} aria-label="Back to the den">
					<Icon icon={ArrowLeft} />
				</Button>
			{/snippet}
		</TopBar>
	{/snippet}
	{#if failed}
		<StickyNote title="A setting didn't save">
			Reload the page and try again. Your courses are safe.
			{#snippet actions()}<Button onclick={() => location.reload()}>Reload</Button>{/snippet}
		</StickyNote>
	{/if}
	{#if spelling === null && !failed}
		<EmptyState message="Loading your settings…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else}
		<SectionHeading title="Look" />
		<Card>
			<Stack gap="lg">
				<Select
					label="Theme"
					options={THEMES}
					bind:value={theme}
					onchange={() => save(savePreference({ theme }))}
				/>
				<Stack gap="xs">
					<span class="label">{prefs.companionName}, the companion</span>
					<Segmented
						label="Companion"
						options={COMPANIONS}
						value={prefs.companion}
						onchange={(companion) => save(savePreference({ companion }))}
					/>
					<span class="hint"
						>Quiet keeps {prefs.companionName} small and still. Off hides the wolf.</span
					>
				</Stack>
			</Stack>
		</Card>
		<SectionHeading title="Feel" />
		<Card>
			<Stack gap="md">
				<Toggle
					label="Vibration on answers"
					bind:checked={haptics}
					onchange={() => save(savePreference({ haptics }))}
				/>
				<Toggle
					label="Sounds"
					bind:checked={sounds}
					onchange={() => save(savePreference({ sounds }))}
				/>
				<span class="hint">Short sounds on answers. Never while you read.</span>
			</Stack>
		</Card>
		<SectionHeading title="Answers" />
		<Card>
			<Stack gap="xs">
				<span class="label">Fill-in-the-blank answers</span>
				<Segmented
					label="Fill-in-the-blank answers"
					options={SPELLING}
					value={spelling ?? 'fuzzy'}
					onchange={setSpelling}
				/>
				<span class="hint">
					{spelling === 'firstLetter'
						? 'Pick the word from a short bank, with its first letter shown. Easier on spelling.'
						: 'Type the missing word. Small typos still count as right.'}
				</span>
			</Stack>
		</Card>
	{/if}
	<BottomNav active="den" hrefs={navHrefs} />
</Screen>

<style>
	.label {
		color: var(--text-soft);
		font-size: var(--type-small-size);
		font-weight: var(--type-small-weight);
	}

	.hint {
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}
</style>
