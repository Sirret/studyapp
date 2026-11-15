<!-- Layer 8 in the style guide: the layout pieces screens are built from. Dev builds only. -->
<script lang="ts">
	import { ArrowLeft, Settings, X } from '@lucide/svelte';
	import PhaseLabel from '../components/PhaseLabel.svelte';
	import ProgressStrip from '../components/ProgressStrip.svelte';
	import BottomNav from '../layout/BottomNav.svelte';
	import Grid from '../layout/Grid.svelte';
	import Row from '../layout/Row.svelte';
	import Sidebar from '../layout/Sidebar.svelte';
	import Stack from '../layout/Stack.svelte';
	import TopBar from '../layout/TopBar.svelte';
	import Card from '../primitives/Card.svelte';
	import Chip from '../primitives/Chip.svelte';
	import Icon from '../primitives/Icon.svelte';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';

	const hrefs = { den: '#den', shelf: '#shelf', import: '#import' };
	const withPlay = { ...hrefs, play: '#play' };
</script>

<GuideSection id="layout" title="Layout" layer="Layer 8">
	<GuideRow label="Top bars: wordmark (home), breadcrumb with back and settings">
		<div class="wide">
			<Card padding="none">
				<TopBar title="Snowpack" wordmark>
					{#snippet trailing()}<Icon icon={Settings} size="nav" label="Settings" />{/snippet}
				</TopBar>
			</Card>
		</div>
		<div class="wide">
			<Card padding="none">
				<TopBar title="Networking · Topics">
					{#snippet leading()}<Icon icon={ArrowLeft} size="nav" label="Back" />{/snippet}
					{#snippet trailing()}<Icon icon={Settings} size="nav" label="Settings" />{/snippet}
				</TopBar>
			</Card>
		</div>
	</GuideRow>
	<GuideRow label="Session top bar">
		<div class="wide">
			<Card padding="none">
				<TopBar knit={false}>
					{#snippet leading()}<Icon icon={X} size="nav" label="Close" />{/snippet}
					{#snippet middle()}<Chip color="lavender">Databases</Chip><PhaseLabel
							phase="recall"
						/>{/snippet}
					{#snippet below()}<ProgressStrip done={8} total={20} />{/snippet}
				</TopBar>
			</Card>
		</div>
	</GuideRow>
	<GuideRow label="Stack, row and grid (two columns from 1024 px)">
		<Stack gap="sm">
			<Row justify="between"><span>Row start</span><span>Row end</span></Row>
			<Grid columns={2}>
				<Card>Grid cell one</Card>
				<Card>Grid cell two</Card>
			</Grid>
		</Stack>
	</GuideRow>
	<GuideRow label="Bottom navigation (now, and with Play from Phase 11)">
		<div class="wide"><BottomNav active="den" {hrefs} fixed={false} /></div>
		<div class="wide"><BottomNav active="shelf" hrefs={withPlay} fixed={false} /></div>
	</GuideRow>
	<GuideRow label="Sidebar (desktop from 1024 px; the same tabs, Yuki small at the bottom)">
		<div class="sidebar"><Sidebar active="shelf" {hrefs} /></div>
	</GuideRow>
</GuideSection>

<style>
	.wide {
		width: 100%;
	}

	.sidebar {
		width: 100%;
		max-width: var(--sidebar-width);
		height: var(--size-px-560);
	}
</style>
