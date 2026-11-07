<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';

	let busy = $state(false);

	async function start(): Promise<void> {
		busy = true;
		const { startSampleSession } = await import('#lib/services/dev-wiring.ts');
		const sessionId = await startSampleSession();
		await goto(resolve('/study/[sessionId]', { sessionId }));
	}
</script>

<svelte:head><title>Session harness</title></svelte:head>

<Screen>
	<p>Imports the sample course and starts a session that shows every non-diagram exercise kind.</p>
	<Button full loading={busy} onclick={start} data-start-sample>Start the sample session</Button>
</Screen>
