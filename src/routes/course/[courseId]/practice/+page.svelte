<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CardId, CourseId, SessionId } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { DeckCard, QuizSummary } from '#lib/services/practice-service.ts';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import Hero from '#lib/ui/components/Hero.svelte';
	import SoundToggle from '#lib/ui/components/SoundToggle.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import { countOf } from '#lib/util/plural.ts';
	import PracticeDeck from './PracticeDeck.svelte';
	import QuizResult from './QuizResult.svelte';
	import type { PageProps } from './$types';

	/**
	 * Practice (`/course/[id]/practice`): flashcards (`?view=deck`, never logged) or a quick quiz
	 * over the in-scope cards (mode `practice`, no timer, count rounds pause at about 20). The quiz
	 * runs on `/study` with `unit=learn` (no session summary) and comes back with `?quiz=<id>` for
	 * its own summary. Replay skips practice events, so the schedule never changes.
	 * @see SESSION_NOTES C; Decisions log "Phase 8.6 Q4", "Q16", "Q18"
	 */
	let { data }: PageProps = $props();
	const courseId = $derived(data.courseId as CourseId);
	const coursePage = $derived(resolve('/course/[courseId]', { courseId: data.courseId }));
	const menu = $derived(resolve('/course/[courseId]/practice', { courseId: data.courseId }));

	let deck = $state<DeckCard[] | null>(null);
	let summary = $state<QuizSummary | null>(null);
	let failed = $state(false);
	let busy = $state(false);

	async function wiring() {
		return import('#lib/services/study-wiring.ts');
	}

	$effect(() => {
		const quiz = data.quiz as SessionId | null;
		summary = null;
		void (async () => {
			const { practiceService } = await wiring();
			deck = await practiceService.deck(courseId);
			if (quiz !== null) summary = await practiceService.quizSummary(quiz);
		})().catch((error: unknown) => {
			logger.error('practice', 'not loaded', { error: String(error) });
			failed = true;
		});
	});

	const prompts = $derived(
		new Map<CardId, string>((deck ?? []).map((card) => [card.cardId, card.exercise.prompt]))
	);

	/** Starts the quick quiz and opens it; it comes back here with its summary. */
	async function quiz(): Promise<void> {
		if (busy) return;
		busy = true;
		try {
			const { practiceService } = await wiring();
			const view = await practiceService.startQuiz(courseId);
			const back = `${menu}?quiz=${view.sessionId}`;
			const study = resolve('/study/[sessionId]', { sessionId: view.sessionId });
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()d path plus a query
			await goto(`${study}?unit=learn&back=${encodeURIComponent(back)}`);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Practice</title></svelte:head>

<Screen>
	{#snippet top()}
		<TopBar title={data.deck ? 'Practice · Flashcards' : 'Practice'}>
			{#snippet leading()}
				<Button
					variant="ghost"
					size="icon"
					href={data.deck || data.quiz ? menu : coursePage}
					aria-label={data.deck || data.quiz ? 'Practice' : 'Course page'}
				>
					<Icon icon={ArrowLeft} size="nav" />
				</Button>
			{/snippet}
			{#snippet trailing()}<SoundToggle />{/snippet}
		</TopBar>
	{/snippet}
	{#if failed}
		<StickyNote title="Practice didn't load">
			Reload the page to try again. Nothing was lost.
			{#snippet actions()}<Button onclick={() => location.reload()}>Reload</Button>{/snippet}
		</StickyNote>
	{:else if deck === null || (data.quiz !== null && summary === null)}
		<EmptyState message="Getting it ready…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else if deck.length === 0}
		<StickyNote title="No cards to practise yet">
			Import a lecture or pick more topics on the course page.
			{#snippet actions()}<Button href={coursePage}>Back to the course</Button>{/snippet}
		</StickyNote>
	{:else if summary !== null}
		<QuizResult {summary} {prompts} {busy} course={coursePage} onagain={quiz} />
	{:else if data.deck}
		<PracticeDeck
			cards={deck}
			{menu}
			media={async (id) => (await wiring()).studyService.media(id)}
		/>
	{:else}
		<Stack gap="md">
			<Hero
				eyebrow="Practice · {countOf(deck.length, 'card')}"
				title="Just practise"
				subline="No timer, and nothing here changes your schedule."
			/>
			<StickyNote title="Flashcards">
				Flip each card, then say if you know it. The ones you're still learning go round again.
				{#snippet actions()}
					<Button href={`${menu}?view=deck`} data-practice-deck>Open the deck</Button>
				{/snippet}
			</StickyNote>
			<StickyNote title="Quick quiz">
				Every card once, in mixed formats. Misses come back before the end.
				{#snippet actions()}
					<Button onclick={quiz} disabled={busy} data-practice-quiz>Start the quiz</Button>
				{/snippet}
			</StickyNote>
		</Stack>
	{/if}
</Screen>
