<!--
	Scope picker (SESSION_NOTES J; Decisions log "Phase 8.6 Q12"; DESIGN §7 ChecklistRow, §12 "Pick
	what to study"): "Study all" (the default) on top, then each topic as a checklist row with its
	sections indented below. Ticking a topic ticks all its sections; a partly ticked topic says how
	many. Real checkboxes, 44 px rows. `picks` is bindable (section ids, or the topic id of a topic
	without sections); `scope-selection.ts` turns it into the scope to save.
-->
<script lang="ts">
	import type { ScopeView } from '#lib/services/scope-service.ts';
	import Checkbox from '../primitives/Checkbox.svelte';
	import {
		isAll,
		pickAll,
		pickedTopics,
		toggleSection,
		toggleTopic,
		topicPick,
		type Picks
	} from '../scope/scope-selection.ts';

	let { view, picks = $bindable() }: { view: ScopeView; picks: Picks } = $props();

	const all = $derived(isAll(view, picks));
	const count = $derived(pickedTopics(view, picks));
</script>

<div class="picker" data-scope-picker>
	<p class="summary" aria-live="polite">
		{all ? 'Studying everything' : `Studying ${count} of ${view.tree.length} topics`}
	</p>
	<div class="row all">
		<Checkbox bind:checked={() => all, (on) => (picks = pickAll(view, on))}>
			<span class="title">Study all</span>
		</Checkbox>
	</div>
	<ul class="topics">
		{#each view.tree as topic (topic.id)}
			{@const pick = topicPick(topic, picks)}
			{@const ticked = topic.sections.filter((s) => picks.has(s.id)).length}
			<li class="topic" data-scope-topic={topic.id}>
				<div class="row">
					<Checkbox bind:checked={() => pick === 'all', () => (picks = toggleTopic(topic, picks))}>
						<span class="title">{topic.name}</span>
					</Checkbox>
					{#if pick === 'some'}
						<span class="meta">{ticked} of {topic.sections.length}</span>
					{/if}
				</div>
				{#if topic.sections.length > 0}
					<ul class="sections" aria-label="Sections of {topic.name}">
						{#each topic.sections as section, i (section.id)}
							<li>
								<Checkbox
									bind:checked={
										() => picks.has(section.id), () => (picks = toggleSection(section.id, picks))
									}
								>
									<span class="section">{section.title ?? `Section ${i + 1}`}</span>
								</Checkbox>
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.picker {
		display: grid;
		gap: var(--gap-sm);
	}

	.summary,
	.meta {
		margin: 0;
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		letter-spacing: var(--type-label-tracking);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap-md);
	}

	.all {
		padding-bottom: var(--gap-sm);
		border-bottom: var(--hairline) dashed var(--decor);
	}

	.title {
		font-size: var(--type-body-size);
		font-weight: var(--type-button-weight);
	}

	.meta {
		white-space: nowrap;
	}

	ul {
		display: grid;
		gap: var(--gap-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.sections {
		padding-left: calc(var(--ring-size) + var(--gap-md));
	}

	.section {
		color: var(--text-soft);
		font-size: var(--type-small-size);
		line-height: var(--type-small-leading);
	}
</style>
