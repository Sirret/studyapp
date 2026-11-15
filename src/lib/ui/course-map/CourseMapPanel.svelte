<!--
	The course map on the course page (PROMPTS §3 @bigpicture, @habit, @cheat; DESIGN §12 "Cheat
	sheet"): how the topics connect (collapsible, it overflows on phones), the questions to be able
	to answer, and the cheat table. Tokens only.
-->
<script lang="ts">
	import type { CourseMap } from '#lib/db/schemas/course.ts';
	import SectionHeading from '../components/SectionHeading.svelte';
	import Stack from '../layout/Stack.svelte';
	import Button from '../primitives/Button.svelte';

	interface Props {
		map: CourseMap;
		/** Anchor id of the section heading (the top bar's "Cheat sheet" stamp links to it). */
		id?: string;
	}

	let { map, id }: Props = $props();
	let connectsOpen = $state(false);
	const connectsId = $derived(`${id ?? 'course-map'}-connects`);
</script>

<section class="course-map" aria-label="Course map">
	<Stack gap="lg">
		<SectionHeading title="Cheat sheet" {id} />

		{#if map.bigpicture.length > 0}
			<Stack gap="sm">
				<div class="subhead">
					<h3>How it connects</h3>
					<Button
						variant="ghost"
						aria-expanded={connectsOpen}
						aria-controls={connectsId}
						onclick={() => (connectsOpen = !connectsOpen)}
						>{connectsOpen ? 'Hide' : `Show ${map.bigpicture.length}`}</Button
					>
				</div>
				<ul id={connectsId} hidden={!connectsOpen}>
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
								<th scope="col"><span class="sr-only">Attribute</span></th>
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
	</Stack>
</section>

<style>
	.subhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap-md);
	}

	h3 {
		margin: 0;
		color: var(--text-strong);
		font-family: var(--font-body);
		font-size: var(--type-body-size);
		font-weight: var(--type-strong-weight);
		line-height: var(--type-body-leading);
	}

	ul {
		margin: 0;
		padding-left: var(--space-20);
		display: grid;
		gap: var(--gap-xs);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--type-body-size);
		line-height: var(--type-body-leading);
		overflow-wrap: anywhere;
	}

	ul[hidden] {
		display: none;
	}

	li::marker {
		color: var(--accent);
	}

	.scroll {
		overflow-x: auto;
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-sm);
		background: var(--surface);
	}

	table {
		border-collapse: collapse;
		width: 100%;
		font-family: var(--font-body);
		font-size: var(--type-small-size);
		line-height: var(--type-small-leading);
		color: var(--text);
	}

	th,
	td {
		padding: var(--gap-xs) var(--gap-sm);
		border-bottom: var(--hairline) solid var(--line-strong);
		text-align: start;
		vertical-align: top;
	}

	thead th {
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
		color: var(--text-soft);
		background: var(--surface-sunk);
	}

	tbody th {
		font-weight: var(--type-strong-weight);
		color: var(--text-strong);
	}

	tbody tr:last-child th,
	tbody tr:last-child td {
		border-bottom: none;
	}
</style>
