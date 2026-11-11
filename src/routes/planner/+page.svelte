<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Availability } from '#lib/db/schemas/kv.ts';
	import { logger } from '#lib/services/app.ts';
	import type { PlanExamView, PlanView } from '#lib/services/planner-types.ts';
	import { prefs } from '#lib/services/preferences.svelte.ts';
	import DayBar from '#lib/ui/components/DayBar.svelte';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import Yuki from '#lib/ui/components/yuki/Yuki.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import Grid from '#lib/ui/layout/Grid.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Card from '#lib/ui/primitives/Card.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import AvailabilityForm from './AvailabilityForm.svelte';

	/** Plan (DESIGN §6, BUILD_PLAN §9): day bars, feasibility per exam, the availability calendar. */
	let plan = $state<PlanView | null>(null);
	let availability = $state<Availability | null>(null);
	let failed = $state(false);
	let saved = $state(0);

	async function service() {
		return (await import('#lib/services/study-wiring.ts')).plannerService;
	}

	async function refresh(): Promise<void> {
		try {
			const planner = await service();
			[plan, availability] = await Promise.all([planner.week(), planner.availability()]);
		} catch (error: unknown) {
			logger.error('planner', 'not loaded', { error: String(error) });
			failed = true;
		}
	}

	$effect(() => {
		void refresh();
	});

	async function save(next: Availability): Promise<void> {
		await (await service()).setAvailability(next);
		saved += 1;
		await refresh();
	}

	const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	function dayLabel(date: string, today: boolean): string {
		if (today) return 'Today';
		const parsed = new Date(`${date}T12:00:00Z`);
		return `${DAY_NAMES[parsed.getUTCDay()]} ${parsed.getUTCDate()}`;
	}

	const STEPS: Record<PlanExamView['degradations'][number], string> = {
		criterion: 'new cards need 2 right instead of 3',
		relearning: 'fewer review rounds before the exam',
		cut: 'leave out the lowest-value work'
	};

	function hours(minutes: number): string {
		return minutes >= 60 ? `${Math.round((minutes / 60) * 10) / 10} h` : `${minutes} min`;
	}
</script>

<svelte:head><title>Plan</title></svelte:head>

<Screen>
	{#snippet top()}<TopBar title="Plan" />{/snippet}
	{#if failed}
		<StickyNote title="The plan didn't load">
			Reload the page to try again. Nothing was lost.
			{#snippet actions()}<Button onclick={() => location.reload()}>Reload</Button>{/snippet}
		</StickyNote>
	{:else if plan === null || availability === null}
		<EmptyState message="Working out the plan…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else}
		<Grid columns={2}>
			<Stack gap="lg">
				<Card label="The next days">
					<Stack gap="sm">
						{#each plan.days as day (day.date)}
							<DayBar
								label={dayLabel(day.date, day.today)}
								today={day.today}
								capMinutes={day.capMinutes}
								segments={day.segments}
								exams={day.exams}
							/>
						{/each}
					</Stack>
				</Card>
				{#if plan.exams.length === 0}
					<EmptyState
						message="No exam dates yet. Set one on a course page and the plan shares your time."
						companion={prefs.companion !== 'off'}
					>
						{#snippet action()}<Button variant="secondary" href={resolve('/')}>Back to Today</Button
							>{/snippet}
					</EmptyState>
				{/if}
				{#each plan.exams as exam (exam.courseId)}
					{#if exam.fits}
						<Card stripe={exam.color} tag="article" label="{exam.name} exam">
							<Row justify="between">
								<Chip color={exam.color}>{exam.name} · {exam.examDate}</Chip>
								<span data-fits={exam.name}>✓ fits</span>
							</Row>
						</Card>
					{:else}
						<Row gap="md">
							{#if prefs.companion !== 'off'}<Yuki state="worried-kind" size={72} />{/if}
							<StickyNote
								title="{exam.name} ({exam.examDate}) is {hours(exam.shortfallMinutes)} short"
							>
								<span data-short={exam.name}>
									Work due by then: {hours(exam.workMinutes)}; time until then: {hours(
										exam.availableMinutes
									)}. Here's what I'd cut:
								</span>
								<ul>
									{#each exam.degradations as step (step)}
										<li>
											{STEPS[step]}{step === 'cut' ? ` (${exam.cutCount} pieces)` : ''}
										</li>
									{/each}
								</ul>
								Or add time below.
							</StickyNote>
						</Row>
					{/if}
				{/each}
			</Stack>
			{#key saved}
				<AvailabilityForm {availability} onsave={save} />
			{/key}
		</Grid>
		<Button variant="ghost" href={resolve('/')}>Back to Today</Button>
	{/if}
</Screen>
