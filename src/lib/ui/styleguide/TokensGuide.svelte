<!-- Layers 1–3 in the style guide: colours, the four faces, spacing, radii and textures. Dev builds only. -->
<script lang="ts">
	import { COURSE_COLORS, THEME_COLORS } from '#lib/design/tokens.ts';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';

	const colors = Object.keys(THEME_COLORS.light);
	const types = ['body', 'answer', 'small'];
	const spaces = [2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32];
	const radii = ['xs', 'sm', 'md', 'pill', 'arch', 'tab'];
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
			<span class="display">Display — The den</span>
			<span class="wordmark">Snowpack · How it works</span>
			{#each types as type (type)}
				<span
					style:font-size="var(--type-{type}-size)"
					style:line-height="var(--type-{type}-leading)"
					style:font-weight="var(--type-{type}-weight)">{type} — Snowpack</span
				>
			{/each}
			<span class="label">LEARN · §2 OF 3</span>
		</div>
	</GuideRow>
	<GuideRow label="Textures">
		<span class="texture grain">grain</span>
		<span class="knit texture-knit"></span>
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
		border: var(--hairline) solid var(--line);
		border-radius: var(--r-sm);
	}

	.name {
		color: var(--text-soft);
		font-size: var(--type-caption-size);
		line-height: var(--type-caption-leading);
		text-align: center;
		overflow-wrap: anywhere;
	}

	.types {
		display: grid;
		gap: var(--gap-sm);
	}

	.display {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--type-display-size);
		line-height: var(--type-display-leading);
		color: var(--text-strong);
	}

	.wordmark {
		font-family: var(--font-wordmark);
		font-size: var(--type-wordmark-size);
		letter-spacing: var(--type-wordmark-tracking);
	}

	.label {
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		color: var(--text-soft);
	}

	.texture {
		display: grid;
		place-items: center;
		width: var(--size-px-64);
		height: var(--size-px-48);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-sm);
		color: var(--text-soft);
		font-size: var(--type-caption-size);
	}

	.texture-knit {
		width: var(--size-px-260);
	}

	.space {
		height: var(--space-16);
		border-radius: var(--size-px-2);
		background: var(--accent);
	}

	.radius {
		display: grid;
		place-items: center;
		width: var(--size-px-64);
		height: var(--size-px-48);
		background: var(--surface);
		box-shadow: var(--shadow-raised);
		border: var(--border-width) solid var(--outline);
		color: var(--text-soft);
		font-size: var(--type-caption-size);
	}
</style>
