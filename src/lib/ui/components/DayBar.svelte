<!--
	Day bar (DESIGN §7, planner): one day of the planner — a date pill (today highlighted), a stacked
	bar of the day's minutes in course colours over the available minutes, and a flag per exam on
	that day. Read as "Tue 12: Networks 30 min, Databases 10 min of 60".
-->
<script lang="ts">
	import { Flag } from '@lucide/svelte';
	import type { CourseColor } from '#lib/design/tokens.ts';
	import Icon from '../primitives/Icon.svelte';

	type Segment = { name: string; color: CourseColor; minutes: number };

	let {
		label,
		today = false,
		capMinutes,
		segments,
		exams = []
	}: {
		label: string;
		today?: boolean;
		capMinutes: number;
		segments: Segment[];
		exams?: { name: string; color: CourseColor }[];
	} = $props();

	const total = $derived(
		Math.max(
			capMinutes,
			segments.reduce((sum, s) => sum + s.minutes, 0)
		)
	);
	const summary = $derived(
		[
			...segments.map((s) => `${s.name} ${s.minutes} min`),
			`of ${capMinutes}`,
			...exams.map((e) => `${e.name} exam`)
		].join(', ')
	);
</script>

<div class="day" class:today role="group" aria-label="{label}: {summary}">
	<span class="pill">{label}</span>
	<div class="bar" aria-hidden="true">
		{#each segments as segment (segment.name)}
			<span
				class="segment"
				style:flex-grow={total === 0 ? 0 : segment.minutes / total}
				style:background="var(--course-{segment.color})"
			></span>
		{/each}
	</div>
	<span class="minutes">{capMinutes} min</span>
	{#each exams as exam (exam.name)}
		<span class="flag" style:color="var(--course-{exam.color})" title="{exam.name} exam">
			<Icon icon={Flag} />
		</span>
	{/each}
</div>

<style>
	.day {
		display: flex;
		align-items: center;
		gap: var(--gap-sm);
		min-height: var(--touch-min);
	}

	.pill {
		flex: none;
		min-width: var(--size-px-64);
		padding: var(--gap-xs) var(--gap-sm);
		border: var(--border-dashed) solid var(--line-strong);
		border-radius: var(--r-pill);
		background: var(--surface);
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
		text-align: center;
	}

	.today .pill {
		border-color: var(--btn-primary-bg);
		background: var(--btn-primary-bg);
		color: var(--btn-primary-fg);
	}

	.bar {
		display: flex;
		flex: 1;
		height: var(--size-px-10);
		overflow: hidden;
		border-radius: var(--r-pill);
		background: var(--surface-sunk);
		box-shadow: inset 0 0 0 var(--hairline) var(--line-strong);
	}

	.segment {
		flex-basis: 0;
		min-width: var(--size-px-2);
	}

	.minutes {
		flex: none;
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		font-weight: var(--type-body-weight);
	}

	.flag {
		display: inline-flex;
		flex: none;
	}
</style>
