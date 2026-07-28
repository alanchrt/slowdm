<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import TimezoneSelect from '$lib/components/TimezoneSelect.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Settings - SlowDM</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">Settings</h1>

	{#if form?.error}
		<div class="rounded-md bg-red-50 p-3 text-sm text-red-600">{form.error}</div>
	{/if}
	{#if form?.success}
		<div class="rounded-md bg-green-50 p-3 text-sm text-green-700">Settings saved.</div>
	{/if}

	<Card>
		<h2 class="mb-4 text-lg font-semibold">General</h2>
		<form method="POST" action="?/update-settings" class="space-y-4">
			<div>
				<label for="timezone" class="mb-1 block text-sm font-medium">Timezone</label>
				<TimezoneSelect value={data.timezone} />
			</div>
			<div>
				<label for="default_policy" class="mb-1 block text-sm font-medium">Default Policy</label>
				<Input type="text" name="default_policy" id="default_policy" value={data.defaultPolicy} />
				<p class="mt-1 text-xs text-muted-foreground">Applied when no schedule is active</p>
			</div>
			<Button type="submit">Save</Button>
		</form>
	</Card>

	<Card>
		<h2 class="mb-4 text-lg font-semibold">Actions</h2>
		<form method="POST" action="?/logout">
			<Button type="submit" variant="destructive">Logout</Button>
		</form>
	</Card>
</div>
