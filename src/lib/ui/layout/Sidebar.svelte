<!--
	Sidebar, desktop ≥ 1024 px (DESIGN §7 Sidebar, §10): 260 px of sunk paper with the same tabs as
	the BottomNav, stacked as 44 px rows, and Yuki small at the bottom (unless the companion is off).
	The active tab is weight 600 with a 10 px accent paw beside its label (never colour alone).
	Screen shows it in its `side` slot from 1024 px only; below that the BottomNav is the nav.
-->
<script lang="ts">
	import { prefs } from '#lib/services/preferences.svelte.ts';
	import Yuki from '../components/yuki/Yuki.svelte';
	import Icon from '../primitives/Icon.svelte';
	import Paw from '../primitives/Paw.svelte';
	import { shownTabs, type NavHrefs, type NavTab } from './nav-tabs.ts';

	let { active, hrefs }: { active: NavTab; hrefs: NavHrefs } = $props();

	/** DESIGN §9: small (32-64 px) in the sidebar. */
	const YUKI_SIZE = 56;
	const shown = $derived(shownTabs(hrefs));
</script>

<div class="sidebar">
	<nav aria-label="Main">
		<ul class="tabs">
			{#each shown as tab (tab.id)}
				<li>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
					<a
						class="tab"
						class:active={active === tab.id}
						href={hrefs[tab.id]}
						aria-current={active === tab.id ? 'page' : undefined}
					>
						<Icon icon={tab.icon} size="nav" />
						<span>{tab.label}</span>
						<span class="mark" aria-hidden="true">
							{#if active === tab.id}<Paw size={10} />{/if}
						</span>
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	</nav>
	{#if prefs.companion !== 'off'}
		<div class="yuki"><Yuki state="idle" size={YUKI_SIZE} /></div>
	{/if}
</div>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: var(--gap-xl);
		height: 100%;
		padding: var(--gap-xl) var(--gap-lg);
		border-right: var(--border-dashed) solid var(--outline);
		background: var(--surface-sunk);
	}

	.tabs {
		display: grid;
		gap: var(--gap-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: var(--gap-md);
		min-height: var(--touch-min);
		padding: 0 var(--gap-md);
		border-radius: var(--r-sm);
		color: var(--text-soft);
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
		color: var(--accent);
	}

	.yuki {
		display: flex;
		justify-content: center;
	}
</style>
