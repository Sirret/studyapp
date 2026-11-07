<!-- Layer 8 in the style guide: the layout pieces screens are built from. Dev builds only. -->
<script lang="ts">
	import { X } from '@lucide/svelte';
	import PhaseLabel from '../components/PhaseLabel.svelte';
	import ProgressStrip from '../components/ProgressStrip.svelte';
	import BottomNav from '../layout/BottomNav.svelte';
	import Grid from '../layout/Grid.svelte';
	import Row from '../layout/Row.svelte';
	import Stack from '../layout/Stack.svelte';
	import TopBar from '../layout/TopBar.svelte';
	import Card from '../primitives/Card.svelte';
	import Chip from '../primitives/Chip.svelte';
	import Icon from '../primitives/Icon.svelte';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';

	const hrefs = { today: '#today', courses: '#courses', plan: '#plan', settings: '#settings' };
</script>

<GuideSection id="layout" title="Layout" layer="Layer 8">
	<GuideRow label="Session top bar">
		<Card padding="none">
			<TopBar>
				{#snippet leading()}<Icon icon={X} size="nav" label="Close" />{/snippet}
				{#snippet middle()}<Chip color="lavender">Databases</Chip><PhaseLabel
						phase="recall"
					/>{/snippet}
				{#snippet below()}<ProgressStrip done={8} total={20} />{/snippet}
			</TopBar>
		</Card>
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
	<GuideRow label="Bottom navigation">
		<BottomNav active="today" {hrefs} fixed={false} />
	</GuideRow>
</GuideSection>
