<!--
	Step list (DESIGN §6, acquisition and worked examples): numbered steps, each with its subgoal
	label as a caption above it, for worked-example study.
-->
<script lang="ts">
	let { steps }: { steps: { subgoal: string; step: string }[] } = $props();
</script>

<ol class="steps">
	{#each steps as item, i (i)}
		<li>
			<span class="subgoal">{item.subgoal}</span>
			<span class="step">{item.step}</span>
		</li>
	{/each}
</ol>

<style>
	.steps {
		display: grid;
		gap: var(--gap-md);
		margin: 0;
		padding-left: var(--gap-xl);
	}

	li {
		display: grid;
		gap: var(--gap-xs);
		padding-left: var(--gap-xs);
	}

	li::marker {
		color: var(--primary);
		font-weight: var(--type-strong-weight);
	}

	.subgoal {
		color: var(--primary);
		font-size: var(--type-caption-size);
		font-weight: var(--type-caption-weight);
		text-transform: uppercase;
	}

	.step {
		font-size: var(--type-reading-size);
		line-height: var(--type-answer-leading);
		overflow-wrap: anywhere;
	}
</style>
