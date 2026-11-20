<!--
	"Pick what to study" (SESSION_NOTES J): the line "Studying N of M topics · change" above the
	mode doors, and the sheet with the scope picker it opens. Saving stores the course's scope (kv
	`studyScope`) and tells the page to reload what depends on it. Nothing picked can't be saved.
-->
<script lang="ts">
	import type { CourseId } from '#lib/db/schemas/common.ts';
	import type { ScopeView } from '#lib/services/scope-service.ts';
	import ScopePicker from '#lib/ui/components/ScopePicker.svelte';
	import Sheet from '#lib/ui/components/Sheet.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { initialPicks, toScope, type Picks } from '#lib/ui/scope/scope-selection.ts';

	let {
		courseId,
		view,
		onsaved
	}: { courseId: CourseId; view: ScopeView; onsaved: () => Promise<void> } = $props();

	let open = $state(false);
	let saving = $state(false);
	let picks: Picks = $state(new Set());
	const scope = $derived(toScope(view, picks));

	function change(): void {
		picks = initialPicks(view);
		open = true;
	}

	async function save(): Promise<void> {
		if (scope === null) return;
		saving = true;
		try {
			const { scopeService } = await import('#lib/services/study-wiring.ts');
			await scopeService.set(courseId, scope);
			open = false;
			await onsaved();
		} finally {
			saving = false;
		}
	}
</script>

<div class="line" data-scope-line>
	<span>{view.whole ? 'Studying everything' : `Studying ${view.topics} of ${view.of} topics`}</span>
	<span aria-hidden="true">·</span>
	<Button variant="ghost" onclick={change} data-scope-change>change</Button>
</div>

<Sheet bind:open title="Pick what to study">
	<ScopePicker {view} bind:picks />
	<Row gap="sm">
		<Button disabled={scope === null} loading={saving} onclick={save} data-scope-save>Save</Button>
		<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
	</Row>
	{#if scope === null}<p class="note">Pick at least one section.</p>{/if}
</Sheet>

<style>
	.line,
	.note {
		margin: 0;
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		letter-spacing: var(--type-label-tracking);
	}

	.line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--gap-xs);
	}
</style>
