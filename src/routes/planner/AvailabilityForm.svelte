<script lang="ts">
	import type { Availability } from '#lib/db/schemas/kv.ts';
	import Grid from '#lib/ui/layout/Grid.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Card from '#lib/ui/primitives/Card.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import Input from '#lib/ui/primitives/Input.svelte';
	import { X } from '@lucide/svelte';

	/**
	 * The availability calendar (DESIGN §6 Plan, DATA_MODEL §5): minutes per weekday, per-date
	 * overrides, the sleep window and exam-morning time. Saving re-plans every course.
	 * @see BUILD_PLAN §6.9
	 */
	let {
		availability,
		onsave
	}: { availability: Availability; onsave: (next: Availability) => Promise<void> } = $props();

	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	// The form edits its own copy; the saved values only seed it.
	// svelte-ignore state_referenced_locally
	let weekdays = $state(availability.weekdayMinutes.map(String));
	// svelte-ignore state_referenced_locally
	let overrides = $state(availability.overrides.map((o) => ({ ...o, minutes: String(o.minutes) })));
	// svelte-ignore state_referenced_locally
	let sleepStart = $state(availability.sleepWindow.start);
	// svelte-ignore state_referenced_locally
	let sleepEnd = $state(availability.sleepWindow.end);
	// svelte-ignore state_referenced_locally
	let morning = $state(String(availability.examMorningMinutes));
	let newDate = $state('');
	let newMinutes = $state('');
	let saving = $state(false);
	let error = $state<string | null>(null);

	const minutes = (text: string): number => Math.max(0, Math.round(Number(text) || 0));

	function addOverride(): void {
		if (!newDate) return;
		overrides = [
			...overrides.filter((o) => o.date !== newDate),
			{ date: newDate, minutes: String(minutes(newMinutes)) }
		];
		newDate = '';
		newMinutes = '';
	}

	async function save(): Promise<void> {
		saving = true;
		error = null;
		try {
			await onsave({
				weekdayMinutes: weekdays.map(minutes),
				overrides: overrides.map((o) => ({ date: o.date, minutes: minutes(o.minutes) })),
				sleepWindow: { start: sleepStart, end: sleepEnd },
				examMorningMinutes: minutes(morning)
			});
		} catch {
			error = "That didn't save. Check the times and dates, then try again.";
		} finally {
			saving = false;
		}
	}
</script>

<Card label="Your study time">
	<Stack gap="lg">
		<Grid columns={2}>
			{#each WEEKDAYS as day, i (day)}
				<Input
					label="{day} (min)"
					type="number"
					inputmode="numeric"
					min="0"
					bind:value={weekdays[i]}
					data-weekday={i}
				/>
			{/each}
		</Grid>
		<Row gap="md">
			<Input label="Sleep from" type="time" bind:value={sleepStart} />
			<Input label="Wake at" type="time" bind:value={sleepEnd} />
		</Row>
		<Input
			label="Exam-morning top-up (min)"
			type="number"
			inputmode="numeric"
			min="0"
			bind:value={morning}
		/>
		<Stack gap="sm">
			{#each overrides as override (override.date)}
				<Row gap="sm" justify="between">
					<span>{override.date}: {override.minutes} min</span>
					<Button
						variant="ghost"
						size="icon"
						aria-label="Remove {override.date}"
						onclick={() => (overrides = overrides.filter((o) => o.date !== override.date))}
					>
						<Icon icon={X} />
					</Button>
				</Row>
			{/each}
			<Row gap="sm">
				<Input label="A different day" type="date" bind:value={newDate} data-override-date />
				<Input
					label="Minutes that day"
					type="number"
					inputmode="numeric"
					min="0"
					bind:value={newMinutes}
					data-override-minutes
				/>
			</Row>
			<Button variant="secondary" onclick={addOverride} disabled={!newDate}>Add this day</Button>
		</Stack>
		{#if error}<p role="alert">{error}</p>{/if}
		<Button loading={saving} onclick={save} data-save-availability>Save and re-plan</Button>
	</Stack>
</Card>
