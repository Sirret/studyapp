<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';
	import type { CourseId, Placement } from '#lib/db/schemas/common.ts';
	import type { Course, ImportGoal } from '#lib/db/schemas/course.ts';
	import type {
		ImageSource,
		ImportPreview,
		LabelsToPlace,
		PreparedImage
	} from '#lib/services/import-service.ts';
	import {
		buildFixPrompt,
		coursesRecentFirst,
		importService
	} from '#lib/services/import-wiring.ts';
	import { DEFAULT_IMPORT_GOAL } from '#lib/config/defaults.ts';
	import { countOf } from '#lib/util/plural.ts';
	import { ArrowLeft } from '@lucide/svelte';
	import Banner from '#lib/ui/components/Banner.svelte';
	import ImportDone from '#lib/ui/import-screen/ImportDone.svelte';
	import ImportStep from '#lib/ui/import-screen/ImportStep.svelte';
	import ImportPreviewPanel from '#lib/ui/import-screen/ImportPreviewPanel.svelte';
	import PromptIntake from '#lib/ui/import-screen/PromptIntake.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import FileButton from '#lib/ui/primitives/FileButton.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import Input from '#lib/ui/primitives/Input.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextArea from '#lib/ui/primitives/TextArea.svelte';

	// `raw`: IndexedDB can't store Svelte's reactive proxies, and these hold Blobs that reach it.
	let courses = $state.raw<Course[]>([]);
	/**
	 * The picked course; '' = "New course" (the default). Coming from a course page
	 * (`/import?course=<id>`) picks that course (Decisions "UX fix: import course picker").
	 */
	let picked = $state('');
	const courseId = $derived(picked === '' ? undefined : (picked as CourseId));
	let newCourseName = $state('');
	let text = $state('');
	let images = $state.raw<PreparedImage[]>([]);
	let imageErrors = $state.raw<string[]>([]);
	/** "Preparing images 2 of 5" while images are encoded (off the page where the browser allows). */
	let imageProgress = $state<{ done: number; total: number } | null>(null);
	let preview = $state.raw<ImportPreview | undefined>();
	/** The intake's goal (PROMPTS §2); the commit saves it on the course map. */
	let goal = $state<ImportGoal | undefined>(DEFAULT_IMPORT_GOAL);
	const placements = new SvelteMap<string, Placement>();
	let notice = $state('');
	/** The course the last import went into, for "Start studying"; cleared by any new work. */
	let added = $state<CourseId | null>(null);
	/** The last import flagged some cards (unsure or starred-word gaps): link to "Check these". */
	let addedFlagged = $state(false);
	let toPlace = $state.raw<LabelsToPlace[]>([]);
	/** A text paste checks the import as soon as the text is in (preview on paste). */
	let checkAfterPaste = false;
	let isBusy = $state(false);
	let pasteCount = 0;
	let textArea: HTMLTextAreaElement | undefined = $state();

	onMount(async () => {
		courses = await coursesRecentFirst();
		const from = new URLSearchParams(location.search).get('course');
		picked = courses.some((course) => course.id === from) ? (from ?? '') : '';
	});

	async function createCourse(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const name = newCourseName.trim();
		if (name === '') return;
		const course = await importService.createCourse(name);
		courses = [course, ...courses];
		picked = course.id;
		newCourseName = '';
	}

	function promptCopied(copied: boolean): void {
		notice = copied
			? 'Prompt copied. Paste it into your own chatbot with your notes.'
			: 'Copying was blocked. Open "Show the prompt" below and copy it by hand.';
	}

	function textChanged(): void {
		preview = undefined;
		notice = '';
		added = null;
		if (checkAfterPaste) {
			checkAfterPaste = false;
			if (courseId && text.trim() !== '') void checkImport();
		}
	}

	/** Prepares images and adds them, replacing any earlier image with the same name. */
	async function addImages(sources: ImageSource[]): Promise<void> {
		isBusy = true;
		imageProgress = sources.length > 0 ? { done: 0, total: sources.length } : null;
		const prepared = await importService.prepareImages(sources, (done, total) => {
			imageProgress = { done, total };
		});
		imageProgress = null;
		const names = new Set(prepared.images.map((image) => image.fileName));
		images = [...images.filter((image) => !names.has(image.fileName)), ...prepared.images];
		imageErrors = prepared.errors;
		preview = undefined;
		isBusy = false;
	}

	async function openZip(file: File): Promise<ImageSource[]> {
		const zip = importService.openZip(new Uint8Array(await file.arrayBuffer()));
		if (!zip.ok) {
			notice = `${file.name}: ${zip.error}`;
			return [];
		}
		text = zip.value.text;
		notice = `Loaded the text from ${file.name} into the box below.`;
		return zip.value.images;
	}

	async function attachFiles(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const sources: ImageSource[] = [];
		for (const file of input.files ?? []) {
			if (file.name.toLowerCase().endsWith('.zip')) sources.push(...(await openZip(file)));
			else sources.push({ name: file.name, blob: file });
		}
		input.value = '';
		await addImages(sources);
	}

	/** A pasted screenshot has no useful name, so give it one a block can refer to. */
	function pasteImages(event: ClipboardEvent): void {
		if (event.clipboardData?.getData('text/plain')) checkAfterPaste = true;
		const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
			file.type.startsWith('image/')
		);
		if (files.length === 0) return;
		// Spreadsheets and web pages paste text and a picture together: keep the text then.
		if (!event.clipboardData?.getData('text/plain')) event.preventDefault();
		void addImages(
			files.map((file) => {
				pasteCount += 1;
				const extension = file.type.split('/')[1] ?? 'png';
				return { name: `pasted-${pasteCount}.${extension}`, blob: file };
			})
		);
	}

	async function checkImport(): Promise<void> {
		if (!courseId) return;
		isBusy = true;
		notice = '';
		preview = await importService.preview(courseId, text, images);
		isBusy = false;
	}

	async function commitImport(): Promise<void> {
		if (!courseId || !preview) return;
		isBusy = true;
		const result = await importService.commit(
			courseId,
			preview,
			placements,
			goal ?? DEFAULT_IMPORT_GOAL
		);
		isBusy = false;
		if (!result.ok) {
			notice = result.error;
			return;
		}
		const { notes, cards, topics } = result.value;
		notice = `Added ${countOf(notes, 'note')} and ${countOf(cards, 'card')} across ${countOf(topics, 'topic')}.`;
		added = courseId;
		addedFlagged = preview.checked.length > 0 || preview.starredGaps.length > 0;
		toPlace = result.value.toPlace ?? [];
		text = '';
		images = [];
		imageErrors = [];
		preview = undefined;
		placements.clear();
	}

	/** Back to an empty paste box for the next chatbot reply, same course. */
	function importMore(): void {
		added = null;
		toPlace = [];
		notice = '';
		textArea?.focus();
	}

	function jumpToLine(line: number): void {
		if (!textArea) return;
		const lines = text.split(/\r\n|\r|\n/);
		const start = lines.slice(0, line - 1).reduce((sum, item) => sum + item.length + 1, 0);
		textArea.focus();
		textArea.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
		const lineHeight = Number.parseFloat(getComputedStyle(textArea).lineHeight);
		if (Number.isFinite(lineHeight)) textArea.scrollTop = (line - 1) * lineHeight;
	}
</script>

<svelte:head>
	<title>Import</title>
</svelte:head>

<Screen>
	{#snippet top()}
		<TopBar title="Import">
			{#snippet leading()}
				<Button variant="ghost" size="icon" href={resolve('/')} aria-label="Back">
					<Icon icon={ArrowLeft} size="nav" />
				</Button>
			{/snippet}
		</TopBar>
	{/snippet}

	<ImportStep step={1} title="Choose a course">
		<Stack gap="md">
			{#if courses.length > 0}
				<Select
					label="Course"
					bind:value={picked}
					options={[
						{ value: '', label: 'New course' },
						...courses.map((course) => ({ value: course.id as string, label: course.name }))
					]}
					onchange={textChanged}
				/>
			{/if}
			<form onsubmit={createCourse}>
				<Stack gap="sm">
					<Input label="New course" bind:value={newCourseName} maxlength={120} />
					<Button type="submit" variant="secondary" disabled={newCourseName.trim() === ''}>
						Create course
					</Button>
				</Stack>
			</form>
		</Stack>
	</ImportStep>

	<ImportStep step={2} title="Copy the prompt into your chatbot">
		<PromptIntake onCopied={promptCopied} bind:goal />
	</ImportStep>

	<ImportStep step={3} title="Paste its reply">
		<Stack gap="md">
			<TextArea
				label="Paste the chatbot's text"
				bind:ref={textArea}
				bind:value={text}
				oninput={textChanged}
				onpaste={pasteImages}
				rows={12}
			/>
			<Row gap="sm">
				<FileButton
					label="Attach images or a .zip"
					accept="image/*,.zip"
					multiple
					onchange={attachFiles}
				/>
				<FileButton
					label="Take a photo"
					accept="image/*"
					capture="environment"
					onchange={attachFiles}
				/>
			</Row>
			{#if imageProgress}
				<p role="status">Preparing images {imageProgress.done} of {imageProgress.total}…</p>
			{/if}
			{#if images.length > 0}
				<p>Attached: {images.map((image) => image.fileName).join(', ')}</p>
			{/if}
			{#each imageErrors as error (error)}
				<p role="alert">{error}</p>
			{/each}
			<Button full disabled={!courseId || text.trim() === '' || isBusy} onclick={checkImport}>
				Check
			</Button>
		</Stack>
	</ImportStep>

	{#if preview}
		<ImportPreviewPanel
			{preview}
			{placements}
			onPlacement={(topicName, placement) => placements.set(topicName, placement)}
			onJumpToLine={jumpToLine}
			fixPrompt={buildFixPrompt(preview.errors, text)}
		/>
		<Button
			full
			size="session"
			meta={countOf(preview.cardCount, 'card')}
			disabled={preview.topics.length === 0 || isBusy}
			onclick={commitImport}
		>
			Add to course
		</Button>
	{/if}

	{#if notice}
		<Banner tone="success">{notice}</Banner>
	{/if}
	{#if added}
		<ImportDone courseId={added} flagged={addedFlagged} {toPlace} onImportMore={importMore} />
	{/if}
</Screen>
