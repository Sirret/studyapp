<!--
	The links after a finished import (BUILD_PLAN §10 row 8.5): start studying the course, import
	more, see all cards and, when the import flagged some, check the unsure cards. Image notes whose
	`box:` labels still need a place get a "Place N labels" link to the image editor. Moved out of the
	import page to keep it under the file-size limit (BUILD_PLAN §15).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { CourseId } from '#lib/db/schemas/common.ts';
	import type { LabelsToPlace } from '#lib/services/import-service.ts';
	import { countOf } from '#lib/util/plural.ts';
	import Stack from '../layout/Stack.svelte';
	import Row from '../layout/Row.svelte';
	import Button from '../primitives/Button.svelte';

	let {
		courseId,
		flagged,
		toPlace = [],
		onImportMore
	}: {
		courseId: CourseId;
		flagged: boolean;
		toPlace?: readonly LabelsToPlace[];
		onImportMore: () => void;
	} = $props();

	const cardsHref = $derived(resolve('/course/[courseId]/cards', { courseId }));
</script>

<Row gap="sm">
	<Button href={resolve('/course/[courseId]', { courseId })} data-start-studying>
		Start studying
	</Button>
	<Button variant="secondary" onclick={onImportMore} data-import-more>Import more</Button>
</Row>
<Row gap="sm">
	<Button variant="ghost" href={cardsHref} data-see-all-cards>See all cards</Button>
	{#if flagged}
		<Button variant="ghost" href={`${cardsHref}?filter=flagged`} data-check-flagged>
			Check the unsure cards
		</Button>
	{/if}
</Row>
{#if toPlace.length > 0}
	<Stack gap="xs">
		<span class="hint"
			>These pictures have labels without a place yet; until then they make no cards.</span
		>
		{#each toPlace as item (item.noteId)}
			<Button
				variant="secondary"
				href={resolve('/course/[courseId]/image/[noteId]', { courseId, noteId: item.noteId })}
				data-place-labels
			>
				Place {countOf(item.count, 'label')} · {item.name}
			</Button>
		{/each}
	</Stack>
{/if}

<style>
	.hint {
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}
</style>
