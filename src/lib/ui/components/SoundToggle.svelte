<!--
	The sound mute button (WIP step 11; SESSION_NOTES §D7): a speaker in the study and Practice top
	bar. One tap mutes or unmutes; the choice is saved to `Settings.sounds` at once, so it holds on
	reload and matches the Sounds row in Settings. A 48 px target.
-->
<script lang="ts">
	import { Volume2, VolumeX } from '@lucide/svelte';
	import { prefs, savePreference } from '#lib/services/preferences.svelte.ts';
	import Button from '../primitives/Button.svelte';
	import Icon from '../primitives/Icon.svelte';

	const on = $derived(prefs.sounds);

	function toggle(): void {
		void savePreference({ sounds: !prefs.sounds });
	}
</script>

<Button
	variant="ghost"
	size="icon"
	onclick={toggle}
	aria-pressed={on}
	aria-label={on ? 'Sounds on' : 'Sounds off'}
	data-sound-toggle
>
	<Icon icon={on ? Volume2 : VolumeX} size="nav" />
</Button>
