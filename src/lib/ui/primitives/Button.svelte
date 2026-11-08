<!--
	Buttons (DESIGN §5, §12): soft and slightly tactile, with a darker bottom lip; pressing moves
	the button down and shrinks the lip. `data-paw` lets the paw-press layer draw a paw at the touch
	point (§11.2). Loading keeps the label for width and shows the paw loader instead. With `href`
	it renders a link that looks the same (navigation should be a link).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Paw from '../motifs/Paw.svelte';

	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'md' | 'session' | 'icon';
		full?: boolean;
		loading?: boolean;
		icon?: Snippet;
		children: Snippet;
		/** Renders a link instead (callers pass a resolve()d href). */
		href?: string;
	};

	let {
		variant = 'primary',
		size = 'md',
		full = false,
		loading = false,
		disabled = false,
		type = 'button',
		icon,
		children,
		href,
		...rest
	}: Props = $props();
</script>

{#snippet inner()}
	{#if icon}<span class="icon" aria-hidden="true">{@render icon()}</span>{/if}
	<span class="label">{@render children()}</span>
	{#if loading}
		<span class="dots" aria-hidden="true"
			>{#each [0, 1, 2] as i (i)}<span class="dot"><Paw size={16} /></span>{/each}</span
		>
	{/if}
{/snippet}

{#if href}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
	<a {href} class="button {variant} {size === 'icon' ? 'icon-size' : size}" class:full data-paw>
		{@render inner()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button
		{...rest}
		{type}
		class="button {variant} {size === 'icon' ? 'icon-size' : size}"
		class:full
		class:loading
		disabled={disabled || loading}
		aria-busy={loading || undefined}
		data-paw
	>
		{@render inner()}
	</button>
{/if}

<style>
	.button {
		--button-bg: var(--accent);
		--button-fg: var(--on-accent);
		--button-lip: var(--lip);
		--button-radius: var(--r-md);
		--button-height: var(--control-height);

		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--gap-sm);
		min-height: var(--button-height);
		min-width: var(--touch-min);
		padding: 0 var(--gap-xl);
		border: 0;
		border-radius: var(--button-radius);
		background: var(--button-bg);
		color: var(--button-fg);
		font-size: var(--type-button-size);
		font-weight: var(--type-strong-weight);
		box-shadow: inset 0 calc(var(--lip-height) * -1) 0 var(--button-lip);
		cursor: pointer;
		text-decoration: none;
		touch-action: manipulation;
		user-select: none;
		transition:
			transform var(--dur-fast) var(--ease-out),
			opacity var(--dur-fast) var(--ease-out);
	}

	.secondary {
		--button-bg: var(--primary-soft);
		--button-fg: var(--primary);
		--button-lip: var(--lip-secondary);
	}

	.ghost,
	.danger {
		--button-bg: transparent;
		--button-fg: var(--primary);
		--button-lip: transparent;
	}

	.danger {
		--button-fg: var(--error);
	}

	.session {
		--button-height: var(--control-height-session);
	}

	.icon-size {
		width: var(--touch-min);
		min-height: var(--touch-min);
		padding: 0;
	}

	.full {
		width: 100%;
	}

	.button:active:not(:disabled) {
		transform: translateY(var(--press-travel));
		box-shadow: inset 0 calc(var(--lip-pressed) * -1) 0 var(--button-lip);
	}

	.ghost:active:not(:disabled),
	.danger:active:not(:disabled) {
		background: var(--primary-soft);
	}

	.button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.loading:disabled {
		opacity: 1;
		cursor: progress;
	}

	.loading .label {
		opacity: 0;
	}

	.icon {
		display: inline-flex;
		width: var(--icon-list);
		height: var(--icon-list);
	}

	.dots {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--gap-xs);
	}

	.dot {
		animation: dot var(--dur-walk) var(--ease-out) infinite;
	}

	.dot:nth-child(2) {
		animation-delay: var(--dur-base);
	}

	.dot:nth-child(3) {
		animation-delay: var(--dur-slow);
	}

	@keyframes dot {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(0.8);
		}

		50% {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
