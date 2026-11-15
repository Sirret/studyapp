<!--
	The links after a finished import (BUILD_PLAN §10 row 8.5): start studying the course, import
	more, see all cards and, when the import flagged some, check the unsure cards. Moved out of the
	import page to keep it under the file-size limit (BUILD_PLAN §15).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { CourseId } from '#lib/db/schemas/common.ts';
	import Row from '../layout/Row.svelte';
	import Button from '../primitives/Button.svelte';

	let {
		courseId,
		flagged,
		onImportMore
	}: { courseId: CourseId; flagged: boolean; onImportMore: () => void } = $props();

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
