<!-- Speech bubble (DESIGN §5, §7.4): Yuki talking, in Caveat, at most two short lines. -->
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
		border: var(--hairline) solid var(--card-edge);
		border-radius: var(--r-lg);
		background: var(--surface);
		box-shadow: var(--shadow-1);
		font-family: var(--font-hand);
		font-size: var(--type-hand-size);
		line-height: var(--type-title-leading);
		font-weight: var(--type-caption-weight);
	}

	.bubble::before {
		content: '';
		position: absolute;
		width: var(--size-px-10);
		height: var(--size-px-10);
		background: var(--surface);
		transform: rotate(45deg);
	}

	.tail-left::before {
		top: 50%;
		left: calc(var(--size-px-4) * -1);
		margin-top: calc(var(--size-px-4) * -1);
	}

	.tail-bottom::before {
		bottom: calc(var(--size-px-4) * -1);
		left: var(--space-24);
	}
</style>
