<script lang="ts">
	let { value = '', name = 'timezone', id = 'timezone' }: { value?: string; name?: string; id?: string } = $props();

	const timezones = Intl.supportedValuesOf('timeZone');
	let detected = $state(value || '');

	$effect(() => {
		if (!detected) {
			detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
		}
	});
</script>

<select
	{name}
	{id}
	class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
	bind:value={detected}
>
	{#each timezones as tz}
		<option value={tz} selected={tz === detected}>{tz.replace(/_/g, ' ')}</option>
	{/each}
</select>
