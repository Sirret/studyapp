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
	import Disclosure from '../components/Disclosure.svelte';
	import StickyNote from '../components/StickyNote.svelte';
	import Row from '../layout/Row.svelte';
	import Stack from '../layout/Stack.svelte';
	import Button from '../primitives/Button.svelte';
	import Card from '../primitives/Card.svelte';
	import Segmented from '../primitives/Segmented.svelte';

	interface Props {
		preview: ImportPreview;
		placements: ReadonlyMap<string, Placement>;
		onPlacement: (topicName: string, placement: Placement) => void;
		onJumpToLine: (line: number) => void;
	}

	let { preview, placements, onPlacement, onJumpToLine }: Props = $props();

	const NOTE_LABELS: Record<NoteType, string> = {
		keyterm: 'key terms',
		fact: 'facts',
		cloze: 'fill-in sentences',
		sequence: 'sequences',
		example: 'worked examples',
		compare: 'comparison tables',
		scenario: 'scenarios',
		diagram: 'diagrams',
		occlusion: 'image cards'
	};
	const PLACEMENTS = [
		{ value: 'unread', label: "Haven't read" },
		{ value: 'read', label: 'Read it' }
	] as const;

	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	const kinds = $derived(
		(Object.keys(NOTE_LABELS) as NoteType[])
			.filter((type) => preview.noteCounts[type])
			.map((type) => `${preview.noteCounts[type]} ${NOTE_LABELS[type]}`)
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

		{#if !preview.ended}
			<StickyNote title="Your chatbot may have stopped early">
				The reply doesn't end with @end. In the chatbot, type "continue", then paste the rest at the
				end of your text here.
			</StickyNote>
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
				<h3>Have you read these yet?</h3>
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
	h3,
	p {
		margin: 0;
	}

	h2 {
		font-size: var(--type-heading-size);
		line-height: var(--type-heading-leading);
		font-weight: var(--type-heading-weight);
	}

	h3 {
		font-size: var(--type-body-size);
		font-weight: var(--type-strong-weight);
	}

	.muted {
		color: var(--text-muted);
		font-size: var(--type-small-size);
	}
</style>
