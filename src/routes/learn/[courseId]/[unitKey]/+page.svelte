<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { PRETEST_AUTOHIDE_SKIPS } from '#lib/config/defaults.ts';
	import type { CourseId, SessionId } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import type { LearnStepView, LearnUnitView } from '#lib/services/course-types.ts';
	import Banner from '#lib/ui/components/Banner.svelte';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import ProgressStrip from '#lib/ui/components/ProgressStrip.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Card from '#lib/ui/primitives/Card.svelte';
	import type { PageProps } from './$types';

	/** One acquisition (or one-night) unit, step by step. @see BUILD_PLAN §6.7, CONCEPT §8 */
	let { data }: PageProps = $props();
	const courseId = $derived(data.courseId as CourseId);

	let unit = $state<LearnUnitView | null>(null);
	let missing = $state(false);
	let starting = $state(false);
	const skipKey = $derived(`snowpack:pretest-skips:${data.courseId}`);

	async function service() {
		return (await import('#lib/services/study-wiring.ts')).coursePlanService;
	}

	function skips(): number {
		try {
			return Number(sessionStorage.getItem(skipKey) ?? 0) || 0;
		} catch {
			return 0;
		}
	}

	$effect(() => {
		const { unitKey, quizSession } = data;
		void (async () => {
			const plans = await service();
			const loaded = await plans.learnUnit(courseId, unitKey);
			if (!loaded) {
				missing = true;
				return;
			}
			const quizStep = loaded.steps.find((step) => step.step === 'read');
			if (quizSession && quizStep?.step === 'read') {
				await plans.finishQuiz(courseId, quizSession as SessionId, quizStep.chunkId);
			}
			unit = loaded;
		})().catch((error: unknown) => {
			logger.error('learn', 'unit not loaded', { error: String(error) });
			missing = true;
		});
	});

	const current = $derived<LearnStepView | undefined>(unit?.steps[data.step]);
	const pretestHidden = $derived(current?.step === 'pretest' && skips() >= PRETEST_AUTOHIDE_SKIPS);

	function stepUrl(step: number): string {
		return `${resolve('/learn/[courseId]/[unitKey]', { courseId: data.courseId, unitKey: data.unitKey })}?step=${step}`;
	}

	async function next(): Promise<void> {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is built with resolve(); only a query is added
		await goto(stepUrl(data.step + 1));
	}

	async function skipPretest(): Promise<void> {
		try {
			sessionStorage.setItem(skipKey, String(skips() + 1));
		} catch {
			// Private mode: the skip still works, it just isn't remembered.
		}
		await next();
	}

	async function startStep(): Promise<void> {
		starting = true;
		try {
			const view = await (await service()).startLearnStep(courseId, data.unitKey, data.step);
			const quiz = current?.step === 'quiz' ? `&quiz=${view.sessionId}` : '';
			const back = `${stepUrl(data.step + 1)}${quiz}`;
			const study = resolve('/study/[sessionId]', { sessionId: view.sessionId });
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()d path plus a query
			await goto(`${study}?back=${encodeURIComponent(back)}`);
		} finally {
			starting = false;
		}
	}

	const titles: Record<LearnStepView['step'], string> = {
		pretrain: 'Key terms first',
		pretest: 'Warm-up, not graded',
		read: 'Read',
		quiz: 'Quick quiz'
	};
</script>

<svelte:head><title>Learn</title></svelte:head>

<Screen>
	{#snippet top()}
		<TopBar title={unit?.unit.title ?? 'Learn'}>
			{#snippet below()}{#if unit}<ProgressStrip
						done={Math.min(data.step, unit.steps.length)}
						total={unit.steps.length}
					/>{/if}{/snippet}
		</TopBar>
	{/snippet}
	{#if missing && data.step > 0}
		<StickyNote title="Part done">
			Re-quiz everything from tonight once every part is done, then sleep.
			{#snippet actions()}<Button
					href={resolve('/course/[courseId]', { courseId: data.courseId })}
					data-learn-done>Back to the course</Button
				>{/snippet}
		</StickyNote>
	{:else if missing}
		<StickyNote title="This part is already learnt">
			Its retest comes tomorrow. Pick another part from the course page.
			{#snippet actions()}<Button href={resolve('/course/[courseId]', { courseId: data.courseId })}
					>Back to the course</Button
				>{/snippet}
		</StickyNote>
	{:else if !unit}
		<EmptyState message="Getting this part ready…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else if !current}
		<StickyNote title="Part done">
			{unit.mode === 'onenight'
				? 'When every part is done, take the break, then re-quiz everything from tonight.'
				: "Tomorrow's retest is where it counts. It'll be the first thing in your review."}
			{#snippet actions()}<Button
					href={resolve('/course/[courseId]', { courseId: data.courseId })}
					data-learn-done>Back to the course</Button
				>{/snippet}
		</StickyNote>
	{:else}
		<p>Step {data.step + 1} of {unit.steps.length} · ~{unit.unit.minutes} min in all</p>
		<Card label={titles[current.step]}>
			<Stack gap="md">
				<h2>{titles[current.step]}</h2>
				{#if current.step === 'read'}
					{#if current.generated}
						<Banner tone="warning">Written by a chatbot. Check it against your syllabus.</Banner>
					{/if}
					<p data-chunk-text>{current.text}</p>
					<Button full onclick={next} data-read-done>I've read it</Button>
				{:else if pretestHidden}
					<p>Warm-ups are hidden for now, since you skipped them.</p>
					<Button full onclick={next}>Continue</Button>
				{:else}
					<p>
						{#if current.step === 'pretrain'}Meet the {current.cards} key terms before the reading.
						{:else if current.step === 'pretest'}Guess {current.cards} answers before you read. It doesn't
							count; it just primes you.
						{:else}{current.cards} questions on what you just read. Practice only — tomorrow's retest
							is what counts.{/if}
					</p>
					<Row gap="sm">
						<Button full loading={starting} onclick={startStep} data-start-step>Start</Button>
						{#if current.step === 'pretest'}
							<Button variant="ghost" onclick={skipPretest} data-skip-pretest>Skip</Button>
						{/if}
					</Row>
				{/if}
			</Stack>
		</Card>
	{/if}
</Screen>
