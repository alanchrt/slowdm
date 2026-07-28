<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import TimezoneSelect from '$lib/components/TimezoneSelect.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>Setup - SlowDM</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
	<Card class="w-full max-w-2xl">
		<h1 class="mb-2 text-2xl font-bold">SlowDM Setup</h1>
		<p class="mb-6 text-muted-foreground">Configure your timezone to get started.</p>

		{#if form?.error}
			<div class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{form.error}</div>
		{/if}

		<form method="POST" action="?/complete-setup" class="space-y-4">
			<div>
				<label for="timezone" class="mb-1 block text-sm font-medium">Timezone</label>
				<TimezoneSelect />
			</div>
			<Button type="submit">Complete Setup</Button>
		</form>
	</Card>
</div>
