<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ChunkId, CourseId, TopicId } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { ManualOutline } from '#lib/services/manual-content-service.ts';
	import type { ImageSource } from '#lib/services/import-service.ts';
	import type { NoteContent } from '#lib/services/manual-fields.ts';
	import Banner from '#lib/ui/components/Banner.svelte';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import Hero from '#lib/ui/components/Hero.svelte';
	import SectionHeading from '#lib/ui/components/SectionHeading.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Card from '#lib/ui/primitives/Card.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import { countOf } from '#lib/util/plural.ts';
	import NoteForm from './NoteForm.svelte';
	import PlacePicker from './PlacePicker.svelte';
	import type { PageProps } from './$types';

	/**
	 * Manual mode (`/course/[id]/add`): add topics, sections and cards by hand. Each card is saved
	 * at once (note and cards in one write), and the topic's cards are listed below the form.
	 * @see Decisions log "Phase 8.6 Q15"
	 */
	let { data }: PageProps = $props();
	const courseId = $derived(data.courseId as CourseId);
	const coursePage = $derived(resolve('/course/[courseId]', { courseId: data.courseId }));

	let outline = $state<ManualOutline | null>(null);
	let failed = $state(false);
	// svelte-ignore state_referenced_locally
	let topicId = $state<string | undefined>(data.topic ?? undefined);
	let chunkId = $state('');
	let saved = $state('');
	const topic = $derived(outline?.topics.find((t) => t.id === topicId) ?? null);

	async function service() {
		return (await import('#lib/services/study-wiring.ts')).manualContentService;
	}

	async function refresh(): Promise<void> {
		try {
			outline = await (await service()).outline(courseId);
			if (outline === null) failed = true;
			else if (!outline.topics.some((t) => t.id === topicId)) topicId = outline.topics[0]?.id;
		} catch (error) {
			logger.error('manual', 'outline not loaded', { error: String(error) });
			failed = true;
		}
	}

	$effect(() => {
		void refresh();
	});

	async function addTopic(name: string): Promise<void> {
		topicId = await (await service()).addTopic(courseId, name);
		chunkId = '';
		await refresh();
	}

	async function addSection(title: string, text: string): Promise<void> {
		if (topicId === undefined) return;
		chunkId = await (await service()).addSection(topicId as TopicId, title, text);
		await refresh();
	}

	async function addNote(content: NoteContent): Promise<string | null> {
		if (topicId === undefined) return 'Add a topic first.';
		const section = chunkId === '' ? null : (chunkId as ChunkId);
		const result = await (await service()).addNote(topicId as TopicId, section, content);
		if (!result.ok) return result.error;
		saved = `Saved: ${countOf(result.value.cards, 'card')}.`;
		await refresh();
		return null;
	}

	const figures = () => import('#lib/services/figure-wiring.ts');
	const place = (): [TopicId, ChunkId | null] | null =>
		topicId === undefined
			? null
			: [topicId as TopicId, chunkId === '' ? null : (chunkId as ChunkId)];

	/** A picture note opens its editor at once: boxes are drawn there. */
	async function addImage(source: ImageSource): Promise<string | null> {
		const at = place();
		if (!at) return 'Add a topic first.';
		const made = await (await figures()).occlusionService.create(...at, source);
		if (!made.ok) return made.error;
		await goto(resolve('/course/[courseId]/image/[noteId]', { courseId, noteId: made.value }));
		return null;
	}

	async function addDiagram(input: {
		kind: 'stack' | 'flow';
		name: string;
		text: string;
	}): Promise<string | null> {
		const at = place();
		if (!at) return 'Add a topic first.';
		const made = await (await figures()).diagramService.create(...at, input);
		if (!made.ok) return made.error.message;
		await goto(resolve('/course/[courseId]/diagram/[noteId]', { courseId, noteId: made.value }));
		return null;
	}
</script>

<svelte:head><title>Add cards</title></svelte:head>

<Screen>
	{#snippet top()}
		<TopBar title="Add cards">
			{#snippet leading()}
				<Button variant="ghost" size="icon" href={coursePage} aria-label="Course page">
					<Icon icon={ArrowLeft} size="nav" />
				</Button>
			{/snippet}
		</TopBar>
	{/snippet}
	{#if failed}
		<StickyNote title="This course can't be opened">
			It may have been deleted. Your other courses are safe.
			{#snippet actions()}<Button href={resolve('/courses')}>All courses</Button>{/snippet}
		</StickyNote>
	{:else if outline === null}
		<EmptyState message="Opening the course…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else}
		<Stack gap="md">
			<Hero eyebrow="Manual mode" title={outline.course.name} />
			<Card>
				<PlacePicker
					topics={outline.topics}
					bind:topicId
					bind:chunkId
					onaddtopic={addTopic}
					onaddsection={addSection}
				/>
			</Card>
			<Card>
				<NoteForm onsave={addNote} onimage={addImage} ondiagram={addDiagram} />
			</Card>
			{#if saved}<Banner tone="success">{saved}</Banner>{/if}
			{#if topic}
				<SectionHeading title="In {topic.name}" />
				{#if topic.notes.length === 0}
					<p class="soft">No cards yet. The first one you add shows here.</p>
				{:else}
					<ul class="notes" data-manual-notes>
						{#each topic.notes as note (note.id)}
							<li>{note.title} <span class="soft">· {countOf(note.cards, 'card')}</span></li>
						{/each}
					</ul>
				{/if}
			{/if}
			<Button full href={coursePage} data-manual-done>Done, back to the course</Button>
		</Stack>
	{/if}
</Screen>

<style>
	.notes {
		display: grid;
		gap: var(--gap-xs);
		margin: 0;
		padding-left: var(--gap-md);
	}

	.soft {
		margin: 0;
		color: var(--text-soft);
	}
</style>
