<!--
	The course page's "Undo import" (Decisions log, Phase 8.5: undo the latest import, any time).
	Says what goes and that studied cards keep their history, then asks once more.
-->
<script lang="ts">
	import type { LastImportView } from '#lib/services/import-undo.ts';
	import { countOf } from '#lib/util/plural.ts';
	import ConfirmDialog from '../components/ConfirmDialog.svelte';
	import Disclosure from '../components/Disclosure.svelte';
	import Stack from '../layout/Stack.svelte';
	import Button from '../primitives/Button.svelte';

	interface Props {
		last: LastImportView;
		busy?: boolean;
		onundo: () => void;
	}

	let { last, busy = false, onundo }: Props = $props();
	let open = $state(false);

	const when = $derived(
		new Date(last.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
	);
</script>

<Disclosure summary="Last import: {when}">
	<Stack gap="sm">
		<span>It added {countOf(last.notes, 'note')} that are still in this course.</span>
		<Button variant="danger" onclick={() => (open = true)} data-undo-import>Undo this import</Button
		>
	</Stack>
</Disclosure>

<ConfirmDialog
	bind:open
	title="Undo the last import?"
	confirmLabel="Undo import"
	{busy}
	onconfirm={onundo}
>
	{countOf(last.notes, 'note')} and their cards leave this course, and topics it changed go back to how
	they were.
	{#if last.studiedCards > 0}
		You've studied {countOf(last.studiedCards, 'of its cards', 'of its cards')}; your answers stay
		in your history.
	{/if}
</ConfirmDialog>
