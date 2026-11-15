<!--
	Segmented control (DESIGN §7, built like the Chip): two or more choices side by side in an
	outlined pill; the chosen one fills ink with a paper label (`--btn-primary-*`), and it is
	also bold, so the state never relies on colour alone. Buttons with aria-pressed, 44 px tall.
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
		display: flex;
		width: 100%;
		padding: var(--size-px-4);
		border: var(--border-dashed) solid var(--outline);
		border-radius: var(--r-pill);
		background: var(--surface);
	}

	button {
		flex: 1;
		min-height: var(--touch-min);
		padding: 0 var(--gap-md);
		border: 0;
		border-radius: var(--r-pill);
		background: transparent;
		color: var(--text-soft);
		font-family: var(--font-body);
		font-size: var(--type-chip-size);
		font-weight: var(--type-body-weight);
		cursor: pointer;
		touch-action: manipulation;
		transition: background-color var(--dur-fast) var(--ease-out);
	}

	.selected {
		background: var(--btn-primary-bg);
		color: var(--btn-primary-fg);
		font-weight: var(--type-strong-weight);
	}
</style>
