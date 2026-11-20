<!--
	The study session's top bar (DESIGN §7 TopBar): close, the course as a Courier breadcrumb with
	the phase beside it, Yuki small in the header (still between reactions; never in the answer
	area, §9), the sound mute button, and the paw-trail progress strip.
-->
<script lang="ts">
	import { X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { StudyView } from '#lib/services/study-types.ts';
	import PhaseLabel from '#lib/ui/components/PhaseLabel.svelte';
	import ProgressStrip from '#lib/ui/components/ProgressStrip.svelte';
	import SoundToggle from '#lib/ui/components/SoundToggle.svelte';
	import Yuki from '#lib/ui/components/yuki/Yuki.svelte';
	import type { YukiState } from '#lib/ui/components/yuki/yuki.ts';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';

	let {
		view,
		yuki,
		companion
	}: { view: StudyView; yuki: { state: YukiState; key: number }; companion: boolean } = $props();
</script>

<TopBar title={view.course.name}>
	{#snippet leading()}
		<Button
			variant="ghost"
			size="icon"
			onclick={() => goto(resolve('/'))}
			aria-label="Close the session (it stays saved)"
		>
			<Icon icon={X} size="nav" />
		</Button>
	{/snippet}
	{#snippet middle()}
		<PhaseLabel phase={view.phase} />
	{/snippet}
	{#snippet trailing()}
		<span class="end">
			<SoundToggle />
			{#if companion}
				{#key yuki.key}<Yuki state={yuki.state} size={32} still />{/key}
			{/if}
		</span>
	{/snippet}
	{#snippet below()}
		<ProgressStrip done={view.progress.done} total={view.progress.total} runner={companion} />
	{/snippet}
</TopBar>

<style>
	.end {
		display: flex;
		align-items: center;
		gap: var(--gap-xs);
	}
</style>
