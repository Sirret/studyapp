<!--
	Segmented control (DESIGN §5): two or more choices side by side; the chosen one fills with
	`--primary` so the state is obvious at a glance. Buttons with aria-pressed, 44 px tall.
-->
<script lang="ts" generics="T extends string">
	let {
		label,
		options,
		value,
		onchange
	}: {
		label: string;
		options: readonly { value: T; label: string }[];
		value: T;
		onchange: (value: T) => void;
	} = $props();
</script>

<span class="segmented" role="group" aria-label={label}>
	{#each options as option (option.value)}
		<button
			type="button"
			class:selected={option.value === value}
			aria-pressed={option.value === value}
			onclick={() => onchange(option.value)}
			data-paw
		>
			{option.label}
		</button>
	{/each}
</span>

<style>
	.segmented {
		display: inline-flex;
		padding: var(--size-px-4);
		border-radius: var(--r-pill);
		background: var(--surface-alt);
	}

	button {
		min-height: var(--touch-min);
		padding: 0 var(--gap-md);
		border: 0;
		border-radius: var(--r-pill);
		background: transparent;
		color: var(--text-muted);
		font-size: var(--type-small-size);
		font-weight: var(--type-strong-weight);
		cursor: pointer;
		touch-action: manipulation;
		transition: background-color var(--dur-fast) var(--ease-out);
	}

	.selected {
		background: var(--primary);
		color: var(--on-primary);
	}
</style>
