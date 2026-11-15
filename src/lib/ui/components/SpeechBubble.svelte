<!-- Speech bubble (DESIGN §7, §9): Yuki talking, Literata italic, at most two short lines. -->
<script lang="ts">
	let { text, tail = 'left' }: { text: string; tail?: 'left' | 'bottom' } = $props();
</script>

<p class="bubble tail-{tail}">{text}</p>

<style>
	.bubble {
		position: relative;
		max-width: 100%;
		margin: 0;
		padding: var(--gap-sm) var(--gap-md);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-md);
		background: var(--surface);
		box-shadow: var(--shadow-raised);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--type-body-size);
		font-style: italic;
		line-height: var(--type-body-leading);
		font-weight: var(--type-body-weight);
	}

	.bubble::before {
		content: '';
		position: absolute;
		width: var(--size-px-10);
		height: var(--size-px-10);
		border: var(--border-width) solid var(--outline);
		border-top-color: transparent;
		border-right-color: transparent;
		background: var(--surface);
		transform: rotate(45deg);
	}

	.tail-left::before {
		top: 50%;
		left: calc(var(--size-px-6) * -1);
		margin-top: calc(var(--size-px-4) * -1);
	}

	.tail-bottom::before {
		bottom: calc(var(--size-px-6) * -1);
		transform: rotate(-45deg);
		left: var(--space-24);
	}
</style>
