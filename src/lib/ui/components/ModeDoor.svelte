<!--
	Mode door (DESIGN §7): an arch-topped door in the mode's colour with a 2 px outline and a brass
	inset rim, holding an icon, a Courier label (LEARN / PRACTICE / EXAM PREP / PLAY) and a short
	hint. A small brass dot marks "has work"; the words "has work" are read out with it (§11). The
	label colour follows the fill through `--door-label`: wool on dark fills (pine, night,
	oxblood), ink on the light brass fill (lamp-light: its text-strong / bg). With `href` it is a
	link, otherwise a button. `disabled` (Play until Phase 11) is a disabled button with a dashed
	"Coming soon" stamp, faded but still readable, and no "has work" dot.
-->
<script lang="ts">
	import { BookOpen, Gamepad2, GraduationCap, Layers } from '@lucide/svelte';
	import Icon from '../primitives/Icon.svelte';
	import Stamp from './Stamp.svelte';

	type Mode = 'learn' | 'practice' | 'exam' | 'play';

	let {
		mode,
		hint,
		hasWork = false,
		href,
		disabled = false,
		stamp = 'Coming soon · Phase 11',
		onclick
	}: {
		mode: Mode;
		hint: string;
		hasWork?: boolean;
		/** Not open yet: no link, no action. */
		disabled?: boolean;
		/** The stamp on a disabled door. */
		stamp?: string;
		/** A resolve()d href; without it the door is a button. */
		href?: string;
		onclick?: () => void;
	} = $props();

	const DOORS = {
		learn: { label: 'Learn', icon: BookOpen },
		practice: { label: 'Practice', icon: Layers },
		exam: { label: 'Exam prep', icon: GraduationCap },
		play: { label: 'Play', icon: Gamepad2 }
	} as const;
	const door = $derived(DOORS[mode]);
</script>

{#snippet inside()}
	<Icon icon={door.icon} size="nav" />
	<span class="label">{door.label}</span>
	<span class="hint">{hint}</span>
	{#if disabled}
		<span class="stamp"><Stamp text={stamp} dashed /></span>
	{:else if hasWork}
		<span class="dot" aria-hidden="true"></span><span class="sr-only">, has work</span>
	{/if}
{/snippet}

{#if disabled}
	<button type="button" class="door {mode} disabled" disabled data-door-disabled>
		{@render inside()}
	</button>
{:else if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
	<a class="door {mode}" {href}>{@render inside()}</a>
{:else}
	<button type="button" class="door {mode}" {onclick}>{@render inside()}</button>
{/if}

<style>
	.door {
		--door-fill: var(--mode-learn);
		--door-label: var(--on-dark-fill);

		position: relative;
		display: grid;
		justify-items: center;
		align-content: center;
		gap: var(--gap-xs);
		width: 100%;
		min-height: calc(var(--control-height) * 2.5);
		padding: var(--gap-xl) var(--gap-md) var(--gap-lg);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-arch);
		background: var(--door-fill);
		box-shadow: var(--rim-inset);
		color: var(--door-label);
		font: inherit;
		text-align: center;
		text-decoration: none;
		cursor: pointer;
		transition: transform var(--dur-fast) var(--ease-out);
	}

	.door:active {
		transform: translateY(var(--press-travel));
	}

	.disabled {
		cursor: default;
	}

	.disabled:active {
		transform: none;
	}

	/* Faded with opacity only, so the label keeps its contrast ratio against its own fill. */
	.disabled > :global(:not(.stamp)) {
		opacity: 0.7;
	}

	.stamp {
		max-width: 100%;
		margin-top: var(--gap-xs);
	}

	/* A narrow door: the stamp wraps instead of spilling out of the arch. */
	.stamp > :global(.stamp) {
		white-space: normal;
	}

	.practice {
		--door-fill: var(--mode-practice);
	}

	.exam {
		--door-fill: var(--mode-exam);
	}

	.play {
		--door-fill: var(--mode-play);
		--door-label: var(--on-light-fill);
	}

	.label {
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking-wide);
		text-transform: uppercase;
	}

	.hint {
		font-size: var(--type-caption-size);
		line-height: var(--type-caption-leading);
	}

	/* "Has work": a brass dot at the top of the arch, ringed in the label colour so it also shows on the brass door. */
	.dot {
		position: absolute;
		top: var(--gap-md);
		left: 50%;
		transform: translateX(-50%);
		width: var(--door-dot);
		height: var(--door-dot);
		border-radius: var(--r-full);
		background: var(--rim);
		box-shadow: 0 0 0 var(--hairline) var(--door-label);
	}
</style>
