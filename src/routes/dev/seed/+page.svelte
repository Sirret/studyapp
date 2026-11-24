<script lang="ts">
	import { resolve } from '$app/paths';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';

	let busy = $state(false);
	let status = $state('');

	/** Loaded only here and only in dev/test builds, so the seed never reaches the deploy build. */
	async function seedModule() {
		if (!__DEV_ROUTES__) throw new Error('dev only');
		return import('#lib/services/dev-seed.ts');
	}

	async function run(which: 'rich' | 'shelf'): Promise<void> {
		busy = true;
		status = 'Starting…';
		try {
			const seed = await seedModule();
			const progress = (done: number, total: number) => {
				status = `Seeding course ${done} of ${total}…`;
			};
			const report = await (which === 'rich' ? seed.seedRich(progress) : seed.seedShelf(progress));
			status = `Done: ${report.courses} courses, ${report.events} study events.`;
		} catch (error) {
			status = `Failed: ${String(error)}`;
		} finally {
			busy = false;
		}
	}

	async function wipe(): Promise<void> {
		busy = true;
		status = 'Wiping…';
		const seed = await seedModule();
		await seed.wipeLocalData();
		location.assign(`${resolve('/dev/seed')}?wiped=1`);
	}

	const wiped =
		typeof location !== 'undefined' && new URLSearchParams(location.search).has('wiped');
</script>

<svelte:head><title>Test data</title></svelte:head>

<Screen>
	<Stack gap="md">
		<p>
			Test builds only. Fills this browser's local database with review data through the real
			import. Nothing here touches the live site: data lives only in this browser, on this address.
		</p>
		<Button full loading={busy} onclick={() => run('rich')} data-seed-rich>
			Rich: 6 courses with pictures, diagrams, exams and 4 days of history
		</Button>
		<Button full variant="secondary" loading={busy} onclick={() => run('shelf')} data-seed-shelf>
			Shelf stress: 50 small courses, long titles, mixed exam dates
		</Button>
		<Button full variant="ghost" loading={busy} onclick={wipe} data-wipe>
			Wipe local database
		</Button>
		<p role="status" data-seed-status>{status || (wiped ? 'Local database wiped.' : '')}</p>
		<Button full variant="secondary" href={resolve('/courses')}>Open the shelf</Button>
	</Stack>
</Screen>
