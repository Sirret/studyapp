<!--
	Import preview (DESIGN §6 Import): what will be added, first and in plain words. Problems never
	block: skipped parts and unsure cards are one line each, with the details folded away. Topics
	get a read / haven't-read switch (default haven't read), with "all" shortcuts.
	Decisions log: import preview, agreed by the UI-flow and student-effort reviews.
-->
<script lang="ts">
	import type { Placement } from '#lib/db/schemas/common.ts';
	import type { NoteType } from '#lib/db/schemas/note.ts';
	import type { ImportPreview, TopicPreview } from '#lib/services/import-service.ts';
	import { copyText } from '#lib/util/clipboard.ts';
	import { countOf } from '#lib/util/plural.ts';
	import Disclosure from '../components/Disclosure.svelte';
	import SectionHeading from '../components/SectionHeading.svelte';
	import StickyNote from '../components/StickyNote.svelte';
	import Row from '../layout/Row.svelte';
	import Stack from '../layout/Stack.svelte';
	import Button from '../primitives/Button.svelte';
	import Card from '../primitives/Card.svelte';
	import Segmented from '../primitives/Segmented.svelte';
	import ImportChecklist from './ImportChecklist.svelte';

	interface Props {
		preview: ImportPreview;
		placements: ReadonlyMap<string, Placement>;
		onPlacement: (topicName: string, placement: Placement) => void;
		onJumpToLine: (line: number) => void;
		/** A prompt asking the chatbot to rewrite the skipped parts; `null` when nothing was skipped. */
		fixPrompt?: string | null;
	}

	let { preview, placements, onPlacement, onJumpToLine, fixPrompt = null }: Props = $props();

	/** The singular of each note type; `countOf` adds the plural. */
	const NOTE_LABELS: Record<NoteType, string> = {
		keyterm: 'key term',
		fact: 'fact',
		cloze: 'fill-in sentence',
		sequence: 'sequence',
		example: 'worked example',
		compare: 'comparison table',
		scenario: 'scenario',
		diagram: 'diagram',
		occlusion: 'image card'
	};
	const PLACEMENTS = [
		{ value: 'unread', label: "Haven't read" },
		{ value: 'read', label: 'Read it' }
	] as const;

	const plural = countOf;
	const kinds = $derived(
		(Object.keys(NOTE_LABELS) as NoteType[])
			.filter((type) => preview.noteCounts[type])
			.map((type) => countOf(preview.noteCounts[type] ?? 0, NOTE_LABELS[type]))
			.join(' · ')
	);
	const hasDetails = $derived(
		preview.plan.coverage.length > 0 ||
			preview.unusedImages.length > 0 ||
			preview.generatedChunkCount > 0
	);

	function placementOf(topic: TopicPreview): Placement {
		return placements.get(topic.name) ?? topic.existing?.placement ?? 'unread';
	}

	function setAll(placement: Placement): void {
		for (const topic of preview.topics) onPlacement(topic.name, placement);
	}

	/** Copies the resume prompt; the text is also shown below, so it can be copied by hand. */
	async function copyResume(): Promise<void> {
		if (!preview.resumePrompt) return;
		resumeNote = (await copyText(preview.resumePrompt))
			? 'Copied. Paste it into a new chat with your chatbot.'
			: 'Copying was blocked. Open "Show the resume prompt" below and copy it by hand.';
	}

	let resumeNote = $state('');
	let fixNote = $state('');

	/** Copies the fix-it prompt for the skipped parts (BUILD_PLAN §10 row 8.5). */
	async function copyFix(): Promise<void> {
		if (!fixPrompt) return;
		fixNote = (await copyText(fixPrompt))
			? 'Copied. Paste it into the same chat, then paste the reply at the end of your text here.'
			: 'Copying was blocked. Open "Show the fix-it prompt" below and copy it by hand.';
	}
</script>

<section aria-label="Preview">
	<Stack gap="lg">
		<Card>
			<Stack gap="xs">
				<h2>
					{plural(preview.cardCount, 'card', 'cards')} in {plural(
						preview.topics.length,
						'topic',
						'topics'
					)} ready to add
				</h2>
				{#if kinds}<p class="muted">{kinds}</p>{/if}
			</Stack>
		</Card>

		{#if preview.status === 'cut'}
			<StickyNote title="Your chatbot may have stopped early">
				The reply doesn't end with @end. In the chatbot, type "continue", then paste the rest at the
				end of your text here.
			</StickyNote>
		{:else if preview.status === 'stopped'}
			<StickyNote title="This reply ends at a topic break">
				Nothing is missing from what's here. For the next topics, copy the resume prompt into a new
				chat.
			</StickyNote>
		{/if}

		<ImportChecklist checklist={preview.checklist} missing={preview.missing} />

		{#if preview.resumePrompt}
			<Stack gap="sm">
				<Button variant="secondary" full onclick={copyResume}>Copy the resume prompt</Button>
				{#if resumeNote}<p class="muted" role="status">{resumeNote}</p>{/if}
				<Disclosure summary="Show the resume prompt" preformatted>{preview.resumePrompt}</Disclosure
				>
			</Stack>
		{/if}

		{#if preview.warnings.length > 0}
			<Disclosure
				summary="{plural(
					preview.warnings.length,
					'line',
					'lines'
				)} the app didn't recognise were skipped. Nothing else changes."
			>
				{#each preview.warnings as warning (`${warning.line}:${warning.message}`)}
					<Button variant="ghost" onclick={() => onJumpToLine(warning.line)}>
						Line {warning.line}: {warning.message}
					</Button>
				{/each}
			</Disclosure>
		{/if}

		{#if preview.errors.length > 0}
			<Disclosure
				summary="{plural(
					preview.errors.length,
					'part',
					'parts'
				)} couldn't be read and will be left out. Everything else is added."
			>
				{#each preview.errors as error (`${error.line}:${error.message}`)}
					<Button variant="ghost" onclick={() => onJumpToLine(error.line)}>
						Line {error.line}: {error.message}
					</Button>
				{/each}
			</Disclosure>
			{#if fixPrompt}
				<Stack gap="sm">
					<Button variant="secondary" full onclick={copyFix} data-copy-fix>
						Copy a fix-it prompt for these parts
					</Button>
					{#if fixNote}<p class="muted" role="status">{fixNote}</p>{/if}
					<Disclosure summary="Show the fix-it prompt" preformatted>{fixPrompt}</Disclosure>
				</Stack>
			{/if}
		{/if}

		{#if preview.duplicates.length > 0}
			<Disclosure
				summary="{plural(
					preview.duplicates.length,
					'line is',
					'lines are'
				)} already in this course, so they're left out."
			>
				{#each preview.duplicates as duplicate (duplicate.line)}
					<Button variant="ghost" onclick={() => onJumpToLine(duplicate.line)}>
						Line {duplicate.line} ({duplicate.topic})
					</Button>
				{/each}
			</Disclosure>
		{/if}

		{#if preview.checked.length > 0}
			<Disclosure
				summary="{plural(
					preview.checked.length,
					'card',
					'cards'
				)} the chatbot wasn't sure about. They're added; fix any that look wrong while you study."
			>
				{#each preview.checked as item (item.line)}<span>{item.text}</span>{/each}
			</Disclosure>
		{/if}

		{#if preview.topics.length > 0}
			<Stack gap="sm">
				<SectionHeading title="Have you read these yet?" />
				<p class="muted">
					Haven't read: Yuki teaches it step by step first. Read it: straight to quizzes.
				</p>
				<Row gap="sm">
					<Button variant="secondary" onclick={() => setAll('read')}>I've read all of these</Button>
					<Button variant="ghost" onclick={() => setAll('unread')}>Mark all unread</Button>
				</Row>
				{#each preview.topics as topic (topic.name)}
					<Card>
						<Stack gap="sm">
							<Stack gap="xs">
								<strong>{topic.name}</strong>
								<span class="muted">
									{topic.existing ? 'Adds to this topic · ' : ''}{plural(
										topic.cards,
										'card',
										'cards'
									)}
								</span>
							</Stack>
							<Segmented
								label="Placement for {topic.name}"
								options={PLACEMENTS}
								value={placementOf(topic)}
								onchange={(placement) => onPlacement(topic.name, placement)}
							/>
						</Stack>
					</Card>
				{/each}
			</Stack>
		{/if}

		{#if hasDetails}
			<Disclosure summary="Details">
				{#if preview.generatedChunkCount > 0}
					<span>
						{plural(preview.generatedChunkCount, 'reading chunk was', 'reading chunks were')} written
						by the chatbot, not taken from your notes.
					</span>
				{/if}
				{#if preview.plan.coverage.length > 0}
					<span>Sections covered: {preview.plan.coverage.join(', ')}</span>
				{/if}
				{#if preview.unusedImages.length > 0}
					<span>Images not used, so not saved: {preview.unusedImages.join(', ')}</span>
				{/if}
			</Disclosure>
		{/if}
	</Stack>
</section>

<style>
	h2,
	p {
		margin: 0;
	}

	h2 {
		font-size: var(--type-heading-size);
		line-height: var(--type-heading-leading);
		font-weight: var(--type-heading-weight);
	}

	.muted {
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}
</style>
