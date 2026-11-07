<script lang="ts">
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/config/defaults.ts';
</script>

<main>
	<h1>{APP_NAME}</h1>
	<p><a href={resolve('/import')}>Import your first lecture</a></p>
</main>
