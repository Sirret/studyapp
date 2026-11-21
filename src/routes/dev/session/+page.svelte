<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { CourseId } from '#lib/db/schemas/common.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let busy = $state(false);

	async function start(): Promise<void> {
		busy = true;
		const { startSampleSession } = await import('#lib/services/dev-wiring.ts');
		const sessionId = await startSampleSession();
		await goto(resolve('/study/[sessionId]', { sessionId }));
	}

	async function startFigures(courseId: string): Promise<void> {
		busy = true;
		const { startFigureSession } = await import('#lib/services/dev-wiring.ts');
		const sessionId = await startFigureSession(courseId as CourseId);
		await goto(resolve('/study/[sessionId]', { sessionId }));
	}
</script>

<svelte:head><title>Session harness</title></svelte:head>

<Screen>
	<p>Imports the sample course and starts a session that shows every non-diagram exercise kind.</p>
	<Button full loading={busy} onclick={start} data-start-sample>Start the sample session</Button>
	{#if data.figures}
		{@const courseId = data.figures}
		<Button full loading={busy} onclick={() => startFigures(courseId)} data-start-figures>
			Start a session over this course's pictures
		</Button>
	{/if}
</Screen>
