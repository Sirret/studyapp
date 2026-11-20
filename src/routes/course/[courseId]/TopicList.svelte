<!--
	The course page's topic checklist (DESIGN §12 Course mockup): "Topics" with "N of M read", and
	per in-scope topic a ChecklistRow with its PawRing (all read, some read, none) and its sections'
	small rings; the first unread section in Learn order is "current". Tapping a topic opens it in
	Learn.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CourseId, TopicId } from '#lib/db/schemas/common.ts';
	import type { LearnTopicView } from '#lib/services/learn-types.ts';
	import ChecklistRow from '#lib/ui/components/ChecklistRow.svelte';
	import type { RingState } from '#lib/ui/components/PawRing.svelte';
	import SectionHeading from '#lib/ui/components/SectionHeading.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';

	let { courseId, topics }: { courseId: CourseId; topics: LearnTopicView[] } = $props();

	const total = $derived(topics.reduce((sum, topic) => sum + topic.sections, 0));
	const read = $derived(topics.reduce((sum, topic) => sum + topic.read, 0));
	const next = $derived(
		topics.flatMap((topic) => topic.outline).find((section) => !section.read)?.id
	);

	function topicState(topic: LearnTopicView): RingState {
		if (topic.sections > 0 && topic.read === topic.sections) return 'done';
		return topic.read > 0 ? 'current' : 'todo';
	}

	function sectionsOf(topic: LearnTopicView): { title: string; state: RingState }[] {
		return topic.outline.map((section, i) => ({
			title: section.title ?? `Section ${i + 1}`,
			state: section.read ? 'done' : section.id === next ? 'current' : 'todo'
		}));
	}

	async function open(id: TopicId): Promise<void> {
		const learn = resolve('/course/[courseId]/learn', { courseId });
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()d path plus a query
		await goto(`${learn}?topic=${id}`);
	}
</script>

{#if topics.length > 0}
	<SectionHeading title="Topics" id="topics">
		{#snippet action()}<span class="meta" data-topics-read>{read} of {total} read</span>{/snippet}
	</SectionHeading>
	<Stack gap="sm">
		{#each topics as topic (topic.id)}
			<div data-topic-row={topic.id}>
				<ChecklistRow
					title={topic.name}
					state={topicState(topic)}
					meta="{topic.read}/{topic.sections}"
					sections={sectionsOf(topic)}
					onclick={() => open(topic.id)}
				/>
			</div>
		{/each}
	</Stack>
{/if}

<style>
	.meta {
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		letter-spacing: var(--type-label-tracking);
	}
</style>
