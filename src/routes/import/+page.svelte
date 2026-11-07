<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';
	import type { CourseId, Placement } from '#lib/db/schemas/common.ts';
	import type { Course } from '#lib/db/schemas/course.ts';
	import type { ImageSource, ImportPreview, PreparedImage } from '#lib/services/import-service.ts';
	import { CHATBOT_PROMPT, importService } from '#lib/services/import-wiring.ts';
	import ImportPreviewPanel from '#lib/ui/import-screen/ImportPreviewPanel.svelte';

	// `raw`: IndexedDB can't store Svelte's reactive proxies, and these hold Blobs that reach it.
	let courses = $state.raw<Course[]>([]);
	let courseId = $state<CourseId | undefined>();
	let newCourseName = $state('');
	let text = $state('');
	let images = $state.raw<PreparedImage[]>([]);
	let imageErrors = $state.raw<string[]>([]);
	let preview = $state.raw<ImportPreview | undefined>();
	const placements = new SvelteMap<string, Placement>();
	let notice = $state('');
	let isBusy = $state(false);
	let pasteCount = 0;
	let textArea: HTMLTextAreaElement | undefined = $state();

	onMount(async () => {
		courses = await importService.listCourses();
		courseId = courses[0]?.id;
	});

	async function createCourse(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const name = newCourseName.trim();
		if (name === '') return;
		const course = await importService.createCourse(name);
		courses = [...courses, course];
		courseId = course.id;
		newCourseName = '';
	}

	async function copyPrompt(): Promise<void> {
		try {
			await navigator.clipboard.writeText(CHATBOT_PROMPT);
			notice = 'Prompt copied. Paste it into your own chatbot with your notes.';
		} catch {
			notice = 'Copying was blocked. Open "Show the prompt" below and copy it by hand.';
		}
	}

	function textChanged(): void {
		preview = undefined;
		notice = '';
	}

	/** Prepares images and adds them, replacing any earlier image with the same name. */
	async function addImages(sources: ImageSource[]): Promise<void> {
		isBusy = true;
		const prepared = await importService.prepareImages(sources);
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
		const result = await importService.commit(courseId, preview, placements);
		isBusy = false;
		if (!result.ok) {
			notice = result.error;
			return;
		}
		const { notes, cards, topics } = result.value;
		notice = `Added ${notes} notes and ${cards} cards across ${topics} topics.`;
		text = '';
		images = [];
		imageErrors = [];
		preview = undefined;
		placements.clear();
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

<main>
	<p><a href={resolve('/')}>Back</a></p>
	<h1>Import</h1>

	<section aria-label="Choose a course">
		{#if courses.length > 0}
			<label>
				Course
				<select bind:value={courseId} onchange={textChanged}>
					{#each courses as course (course.id)}
						<option value={course.id}>{course.name}</option>
					{/each}
				</select>
			</label>
		{/if}
		<form onsubmit={createCourse}>
			<label>
				New course
				<input bind:value={newCourseName} maxlength="120" autocomplete="off" />
			</label>
			<button type="submit" disabled={newCourseName.trim() === ''}>Create course</button>
		</form>
	</section>

	<section aria-label="Chatbot prompt">
		<button type="button" onclick={copyPrompt}>Copy the chatbot prompt</button>
		<details>
			<summary>Show the prompt</summary>
			<pre>{CHATBOT_PROMPT}</pre>
		</details>
	</section>

	<section aria-label="Text and images">
		<label>
			Paste the chatbot's text
			<textarea
				bind:this={textArea}
				bind:value={text}
				oninput={textChanged}
				onpaste={pasteImages}
				rows="12"
				spellcheck="false"></textarea>
		</label>
		<label>
			Attach images or a .zip
			<input type="file" accept="image/*,.zip" multiple onchange={attachFiles} />
		</label>
		<label>
			Take a photo
			<input type="file" accept="image/*" capture="environment" onchange={attachFiles} />
		</label>
		{#if images.length > 0}
			<p>Attached: {images.map((image) => image.fileName).join(', ')}</p>
		{/if}
		{#each imageErrors as error (error)}
			<p role="alert">{error}</p>
		{/each}
		<button
			type="button"
			disabled={!courseId || text.trim() === '' || isBusy}
			onclick={checkImport}
		>
			Check
		</button>
	</section>

	{#if preview}
		<ImportPreviewPanel
			{preview}
			{placements}
			onPlacement={(topicName, placement) => placements.set(topicName, placement)}
			onJumpToLine={jumpToLine}
		/>
		<button type="button" disabled={preview.topics.length === 0 || isBusy} onclick={commitImport}>
			Add to course
		</button>
	{/if}

	{#if notice}
		<p role="status">{notice}</p>
	{/if}
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		max-width: 48rem;
		margin-inline: auto;
	}

	section,
	form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	textarea,
	input,
	select {
		width: 100%;
		box-sizing: border-box;
		min-height: 2.75rem;
		font-size: 1rem;
	}

	button {
		min-height: 2.75rem;
	}

	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
