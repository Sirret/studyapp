<!-- Layers 1–3 in the style guide: colours, type, spacing and radii. Dev builds only. -->
<script lang="ts">
	import { COURSE_COLORS, THEME_COLORS } from '#lib/design/tokens.ts';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';

	const colors = Object.keys(THEME_COLORS.light);
	const types = ['display', 'title', 'heading', 'body', 'answer', 'small', 'caption'];
	const spaces = [4, 8, 12, 16, 20, 24, 32, 40, 56];
	const radii = ['sm', 'md', 'lg', 'xl', 'pill'];
</script>

<GuideSection id="tokens" title="Tokens and themes" layer="Layers 1–3">
	<GuideRow label="Colour tokens">
		{#each colors as token (token)}
			<span class="swatch">
				<span class="chip" style:background="var(--{token})"></span>
				<span class="name">--{token}</span>
			</span>
		{/each}
	</GuideRow>
	<GuideRow label="Course colours">
		{#each COURSE_COLORS as color (color)}
			<span class="swatch">
				<span class="chip" style:background="var(--course-{color})"></span>
				<span class="name">{color}</span>
			</span>
		{/each}
	</GuideRow>
	<GuideRow label="Type scale">
		<div class="types">
			{#each types as type (type)}
				<span
					style:font-size="var(--type-{type}-size)"
					style:line-height="var(--type-{type}-leading)"
					style:font-weight="var(--type-{type}-weight)">{type} — Snowpack</span
				>
			{/each}
			<span class="hand">Caveat — a note from Yuki</span>
		</div>
	</GuideRow>
	<GuideRow label="Spacing">
		{#each spaces as space (space)}
			<span class="space" style:width="var(--space-{space})" title="{space}px"></span>
		{/each}
	</GuideRow>
	<GuideRow label="Radii and elevation">
		{#each radii as radius (radius)}
			<span class="radius" style:border-radius="var(--r-{radius})">{radius}</span>
		{/each}
	</GuideRow>
</GuideSection>

<style>
	.swatch {
		display: grid;
		justify-items: center;
		gap: var(--gap-xs);
		width: var(--size-px-64);
	}

	.chip {
		width: var(--size-px-44);
		height: var(--size-px-44);
		border: var(--hairline) solid var(--border);
		border-radius: var(--r-sm);
	}

	.name {
		color: var(--text-muted);
		font-size: var(--type-caption-size);
		line-height: var(--type-caption-leading);
		text-align: center;
		overflow-wrap: anywhere;
	}

	.types {
		display: grid;
		gap: var(--gap-sm);
	}

	.hand {
		font-family: var(--font-hand);
		font-size: var(--type-hand-size);
	}

	.space {
		height: var(--space-16);
		border-radius: var(--size-px-2);
		background: var(--primary);
	}

	.radius {
		display: grid;
		place-items: center;
		width: var(--size-px-64);
		height: var(--size-px-48);
		background: var(--surface);
		box-shadow: var(--shadow-1);
		border: var(--hairline) solid var(--card-edge);
		color: var(--text-muted);
		font-size: var(--type-caption-size);
	}
</style>
