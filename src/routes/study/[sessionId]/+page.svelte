<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { STREAK_FOR_FLURRY } from '#lib/config/defaults.ts';
	import type { SessionId } from '#lib/db/schemas/common.ts';
	import Exercise from '#lib/exercises/Exercise.svelte';
	import { logger } from '#lib/services/app.ts';
	import { prefs } from '#lib/services/preferences.svelte.ts';
	import type {
		ExerciseResponse,
		StudyAnswer,
		StudyView,
		SessionPhase
	} from '#lib/services/study-types.ts';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import ExerciseCard from '#lib/ui/components/ExerciseCard.svelte';
	import FeedbackPanel from '#lib/ui/components/FeedbackPanel.svelte';
	import PhaseInterstitial from '#lib/ui/components/PhaseInterstitial.svelte';
	import RoundSummary from '#lib/ui/components/RoundSummary.svelte';
	import SessionSummary from '#lib/ui/components/SessionSummary.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import type { YukiState } from '#lib/ui/components/yuki/yuki.ts';
	import CountUp from '#lib/ui/delight/CountUp.svelte';
	import { effectOn, hapticTick } from '#lib/ui/delight/delight.ts';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import PawWalk from '#lib/ui/delight/PawWalk.svelte';
	import SnowBurst from '#lib/ui/delight/SnowBurst.svelte';
	import SnowFlurry from '#lib/ui/delight/SnowFlurry.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import SessionTop from './SessionTop.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Service = (typeof import('#lib/services/study-wiring.ts'))['studyService'];
	let service: Service | undefined;
	let view = $state<StudyView | null>(null);
	let failed = $state(false);
	let answer = $state<StudyAnswer | null>(null);
	let response: ExerciseResponse | null = $state(null);
	let busy = $state(false);
	let accepted: string | null = $state(null);
	let interstitial: SessionPhase | null = $state(null);
	let yuki: { state: YukiState; key: number } = $state({ state: 'idle', key: 0 });
	let burst = $state(0);
	let flurry = $state(0);
	let streak = 0;
	let presented = $state(0);

	const companion = $derived(prefs.companion !== 'off');
	const shown = $derived(view?.item ?? null);

	async function load(): Promise<void> {
		try {
			const wiring = await import('#lib/services/study-wiring.ts');
			service = wiring.studyService;
			const opened = await service.open(data.sessionId as SessionId);
			if (opened) show(opened);
			else failed = true;
		} catch (error) {
			logger.error('study', 'open failed', { error: String(error) });
			failed = true;
		}
	}

	$effect(() => {
		void load();
	});

	/** Puts a view on screen; between phases on full, a short interstitial first (DESIGN §7.3). */
	function show(next: StudyView): void {
		const changed = view !== null && next.phase !== view.phase && next.item !== null;
		if (changed && prefs.companion === 'full' && !next.round) interstitial = next.phase;
		view = next;
		answer = null;
		response = null;
		accepted = null;
		presented += 1;
		if (__DEV_ROUTES__) {
			(window as unknown as Record<string, unknown>).__snowpackExercise =
				next.item?.exercise ?? null;
		}
	}

	function react(correct: boolean): void {
		const level = prefs.companion;
		if (correct) {
			streak += 1;
			const onStreak = streak % STREAK_FOR_FLURRY === 0;
			yuki = { state: onStreak ? 'sparkle' : 'hop', key: yuki.key + 1 };
			if (effectOn('snowBurst', level)) burst += 1;
			if (onStreak && effectOn('snowFlurry', level)) flurry += 1;
			hapticTick(prefs.haptics && effectOn('haptic', level));
		} else {
			streak = 0;
			yuki = { state: 'oops', key: yuki.key + 1 };
		}
	}

	async function submit(): Promise<void> {
		const item = view?.item;
		if (!service || !view || !item || !response || busy) return;
		busy = true;
		try {
			const result = await service.submit(view.sessionId, response);
			const graded = item.exercise.shape !== 'selfRate' && item.exercise.shape !== 'study';
			if (!graded) show(result.view);
			else {
				if (item.firstAttempt) react(result.verdict.correct);
				answer = result;
			}
		} finally {
			busy = false;
		}
	}

	async function iWasRight(): Promise<void> {
		// The typed exercise just answered: `response` still holds what was typed.
		if (!service || !view || !answer || response?.shape !== 'type') return;
		const typed = response.typed;
		const result = await service.acceptTyped(view.sessionId, {
			typed,
			...(answer.reviewEventId ? { reviewEventId: answer.reviewEventId } : {})
		});
		accepted = result.passesGuard
			? `Added "${typed}" as accepted. It counts as right.`
			: `Added "${typed}", but it's another card's answer, so this one stays wrong.`;
	}

	async function act(change: () => Promise<StudyView>): Promise<void> {
		if (busy) return;
		busy = true;
		try {
			show(await change());
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Study</title></svelte:head>

{#if failed}
	<Screen>
		<StickyNote title="This session can't be opened">
			It may have been finished on another tab, or the link is wrong. Your progress is saved.
			{#snippet actions()}<Button onclick={() => goto(resolve('/'))}>Back to Today</Button
				>{/snippet}
		</StickyNote>
	</Screen>
{:else if !view}
	<Screen>
		<EmptyState message="Opening your session…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	</Screen>
{:else}
	<Screen>
		{#snippet top()}
			{#if view && !view.ended}<SessionTop {view} {yuki} {companion} />{/if}
		{/snippet}
		{#if view.ended && view.summary}
			<SessionSummary
				practised={view.summary.practised}
				ready={view.summary.ready}
				next="Come back tomorrow for the retest — that's when it sticks."
				{companion}
			>
				{#snippet figure(value)}<CountUp
						{value}
						play={effectOn('countUp', prefs.companion)}
					/>{/snippet}
				{#snippet actions()}<Button full onclick={() => goto(resolve('/'))}>Back to Today</Button
					>{/snippet}
				{#snippet footer()}{#if effectOn('pawWalk', prefs.companion)}<PawWalk />{/if}{/snippet}
			</SessionSummary>
		{:else if view.round}
			<RoundSummary
				summary={view.round}
				{companion}
				oncontinue={(options) =>
					act(() => (service as Service).continueRound(view!.sessionId, options))}
				onstop={() => act(() => (service as Service).stop(view!.sessionId))}
			/>
		{:else if interstitial}
			<PhaseInterstitial phase={interstitial} ondone={() => (interstitial = null)} />
		{:else if shown}
			{#key presented}
				<ExerciseCard
					instruction={shown.exercise.instruction}
					prompt={shown.exercise.prompt}
					context={shown.exercise.shape === 'type' ? shown.exercise.context : []}
					dots={shown.exercise.shape === 'selfRate' || shown.exercise.shape === 'study'
						? undefined
						: shown.dots}
				>
					{#snippet body()}
						<Exercise
							spec={shown.exercise}
							verdict={answer?.verdict ?? null}
							bind:response
							onsubmit={submit}
						/>
						<SnowBurst key={burst} />
						<SnowFlurry key={flurry} />
					{/snippet}
					{#snippet feedback()}
						{#if answer}
							<FeedbackPanel
								correct={answer.verdict.correct}
								reveal={answer.verdict.reveal}
								contrast={answer.verdict.contrast}
								note={accepted ?? undefined}
							>
								{#snippet actions()}
									<Button full size="session" onclick={() => answer && show(answer.view)} data-next>
										{answer?.verdict.correct ? 'Continue' : 'Try again'}
									</Button>
									{#if !answer?.verdict.correct && shown.exercise.shape === 'type' && !accepted}
										<Button full variant="ghost" onclick={iWasRight}>I was right</Button>
									{/if}
								{/snippet}
							</FeedbackPanel>
						{/if}
					{/snippet}
				</ExerciseCard>
			{/key}
		{/if}
		{#snippet bottom()}
			{#if view && shown && !answer && !view.round && !interstitial && !view.ended}
				<Button full size="session" disabled={!response} loading={busy} onclick={submit} data-check>
					{shown.exercise.shape === 'selfRate' || shown.exercise.shape === 'study'
						? 'Done'
						: 'Check'}
				</Button>
			{/if}
		{/snippet}
	</Screen>
{/if}
