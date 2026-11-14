<!--
	The course map on the course page (PROMPTS §3 @bigpicture, @habit, @cheat): how the topics
	connect, the questions to be able to answer, and the cheat table. Tokens only.
-->
<script lang="ts">
	import type { CourseMap } from '#lib/db/schemas/course.ts';
	import Stack from '../layout/Stack.svelte';

	interface Props {
		map: CourseMap;
	}

	let { map }: Props = $props();
</script>

<section class="course-map" aria-label="Course map">
	{#if map.bigpicture.length > 0}
		<Stack gap="sm">
			<h3>How it connects</h3>
			<ul>
				{#each map.bigpicture as line (line)}
					<li>{line}</li>
				{/each}
			</ul>
		</Stack>
	{/if}

	{#if map.habit.length > 0}
		<Stack gap="sm">
			<h3>Questions to be able to answer</h3>
			<ul>
				{#each map.habit as question (question)}
					<li>{question}</li>
				{/each}
			</ul>
		</Stack>
	{/if}

	{#if map.cheat}
		<Stack gap="sm">
			<h3>{map.cheat.name}</h3>
			<div class="scroll">
				<table>
					<thead>
						<tr>
							<th scope="col"><span class="visually-hidden">Attribute</span></th>
							{#each map.cheat.items as item (item)}
								<th scope="col">{item}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each map.cheat.rows as row (row.attribute)}
							<tr>
								<th scope="row">{row.attribute}</th>
								{#each row.values as value, index (index)}
									<td>{value}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Stack>
	{/if}
</section>

<style>
	h3 {
		margin: 0;
		font-size: var(--type-body-size);
		font-weight: var(--type-strong-weight);
	}

	ul {
		margin: 0;
		padding-left: var(--space-20);
		display: grid;
		gap: var(--space-4);
	}

	.scroll {
		overflow-x: auto;
	}

	table {
		border-collapse: collapse;
		font-size: var(--type-small-size);
	}

	th,
	td {
		padding: var(--space-4) var(--space-8);
		border: var(--hairline) solid var(--border);
		text-align: start;
		vertical-align: top;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
