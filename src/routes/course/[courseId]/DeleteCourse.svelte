<!--
	Delete a course from its own page (Decisions "UX fix: delete from the course page"): a ghost
	danger button opens the Sheet, which names the course and what is lost (its cards and all its
	study history). Keeping the course is the first choice; nothing is deleted without the second tap.
-->
<script lang="ts">
	import Sheet from '#lib/ui/components/Sheet.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { countOf } from '#lib/util/plural.ts';

	let { name, cards, ondelete }: { name: string; cards: number; ondelete: () => Promise<void> } =
		$props();

	let open = $state(false);
	let deleting = $state(false);

	async function confirm(): Promise<void> {
		deleting = true;
		try {
			await ondelete();
			open = false;
		} finally {
			deleting = false;
		}
	}
</script>

<Button variant="ghost" full onclick={() => (open = true)} data-delete-course>
	Delete this course…
</Button>

<Sheet bind:open title="Delete {name}?">
	<p data-delete-what>
		This deletes {name}: its topics, {countOf(cards, 'card')} and all your study history for it (answers,
		progress and plans). This can't be undone.
	</p>
	<Row gap="sm">
		<Button variant="secondary" onclick={() => (open = false)}>Keep the course</Button>
		<Button variant="danger" loading={deleting} onclick={confirm} data-delete-confirm>
			Delete {name}
		</Button>
	</Row>
</Sheet>
