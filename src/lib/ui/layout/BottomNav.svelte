<!--
	Bottom navigation, mobile (DESIGN §7 BottomNav): a sunk-paper bar with a 1.5 px top outline and
	the tabs Den (home), Shelf (courses) and Import notes, plus Play once Phase 11 passes its href.
	The active tab is weight 600 with a 10 px accent paw under its label (never colour alone).
	60 px plus the safe-area inset. Hidden during a study session. From 1024 px the fixed bar hides
	and the Sidebar (same tabs) takes over, so a screen with a BottomNav also passes Screen a Sidebar.
-->
<script lang="ts">
	import Icon from '../primitives/Icon.svelte';
	import Paw from '../primitives/Paw.svelte';
	import { shownTabs, type NavHrefs, type NavTab } from './nav-tabs.ts';

	let {
		active,
		hrefs,
		fixed = true
	}: {
		active: NavTab;
		hrefs: NavHrefs;
		fixed?: boolean;
	} = $props();

	const shown = $derived(shownTabs(hrefs));
</script>

<nav class="nav" class:fixed aria-label="Main" style:--tabs={shown.length}>
	{#each shown as tab (tab.id)}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
		<a
			class="tab"
			class:active={active === tab.id}
			href={hrefs[tab.id]}
			aria-current={active === tab.id ? 'page' : undefined}
		>
			<Icon icon={tab.icon} size="nav" />
			<span class="label">{tab.label}</span>
			<span class="mark" aria-hidden="true">
				{#if active === tab.id}<Paw size={10} />{/if}
			</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/each}
</nav>

<style>
	.nav {
		display: grid;
		grid-template-columns: repeat(var(--tabs), 1fr);
		min-height: calc(var(--nav-height) + env(safe-area-inset-bottom));
		padding-bottom: env(safe-area-inset-bottom);
		border-top: var(--border-dashed) solid var(--outline);
		background: var(--surface-sunk);
	}

	.fixed {
		position: fixed;
		inset: auto 0 0;
		z-index: var(--z-sticky);
	}

	@media (min-width: 1024px) {
		.fixed {
			display: none;
		}
	}

	.tab {
		display: grid;
		place-items: center;
		align-content: center;
		gap: var(--gap-2xs);
		min-height: var(--nav-height);
		padding-top: var(--gap-xs);
		color: var(--text-soft);
		font-size: var(--type-caption-size);
		line-height: var(--type-caption-leading);
		font-weight: var(--type-body-weight);
		text-decoration: none;
	}

	.active {
		color: var(--text);
		font-weight: var(--type-strong-weight);
	}

	.mark {
		display: grid;
		place-items: center;
		height: var(--size-px-10);
		color: var(--accent);
	}
</style>
