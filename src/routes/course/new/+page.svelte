<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { logger } from '#lib/services/app.ts';
	import Hero from '#lib/ui/components/Hero.svelte';
	import Screen from '#lib/ui/layout/Screen.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import TopBar from '#lib/ui/layout/TopBar.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Card from '#lib/ui/primitives/Card.svelte';
	import Icon from '#lib/ui/primitives/Icon.svelte';
	import Input from '#lib/ui/primitives/Input.svelte';

	/**
	 * Manual mode, step one (`/course/new`): name the course and its first topic, then add cards on
	 * `/course/[id]/add`. No chatbot needed.
	 * @see Decisions log "Phase 8.6 Q15"; SESSION_NOTES §K (Welcome "Make cards by hand")
	 */
	let name = $state('');
	let topic = $state('');
	let busy = $state(false);
	let error = $state('');

	async function create(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (busy) return;
		if (name.trim() === '' || topic.trim() === '') {
			error = 'Name the course and its first topic.';
			return;
		}
		busy = true;
		error = '';
		try {
			const { manualContentService } = await import('#lib/services/study-wiring.ts');
			const course = await manualContentService.createCourse(name);
			const topicId = await manualContentService.addTopic(course.id, topic);
			const add = resolve('/course/[courseId]/add', { courseId: course.id });
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()d path plus a query
			await goto(`${add}?topic=${topicId}`);
		} catch (failure) {
			logger.error('manual', 'course not created', { error: String(failure) });
			error = "The course wasn't saved. Try again.";
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>New course</title></svelte:head>

<Screen>
	{#snippet top()}
		<TopBar title="New course">
			{#snippet leading()}
				<Button variant="ghost" size="icon" href={resolve('/')} aria-label="Home">
					<Icon icon={ArrowLeft} size="nav" />
				</Button>
			{/snippet}
		</TopBar>
	{/snippet}
	<Stack gap="md">
		<Hero
			eyebrow="Manual mode"
			title="Make cards by hand"
			subline="Name the course and a first topic. You can add more topics as you go."
		/>
		<Card>
			<form onsubmit={create}>
				<Stack gap="md">
					<Input label="Course name" bind:value={name} autocomplete="off" data-course-name />
					<Input label="First topic" bind:value={topic} autocomplete="off" data-topic-name />
					{#if error}<p class="error" role="alert">{error}</p>{/if}
					<Button type="submit" full loading={busy} disabled={busy} data-create-course>
						Create and add cards
					</Button>
				</Stack>
			</form>
		</Card>
	</Stack>
</Screen>

<style>
	.error {
		margin: 0;
		color: var(--wrong);
		font-size: var(--type-small-size);
	}
</style>
