<!--
	The TopBar's settings entry (DESIGN §7 TopBar: "icon-button slots either side (back, settings)"):
	a 44 px ghost icon button to `/settings`.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { Settings } from '@lucide/svelte';
	import Button from '../primitives/Button.svelte';
	import Icon from '../primitives/Icon.svelte';
</script>

<Button variant="ghost" size="icon" href={resolve('/settings')} aria-label="Settings">
	<Icon icon={Settings} />
</Button>
