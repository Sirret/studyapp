<!--
	Reader (DESIGN §10 Reader, §12; mockups 03-reader and 08-desktop-reader): one section of a
	topic. The text sits at a reading measure, with each section term underlined (KeyTerm) where it
	first appears and the tip in an aside. Once the reader is 900 px wide (a desktop window) it is three columns: the topic's section
	outline (left), the text (centre), key terms and tip (right). A section the chatbot wrote
	(source `generated`) carries an "Added by the chatbot" stamp. `footer` holds the next action.
	Reading is quiet: no sounds and no Yuki in the text (DESIGN §8, §9).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { markSection } from '../reader/mark-terms.ts';
	import KeyTerm from './KeyTerm.svelte';
	import PawRing, { type RingState } from './PawRing.svelte';
	import Stamp from './Stamp.svelte';
	import TrapAside from './TrapAside.svelte';

	type OutlineItem = { title: string; state: RingState; label?: string };

	let {
		eyebrow,
		title,
		text,
		tip = null,
		terms = [],
		generated = false,
		outlineTitle,
		outline = [],
		footer
	}: {
		/** A Courier line above the title, e.g. "Section 2 of 3". */
		eyebrow?: string;
		title: string | null;
		text: string;
		tip?: string | null;
		terms?: string[];
		generated?: boolean;
		/** The topic name heading the outline column. */
		outlineTitle?: string;
		outline?: OutlineItem[];
		footer?: Snippet;
	} = $props();

	const paragraphs = $derived(markSection(text, terms));
</script>

<div class="reader-box" data-reader>
	<div class="reader">
		{#if outline.length > 0}
			<nav class="outline" aria-label="Sections">
				{#if outlineTitle}<p class="outline-title">{outlineTitle}</p>{/if}
				<ol>
					{#each outline as item, i (i)}
						<li aria-current={item.state === 'current' ? 'step' : undefined}>
							<PawRing state={item.state} label={item.label} small />
							<span>{item.title}</span>
						</li>
					{/each}
				</ol>
			</nav>
		{/if}

		<article class="text">
			{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
			{#if title}<h1>{title}</h1>{/if}
			{#if generated}<span class="stamp"><Stamp text="Added by the chatbot" dashed /></span>{/if}
			{#each paragraphs as segments, p (p)}
				<p class="para">
					{#each segments as segment, s (s)}
						{#if segment.term}<KeyTerm>{segment.text}</KeyTerm>{:else}{segment.text}{/if}
					{/each}
				</p>
			{/each}
			{#if footer}<div class="footer">{@render footer()}</div>{/if}
		</article>

		{#if terms.length > 0 || tip}
			<aside class="side" aria-label="Key terms and tip">
				{#if terms.length > 0}
					<div class="terms">
						<p class="side-title">Key terms</p>
						<ul>
							{#each terms as term (term)}<li>{term}</li>{/each}
						</ul>
					</div>
				{/if}
				{#if tip}
					<TrapAside label="Tip"><p class="tip">{tip}</p></TrapAside>
				{/if}
			</aside>
		{/if}
	</div>
</div>

<style>
	/* The columns follow the reader's own width (beside the app sidebar, or a style-guide pane), not the window. */
	.reader-box {
		container-type: inline-size;
	}

	.reader {
		display: grid;
		gap: var(--gap-xl);
	}

	.outline,
	.terms {
		display: none;
	}

	.text {
		display: grid;
		gap: var(--gap-md);
		max-width: var(--measure-max);
	}

	.eyebrow,
	.outline-title,
	.side-title {
		margin: 0;
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking-wide);
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--type-title-size);
		line-height: var(--type-title-leading);
		font-weight: var(--type-title-weight);
	}

	.stamp {
		justify-self: start;
	}

	.para {
		margin: 0;
		color: var(--text);
		font-size: var(--type-reading-size);
		line-height: var(--type-reading-leading);
		overflow-wrap: break-word;
	}

	.footer {
		display: grid;
		gap: var(--gap-sm);
		margin-top: var(--gap-md);
	}

	.side {
		display: grid;
		align-content: start;
		gap: var(--gap-lg);
	}

	.tip {
		margin: 0;
	}

	ol,
	ul {
		display: grid;
		gap: var(--gap-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.outline li {
		display: flex;
		align-items: center;
		gap: var(--gap-sm);
		color: var(--text-soft);
		font-size: var(--type-small-size);
		line-height: var(--type-small-leading);
	}

	.outline li[aria-current] {
		color: var(--text);
		font-weight: var(--type-strong-weight);
	}

	.terms li {
		font-size: var(--type-small-size);
		font-weight: var(--type-strong-weight);
		line-height: var(--type-small-leading);
	}

	/*
	 * A 1024 px window minus the sidebar leaves about 730 px: text and the key terms and tip side by
	 * side; the outline joins from 900 px (Decisions "UX fix: reader key terms").
	 */
	@container (min-width: 700px) {
		.reader {
			grid-template-columns: minmax(0, var(--measure-max)) minmax(0, 1fr);
			align-items: start;
		}

		.terms {
			display: grid;
			gap: var(--gap-sm);
			padding: var(--gap-lg);
			border: var(--border-width) solid var(--outline);
			border-radius: var(--r-md);
			background: var(--surface);
		}
	}

	/*
	 * DESIGN §10 desktop reader: outline · text at 60–70 ch · key terms and tip, once the reader is
	 * at least 900 px wide (a 1280 px window minus the sidebar leaves about 1020 px).
	 */
	@container (min-width: 900px) {
		.reader {
			grid-template-columns: minmax(0, 1fr) minmax(0, var(--measure-max)) minmax(0, 1fr);
			align-items: start;
		}

		.outline,
		.terms {
			display: grid;
			gap: var(--gap-sm);
		}

		.outline {
			grid-column: 1;
		}

		.text {
			grid-column: 2;
		}

		.side {
			grid-column: 3;
		}

		.terms {
			padding: var(--gap-lg);
			border: var(--border-width) solid var(--outline);
			border-radius: var(--r-md);
			background: var(--surface);
		}
	}
</style>
