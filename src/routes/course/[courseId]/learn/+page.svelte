<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CourseId, TopicId } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { LearnFlowView, LearnTopicView } from '#lib/services/learn-types.ts';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import Hero from '#lib/ui/components/Hero.svelte';
	import PawTrail from '#lib/ui/components/PawTrail.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import { nextTopic } from '#lib/ui/learn/learn-nav.ts';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import TopicList from '../TopicList.svelte';
	import LearnStep from './LearnStep.svelte';
	import type { PageProps } from './$types';

	/**
	 * Learn (`/course/[id]/learn`, Q2): pick an in-scope topic, then go through its flow screen by
	 * screen (`?topic=…&step=N`). Session screens run on `/study` with `unit=learn` (no session
	 * summary; count rounds still pause) and come back to the next screen.
	 * @see SESSION_NOTES C; Decisions log "Phase 8.6 Q2", "Q3", "Q16"
	 */
	let { data }: PageProps = $props();
	const courseId = $derived(data.courseId as CourseId);
	const topicId = $derived(data.topic as TopicId | null);
	const coursePage = $derived(resolve('/course/[courseId]', { courseId: data.courseId }));

	let topics = $state<LearnTopicView[] | null>(null);
	let flow = $state<LearnFlowView | null>(null);
	let missing = $state(false);
	let failed = $state(false);
	let busy = $state(false);

	async function wiring() {
		return import('#lib/services/study-wiring.ts');
	}

	$effect(() => {
		const topic = topicId;
		flow = null;
		missing = false;
		void (async () => {
			const { learnService } = await wiring();
			topics = await learnService.topics(courseId);
			if (topic === null) return;
			flow = await learnService.flow(courseId, topic);
			missing = flow === null;
		})().catch((error: unknown) => {
			logger.error('learn', 'not loaded', { error: String(error) });
			failed = true;
		});
	});

	function stepUrl(topic: TopicId, step: number): string {
		const learn = resolve('/course/[courseId]/learn', { courseId: data.courseId });
		return `${learn}?topic=${topic}&step=${step}`;
	}

	/** Opens screen `index`; a session screen (other than Meet the terms) starts straight away. */
	async function go(index: number): Promise<void> {
		const screen = flow?.screens[index];
		if (topicId === null) return;
		if (screen?.session && screen.step !== 'meetTerms') await start(index);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()d path plus a query
		else await goto(stepUrl(topicId, index));
	}

	/** Starts screen `index` as a session; with nothing to ask (no look-back yet), moves on. */
	async function start(index: number): Promise<void> {
		if (topicId === null || busy) return;
		busy = true;
		try {
			const { learnService } = await wiring();
			const view = await learnService.startStep(courseId, topicId, index);
			if (view === null) {
				busy = false;
				await go(index + 1);
				return;
			}
			const back = stepUrl(topicId, index + 1);
			const study = resolve('/study/[sessionId]', { sessionId: view.sessionId });
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()d path plus a query
			await goto(`${study}?unit=learn&back=${encodeURIComponent(back)}`);
		} finally {
			busy = false;
		}
	}

	const after = $derived(topics && topicId ? nextTopic(topics, topicId) : null);
</script>

<svelte:head><title>Learn{flow ? ` · ${flow.topic.name}` : ''}</title></svelte:head>

<Screen>
	{#snippet top()}
		<TopBar title={flow ? `Learn · ${flow.topic.name}` : 'Learn'}>
			{#snippet leading()}
				<Button variant="ghost" size="icon" href={coursePage} aria-label="Course page">
					<Icon icon={ArrowLeft} size="nav" />
				</Button>
			{/snippet}
		</TopBar>
	{/snippet}
	{#if failed}
		<StickyNote title="Learn didn't load">
			Reload the page to try again. Nothing was lost.
			{#snippet actions()}<Button onclick={() => location.reload()}>Reload</Button>{/snippet}
		</StickyNote>
	{:else if topics === null || (topicId !== null && flow === null && !missing)}
		<EmptyState message="Getting it ready…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else if missing}
		<StickyNote title="This topic isn't in what you're studying">
			Pick it on the course page to learn it, or choose another topic.
			{#snippet actions()}<Button href={coursePage}>Back to the course</Button>{/snippet}
		</StickyNote>
	{:else if flow === null || topicId === null}
		<Stack gap="md">
			<Hero
				eyebrow="Learn"
				title="Pick a topic"
				subline="Read a section, then answer a couple of questions."
			/>
			{#if topics.length === 0}
				<StickyNote title="Nothing to read yet">
					Import a lecture or pick more topics on the course page.
					{#snippet actions()}<Button href={coursePage}>Back to the course</Button>{/snippet}
				</StickyNote>
			{:else}
				<TopicList {courseId} {topics} />
			{/if}
		</Stack>
	{:else if data.step >= flow.screens.length}
		<StickyNote title="Topic done">
			<span data-topic-done>You've been through {flow.topic.name}.</span>
			Tomorrow's retest is where it counts. It'll be waiting in Exam prep.
			{#snippet actions()}
				{#if after}
					<Button href={stepUrl(after.id, 0)} data-next-topic>Next: {after.name}</Button>
				{/if}
				<Button variant={after ? 'ghost' : 'primary'} href={coursePage}>Back to the course</Button>
			{/snippet}
		</StickyNote>
	{:else}
		<Stack gap="md">
			<PawTrail
				total={flow.screens.length}
				current={data.step}
				label={`Step ${data.step + 1} of ${flow.screens.length}`}
			/>
			{#key `${topicId}-${data.step}`}
				<LearnStep
					screens={flow.screens}
					index={data.step}
					topicName={flow.topic.name}
					{busy}
					onnext={() => go(data.step + 1)}
					onstart={() => start(data.step)}
				/>
			{/key}
		</Stack>
	{/if}
</Screen>
