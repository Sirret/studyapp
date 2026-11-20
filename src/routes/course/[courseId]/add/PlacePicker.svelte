<!--
	Where a new card goes (Manual mode): pick the topic and, optionally, its section; or add a new
	topic, or a new section with its reading (shown in Learn's reader). Plain selects and buttons,
	so it works by touch at 360 px.
-->
<script lang="ts">
	import type { ManualOutline } from '#lib/services/manual-content-service.ts';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Input from '#lib/ui/primitives/Input.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextArea from '#lib/ui/primitives/TextArea.svelte';

	let {
		topics,
		topicId = $bindable(),
		chunkId = $bindable(''),
		onaddtopic,
		onaddsection
	}: {
		topics: ManualOutline['topics'];
		topicId: string | undefined;
		/** The section's id, or '' for none. */
		chunkId: string;
		onaddtopic: (name: string) => Promise<void>;
		onaddsection: (title: string, text: string) => Promise<void>;
	} = $props();

	const topicOptions = $derived(topics.map((t) => ({ value: t.id as string, label: t.name })));
	const sections = $derived(topics.find((t) => t.id === topicId)?.sections ?? []);
	const sectionOptions = $derived([
		{ value: '', label: 'No section' },
		...sections.map((s) => ({ value: s.id as string, label: s.title }))
	]);

	let adding = $state<'topic' | 'section' | null>(null);
	let name = $state('');
	let text = $state('');
	let busy = $state(false);

	async function add(): Promise<void> {
		if (name.trim() === '' || busy) return;
		busy = true;
		try {
			if (adding === 'topic') await onaddtopic(name);
			else await onaddsection(name, text);
			adding = null;
			name = '';
			text = '';
		} finally {
			busy = false;
		}
	}
</script>

<Stack gap="md">
	<Select
		label="Topic"
		options={topicOptions}
		bind:value={topicId}
		onchange={() => (chunkId = '')}
	/>
	<Select label="Section" options={sectionOptions} bind:value={chunkId} />
	{#if adding}
		<Stack gap="sm">
			<Input
				label={adding === 'topic' ? 'New topic name' : 'New section title'}
				bind:value={name}
				autocomplete="off"
				data-new-place
			/>
			{#if adding === 'section'}
				<TextArea label="Reading (optional)" bind:value={text} rows={4} data-new-reading />
			{/if}
			<div class="actions">
				<Button onclick={add} loading={busy} disabled={busy || name.trim() === ''} data-add-place>
					Add {adding}
				</Button>
				<Button variant="ghost" onclick={() => (adding = null)}>Cancel</Button>
			</div>
		</Stack>
	{:else}
		<div class="actions">
			<Button variant="secondary" onclick={() => (adding = 'topic')} data-new-topic
				>New topic</Button
			>
			<Button
				variant="secondary"
				onclick={() => (adding = 'section')}
				disabled={topicId === undefined}
				data-new-section
			>
				New section
			</Button>
		</div>
	{/if}
</Stack>

<style>
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-sm);
	}
</style>
