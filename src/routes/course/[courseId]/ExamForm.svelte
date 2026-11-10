<script lang="ts">
	import type { ExamFormat } from '#lib/db/schemas/common.ts';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Card from '#lib/ui/primitives/Card.svelte';
	import Input from '#lib/ui/primitives/Input.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';

	/** The exam date, time and format of a course; saving re-plans the course. @see BUILD_PLAN §6.6 */
	let {
		examDate,
		examTime,
		examFormat,
		onsave
	}: {
		examDate: string | null;
		examTime: string | null;
		examFormat: ExamFormat;
		onsave: (exam: {
			examDate: string | null;
			examTime: string | null;
			examFormat: ExamFormat;
		}) => Promise<void>;
	} = $props();

	// The form edits its own copy; the course's saved values only seed it.
	// svelte-ignore state_referenced_locally
	let date = $state(examDate ?? '');
	// svelte-ignore state_referenced_locally
	let time = $state(examTime ?? '');
	// svelte-ignore state_referenced_locally
	let format = $state<ExamFormat>(examFormat);
	let saving = $state(false);

	const formats = [
		{ value: 'recognition', label: 'Multiple choice' },
		{ value: 'mixed', label: 'Mixed' },
		{ value: 'recall', label: 'Written' }
	] as const;

	async function save(): Promise<void> {
		saving = true;
		try {
			await onsave({ examDate: date || null, examTime: time || null, examFormat: format });
		} finally {
			saving = false;
		}
	}
</script>

<Card label="Exam">
	<Stack gap="md">
		<Input label="Exam date" type="date" bind:value={date} data-exam-date />
		<Input label="Start time (optional)" type="time" bind:value={time} />
		<Segmented
			label="Exam format"
			options={formats}
			value={format}
			onchange={(value) => (format = value)}
		/>
		<Button variant="secondary" loading={saving} onclick={save} data-save-exam>Save exam</Button>
	</Stack>
</Card>
