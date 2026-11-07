<!--
	Bottom navigation (DESIGN §4, §12): four tabs — Today, Courses, Plan, Settings — 64 px plus the
	safe-area inset; the active tab's icon sits on a soft pill. Hidden during a study session.
-->
<script lang="ts">
	import { CalendarDays, House, Library, Settings } from '@lucide/svelte';
	import Icon from '../primitives/Icon.svelte';

	type Tab = 'today' | 'courses' | 'plan' | 'settings';

	let {
		active,
		hrefs,
		fixed = true
	}: { active: Tab; hrefs: Record<Tab, string>; fixed?: boolean } = $props();

	const TABS = [
		{ id: 'today', label: 'Today', icon: House },
		{ id: 'courses', label: 'Courses', icon: Library },
		{ id: 'plan', label: 'Plan', icon: CalendarDays },
		{ id: 'settings', label: 'Settings', icon: Settings }
	] as const;
</script>

<nav class="nav" class:fixed aria-label="Main">
	{#each TABS as tab (tab.id)}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
		<a
			class="tab"
			class:active={active === tab.id}
			href={hrefs[tab.id]}
			aria-current={active === tab.id ? 'page' : undefined}
		>
			<span class="pill"><Icon icon={tab.icon} size="nav" /></span>
			<span class="label">{tab.label}</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/each}
</nav>

<style>
	.nav {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		height: calc(var(--nav-height) + env(safe-area-inset-bottom));
		padding-bottom: env(safe-area-inset-bottom);
		border-top: var(--hairline) solid var(--border);
		background: var(--surface);
	}

	.fixed {
		position: fixed;
		inset: auto 0 0;
		z-index: var(--z-sticky);
	}

	.tab {
		display: grid;
		place-items: center;
		align-content: center;
		gap: var(--size-px-2);
		color: var(--text-muted);
		font-size: var(--type-caption-size);
		font-weight: var(--type-caption-weight);
		text-decoration: none;
	}

	.pill {
		display: grid;
		place-items: center;
		width: var(--space-56);
		height: var(--size-px-28);
		border-radius: var(--r-pill);
	}

	.active {
		color: var(--primary);
	}

	.active .pill {
		background: var(--primary-soft);
	}
</style>
