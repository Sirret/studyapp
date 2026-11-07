<!-- Layer 5 in the style guide: every primitive and motif in every state. Dev builds only. -->
<script lang="ts">
	import { BookOpen, Check, X } from '@lucide/svelte';
	import Button from '../primitives/Button.svelte';
	import Card from '../primitives/Card.svelte';
	import Checkbox from '../primitives/Checkbox.svelte';
	import Chip from '../primitives/Chip.svelte';
	import Icon from '../primitives/Icon.svelte';
	import Input from '../primitives/Input.svelte';
	import Toggle from '../primitives/Toggle.svelte';
	import Moon from '../motifs/Moon.svelte';
	import Paw from '../motifs/Paw.svelte';
	import Snowflake from '../motifs/Snowflake.svelte';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';

	const variants = ['primary', 'secondary', 'ghost', 'danger'] as const;
	let tab = $state('Databases');
</script>

<GuideSection id="primitives" title="Primitives and motifs" layer="Layer 5">
	<GuideRow label="Button variants">
		{#each variants as variant (variant)}
			<Button {variant}>{variant}</Button>
		{/each}
	</GuideRow>
	<GuideRow label="Button states: session size, icon, disabled, loading">
		<Button size="session" full>Check</Button>
		<Button variant="secondary">
			{#snippet icon()}<Icon icon={BookOpen} />{/snippet}
			Read first
		</Button>
		<Button disabled>Disabled</Button>
		<Button loading>Saving</Button>
	</GuideRow>
	<GuideRow label="Card, plain and with a course stripe">
		<Card>A plain card holds one group of content.</Card>
		<Card stripe="sage">Networking — 25 min planned</Card>
	</GuideRow>
	<GuideRow label="Chips and course tabs">
		<Chip>Neutral</Chip>
		<Chip color="lavender">Databases</Chip>
		<Chip color="peach">Networking</Chip>
		<Chip color="sky">OS</Chip>
		{#each ['Databases', 'Networking'] as name (name)}
			<Chip
				color={name === 'Databases' ? 'lavender' : 'peach'}
				selected={tab === name}
				onselect={() => (tab = name)}>{name}</Chip
			>
		{/each}
	</GuideRow>
	<GuideRow label="Input: empty, filled, first-letter hint">
		<Input label="Answer" placeholder="Type the term" />
		<Input label="Filled" value="TCP" />
		<Input label="First letter" hint="t" size="lg" />
	</GuideRow>
	<GuideRow label="Toggle and paw checkbox">
		<Toggle label="Haptics" checked />
		<Toggle label="Off" />
		<Toggle label="Disabled" disabled />
		<Checkbox checked>Names the three-way handshake</Checkbox>
		<Checkbox>Explains why the server sends SYN-ACK</Checkbox>
	</GuideRow>
	<GuideRow label="Icons (Lucide) and motifs">
		<Icon icon={Check} />
		<Icon icon={X} size="nav" label="Close" />
		<span class="motif"><Paw /></span>
		<span class="motif"><Snowflake /></span>
		<Moon />
	</GuideRow>
</GuideSection>

<style>
	.motif {
		color: var(--primary);
	}
</style>
