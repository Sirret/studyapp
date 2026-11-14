<!-- The card list and import fixes in the style guide (Phase 8.5). Dev builds only. -->
<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import CardRow from '../card-list/CardRow.svelte';
	import NoteEditor from '../card-list/NoteEditor.svelte';
	import TopicGroup from '../card-list/TopicGroup.svelte';
	import UndoImport from '../card-list/UndoImport.svelte';
	import ImportPreviewPanel from '../import-screen/ImportPreviewPanel.svelte';
	import ImportStep from '../import-screen/ImportStep.svelte';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';
	import { SAMPLE_CARD_ROWS, SAMPLE_IMPORT_PREVIEW } from './guide-data.ts';

	const noop = () => undefined;
	const saveFails = async () => 'A sequence needs at least 2 steps.';
	const placements = new SvelteMap<string, 'read' | 'unread'>();
	const [first] = SAMPLE_CARD_ROWS;
	const withFixes = {
		...SAMPLE_IMPORT_PREVIEW,
		duplicates: [{ line: 8, topic: 'Lecture 1: Introduction' }]
	};
	const fixPrompt =
		'My study app could not import these parts of your last reply:\n\n- Line 12: Expected "A -> B".';
</script>

<GuideSection id="card-list" title="Card list and import fixes" layer="Layer 6">
	<GuideRow label="Card rows: plain, flagged + added, paused, image card, highlighted">
		<TopicGroup name="Lecture 1: Transport" count={SAMPLE_CARD_ROWS.length}>
			{#each SAMPLE_CARD_ROWS as row, i (row.noteId)}
				<CardRow
					{row}
					highlighted={i === 1}
					onedit={noop}
					onflag={noop}
					onunflag={noop}
					ondelete={noop}
				/>
			{/each}
		</TopicGroup>
	</GuideRow>
	{#if first}
		<GuideRow label="Note editor (save shows its error line)">
			<NoteEditor row={first} onsave={saveFails} oncancel={noop} />
		</GuideRow>
	{/if}
	<GuideRow label="Undo import">
		<UndoImport last={{ at: 0, notes: 12, studiedCards: 3 }} onundo={noop} />
	</GuideRow>
	<GuideRow label="Import step">
		<ImportStep step={1} title="Choose a course"><span>Course picker goes here.</span></ImportStep>
	</GuideRow>
	<GuideRow label="Preview with duplicates and a fix-it prompt">
		<ImportPreviewPanel
			preview={withFixes}
			{placements}
			onPlacement={noop}
			onJumpToLine={noop}
			{fixPrompt}
		/>
	</GuideRow>
</GuideSection>
