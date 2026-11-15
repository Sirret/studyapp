<!--
	Buttons (DESIGN §6, §7). Primary is the PawButton: an ink pill with an oxblood lip, a wool
	circle holding a paw on the left and an optional Courier meta on the right; pressing moves it
	down 2 px and shrinks the lip. Secondary is the same shape on paper with a 2 px outline and the
	paw in a dashed ring. Ghost is the link button (accent, underlined, 44 px); danger is a link
	button in the wrong-answer colour. An `icon` snippet takes the paw's place. `data-paw` lets the
	paw-press layer draw a paw at the touch point (§8). With `href` it renders a link instead.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import Paw from './Paw.svelte';

	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'md' | 'session' | 'hero' | 'icon';
		full?: boolean;
		loading?: boolean;
		/** Leading paw (primary and secondary only); off for compact buttons. */
		paw?: boolean;
		/** Short Courier meta on the right, e.g. "2 questions". */
		meta?: string;
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
		paw = true,
		meta,
		disabled = false,
		type = 'button',
		icon,
		children,
		href,
		...rest
	}: Props = $props();

	const pill = $derived((variant === 'primary' || variant === 'secondary') && size !== 'icon');
	const lead = $derived(pill && (paw || icon !== undefined));
	const classes = $derived(
		`button ${variant} ${size === 'icon' ? 'icon-size' : size}${lead ? ' lead' : ''}`
	);
</script>

{#snippet inner()}
	{#if lead}
		<span class="bean" aria-hidden="true">
			{#if icon}{@render icon()}{:else}<Paw size={22} />{/if}
		</span>
	{:else if icon}
		<span class="icon" aria-hidden="true">{@render icon()}</span>
	{/if}
	<span class="label">{@render children()}</span>
	{#if meta && pill}<span class="meta">{meta}</span>{/if}
	{#if loading}
		<span class="dots" aria-hidden="true"
			>{#each [0, 1, 2] as i (i)}<span class="dot"><Paw size={16} /></span>{/each}</span
		>
	{/if}
{/snippet}

{#if href}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
	<a {...rest as HTMLAnchorAttributes} {href} class={classes} class:full data-paw>
		{@render inner()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button
		{...rest}
		{type}
		class={classes}
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
		--button-bg: var(--btn-primary-bg);
		--button-fg: var(--btn-primary-fg);
		--button-lip: var(--btn-primary-lip);
		--button-border: transparent;
		--button-height: var(--control-height);
		--button-bean-bg: var(--wool);
		--button-bean-fg: var(--accent);
		--button-bean-size: var(--size-px-40);

		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--gap-md);
		min-height: var(--button-height);
		min-width: var(--touch-min);
		padding: 0 var(--gap-xl);
		border: var(--border-width) solid var(--button-border);
		border-radius: var(--r-pill);
		background: var(--button-bg);
		color: var(--button-fg);
		font-family: var(--font-body);
		font-size: var(--type-button-size);
		font-weight: var(--type-button-weight);
		line-height: var(--type-caption-leading);
		box-shadow: 0 var(--lip-height) 0 var(--button-lip);
		cursor: pointer;
		text-align: start;
		text-decoration: none;
		touch-action: manipulation;
		user-select: none;
		transition:
			transform var(--dur-fast) var(--ease-out),
			opacity var(--dur-fast) var(--ease-out);
	}

	.secondary {
		--button-bg: var(--surface);
		--button-fg: var(--text);
		--button-lip: transparent;
		--button-border: var(--outline);
		--button-bean-bg: transparent;
		--button-bean-fg: var(--text);
	}

	.ghost,
	.danger {
		--button-bg: transparent;
		--button-fg: var(--accent);
		--button-lip: transparent;

		min-height: var(--touch-min);
		padding: 0 var(--gap-sm);
		font-size: var(--type-body-size);
		font-weight: var(--type-strong-weight);
		text-decoration: underline;
		text-underline-offset: var(--size-px-4);
	}

	.danger {
		--button-fg: var(--wrong);
	}

	.session {
		--button-height: var(--control-height-session);
	}

	.hero {
		--button-height: var(--control-height-hero);
	}

	.lead {
		justify-content: flex-start;
		padding-inline-start: var(--gap-sm);
	}

	.lead .label {
		flex: 1;
	}

	.icon-size {
		width: var(--touch-min);
		min-height: var(--touch-min);
		padding: 0;
		text-decoration: none;
	}

	.full {
		width: 100%;
	}

	.button:active:not(:disabled) {
		transform: translateY(var(--press-travel));
		box-shadow: 0 var(--lip-pressed) 0 var(--button-lip);
	}

	.button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.loading:disabled {
		opacity: 1;
		cursor: progress;
	}

	.loading .label,
	.loading .meta,
	.loading .bean {
		opacity: 0;
	}

	.bean {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--button-bean-size);
		height: var(--button-bean-size);
		border-radius: var(--r-full);
		background: var(--button-bean-bg);
		color: var(--button-bean-fg);
	}

	.secondary .bean {
		border: var(--border-dashed) dashed var(--outline);
	}

	.icon {
		display: inline-flex;
		width: var(--icon-list);
		height: var(--icon-list);
	}

	.meta {
		flex: none;
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		font-weight: var(--type-caption-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
		opacity: 0.85;
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
