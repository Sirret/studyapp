<!-- PromptIntake (PROMPTS §2): the four intake questions, then the one prompt to copy. The prompt is built
     from the answers (buildPrompt), so the chatbot gets the GOAL block that matches them. -->
<script lang="ts">
	import {
		buildPrompt,
		GIVING_LABELS,
		IMAGES_TIP,
		PDF_TIP,
		type Giving,
		type Intake
	} from '#lib/services/import-wiring.ts';
	import { DEFAULT_IMPORT_GOAL } from '#lib/config/defaults.ts';
	import { copyText } from '#lib/util/clipboard.ts';
	import type { ImportGoal } from '#lib/db/schemas/course.ts';
	import Disclosure from '#lib/ui/components/Disclosure.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextArea from '#lib/ui/primitives/TextArea.svelte';

	let {
		onCopied,
		goal = $bindable<ImportGoal | undefined>(DEFAULT_IMPORT_GOAL)
	}: {
		/** Called after the copy attempt: true when the clipboard took the prompt. */
		onCopied: (copied: boolean) => void;
		/** The goal the student picked; the import saves it on the course map. */
		goal?: ImportGoal | undefined;
	} = $props();

	const GIVINGS = Object.entries(GIVING_LABELS) as [Giving, string][];
	const GOALS: { value: ImportGoal; label: string }[] = [
		{ value: 'learn', label: 'Learn it (read + questions)' },
		{ value: 'study', label: 'Just study (cards only)' },
		{ value: 'cram', label: 'Cram (essentials only)' }
	];

	let giving = $state<Giving | undefined>('lecture');
	let syllabus = $state('');

	const prompt = $derived(
		buildPrompt({
			giving: giving ?? 'lecture',
			goal: goal ?? DEFAULT_IMPORT_GOAL,
			syllabus
		} satisfies Intake)
	);

	async function copy(): Promise<void> {
		onCopied(await copyText(prompt));
	}
</script>

<Stack gap="md">
	<Select
		label="What are you giving the chatbot?"
		bind:value={giving}
		options={GIVINGS.map(([value, label]) => ({ value, label }))}
	/>
	<Select label="What do you want?" bind:value={goal} options={GOALS} />
	<TextArea
		label="Anything that shows what's examined? (optional)"
		bind:value={syllabus}
		rows={3}
	/>
	<p>{PDF_TIP}</p>
	<p>{IMAGES_TIP}</p>
	<Button variant="secondary" full onclick={copy}>Copy the chatbot prompt</Button>
	<Disclosure summary="Show the prompt" preformatted>{prompt}</Disclosure>
</Stack>
