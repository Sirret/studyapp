<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { APP_SHORT_NAME } from '#lib/config/defaults.ts';
	import type { CourseId } from '#lib/db/schemas/common.ts';
	import { logger } from '#lib/services/app.ts';
	import { prefs } from '#lib/services/preferences.svelte.ts';
	import type { StudyView } from '#lib/services/study-types.ts';
	import EmptyState from '#lib/ui/components/EmptyState.svelte';
	import SpeechBubble from '#lib/ui/components/SpeechBubble.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import Yuki from '#lib/ui/components/yuki/Yuki.svelte';
	import PawLoader from '#lib/ui/delight/PawLoader.svelte';
	import Row from '#lib/ui/layout/Row.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Card from '#lib/ui/primitives/Card.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';

	type Course = StudyView['course'];
	let courses = $state<Course[] | null>(null);
	let starting = $state<string | null>(null);
	let failed = $state(false);

	async function service() {
		return (await import('#lib/services/study-wiring.ts')).studyService;
	}

	$effect(() => {
		service()
			.then((study) => study.listCourses())
			.then((list) => (courses = list))
			.catch((error: unknown) => {
				logger.error('today', 'courses not loaded', { error: String(error) });
				failed = true;
			});
	});

	async function practise(course: Course): Promise<void> {
		starting = course.id;
		try {
			const view = await (await service()).startCourse(course.id as CourseId);
			await goto(resolve('/study/[sessionId]', { sessionId: view.sessionId }));
		} finally {
			starting = null;
		}
	}
</script>

<Screen>
	<Row gap="md">
		{#if prefs.companion !== 'off'}<Yuki state="idle" size={96} />{/if}
		<SpeechBubble text="Hi! Pick a course and we'll practise." />
	</Row>
	{#if failed}
		<StickyNote title="Your courses didn't load">
			Reload the page to try again. Nothing was lost.
			{#snippet actions()}<Button onclick={() => location.reload()}>Reload</Button>{/snippet}
		</StickyNote>
	{:else if courses === null}
		<EmptyState message="Loading your courses…" companion={false}>
			{#snippet action()}<PawLoader />{/snippet}
		</EmptyState>
	{:else if courses.length === 0}
		<EmptyState message="No courses yet." companion={prefs.companion !== 'off'}>
			{#snippet action()}
				<Button onclick={() => goto(resolve('/import'))}>Import your first lecture</Button>
			{/snippet}
		</EmptyState>
	{:else}
		{#each courses as course (course.id)}
			<Card stripe={course.color} tag="article" label={course.name}>
				<Stack gap="md">
					<Row justify="between">
						<Chip color={course.color}>{course.name}</Chip>
					</Row>
					<Button
						full
						loading={starting === course.id}
						onclick={() => practise(course)}
						data-practise={course.name}>Practise</Button
					>
				</Stack>
			</Card>
		{/each}
		<Button variant="secondary" onclick={() => goto(resolve('/import'))}>Import more</Button>
	{/if}
	<span class="sr-only">{APP_SHORT_NAME}</span>
</Screen>
