<!--
	The feedback under a checked answer (DESIGN §7 FeedbackPanel): right or wrong, what was
	expected, then Continue / Try again, and "I was right" on a wrong typed answer until the student
	has claimed it (`accepted` holds the line saying what happened).
-->
<script lang="ts">
	import type { ExerciseVerdict } from '#lib/services/study-types.ts';
	import FeedbackPanel from '#lib/ui/components/FeedbackPanel.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';

	let {
		verdict,
		accepted,
		canClaim,
		oncontinue,
		onclaim
	}: {
		verdict: ExerciseVerdict;
		accepted: string | null;
		/** A typed exercise: a wrong answer can be claimed with "I was right". */
		canClaim: boolean;
		oncontinue: () => void;
		onclaim: () => void;
	} = $props();
</script>

<FeedbackPanel
	correct={verdict.correct}
	reveal={verdict.reveal}
	contrast={verdict.contrast}
	typo={verdict.typo}
	note={accepted ?? undefined}
>
	{#snippet actions()}
		<Button full size="session" onclick={oncontinue} data-next>
			{verdict.correct ? 'Continue' : 'Try again'}
		</Button>
		{#if !verdict.correct && canClaim && !accepted}
			<Button full variant="ghost" onclick={onclaim}>I was right</Button>
		{/if}
	{/snippet}
</FeedbackPanel>
