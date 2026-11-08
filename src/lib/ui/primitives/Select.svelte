<!-- Select (DESIGN §12 Input): a native select styled like the inputs; the label names it. -->
<script lang="ts" generics="T extends string">
	let {
		label,
		value = $bindable(),
		options,
		onchange
	}: {
		label: string;
		value: T | undefined;
		options: readonly { value: T; label: string }[];
		onchange?: () => void;
	} = $props();
	const id = $props.id();
</script>

<div class="field">
	<label for={id}>{label}</label>
	<select {id} bind:value {onchange}>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</div>

<style>
	.field {
		display: grid;
		gap: var(--gap-xs);
	}

	label {
		color: var(--text-muted);
		font-size: var(--type-small-size);
		font-weight: var(--type-small-weight);
	}

	select {
		width: 100%;
		min-height: var(--input-height);
		padding: 0 var(--gap-md);
		border: var(--stroke) solid transparent;
		border-radius: var(--r-sm);
		background: var(--surface-alt);
		color: var(--text);
	}

	select:focus {
		border-color: var(--primary);
		outline: none;
	}
</style>
