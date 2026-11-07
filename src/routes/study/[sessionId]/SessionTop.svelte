<!--
	The study session's top bar (DESIGN §4, §6): close, course chip, phase label, Yuki reacting in
	the header (still between reactions), and the progress strip with Yuki trotting along it.
-->
<script lang="ts">
	import { X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { StudyView } from '#lib/services/study-types.ts';
	import PhaseLabel from '#lib/ui/components/PhaseLabel.svelte';
	import ProgressStrip from '#lib/ui/components/ProgressStrip.svelte';
	import Yuki from '#lib/ui/components/yuki/Yuki.svelte';
	import type { YukiState } from '#lib/ui/components/yuki/yuki.ts';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';

	let {
		view,
		yuki,
		companion
	}: { view: StudyView; yuki: { state: YukiState; key: number }; companion: boolean } = $props();
</script>

<TopBar>
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
		<Chip color={view.course.color}>{view.course.name}</Chip>
		<PhaseLabel phase={view.phase} />
	{/snippet}
	{#snippet trailing()}
		{#if companion}
			{#key yuki.key}<Yuki state={yuki.state} size={32} still />{/key}
		{/if}
	{/snippet}
	{#snippet below()}
		<ProgressStrip done={view.progress.done} total={view.progress.total} runner={companion} />
	{/snippet}
</TopBar>
