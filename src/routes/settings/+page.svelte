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
	{#if form?.enforced}
		<div class="rounded-md bg-green-50 p-3 text-sm text-green-700">Enforcement complete.</div>
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
		<h2 class="mb-4 text-lg font-semibold">AMAPI</h2>
		<dl class="space-y-2 text-sm">
			<div class="flex justify-between">
				<dt class="text-muted-foreground">Enterprise</dt>
				<dd class="font-mono text-xs">{data.enterprise || 'Not configured'}</dd>
			</div>
		</dl>
	</Card>

	<Card>
		<h2 class="mb-4 text-lg font-semibold">Cloudflare Gateway</h2>

		{#if data.cfConfigured}
			<dl class="space-y-2 text-sm">
				<div class="flex justify-between">
					<dt class="text-muted-foreground">Status</dt>
					<dd class="text-green-600">Connected</dd>
				</div>
				{#if data.cfTeamName}
					<div class="flex justify-between">
						<dt class="text-muted-foreground">Team Name</dt>
						<dd class="font-mono text-xs">{data.cfTeamName}</dd>
					</div>
				{:else}
					<div class="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
						Team name not set. Run <code>npm run setup</code> again or: <code>npx wrangler secret put CF_TEAM_NAME</code>
					</div>
				{/if}
			</dl>
		{:else}
			<p class="mb-2 text-sm text-muted-foreground">
				Not configured. Run <code>npm run setup</code> and select "Enable DNS filtering" to configure Gateway.
			</p>
			<div class="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
				<p class="mb-1 font-medium">Before setup, you need to:</p>
				<ol class="list-inside list-decimal space-y-1">
					<li>Go to the <strong>Cloudflare Zero Trust dashboard</strong></li>
					<li>Click <strong>Get Started</strong> and select the <strong>Free plan</strong></li>
					<li>Choose a team name (this becomes your WARP org identifier)</li>
				</ol>
			</div>
		{/if}
	</Card>

	<Card>
		<h2 class="mb-4 text-lg font-semibold">Actions</h2>
		<div class="flex flex-wrap gap-3">
			<form method="POST" action="?/enforce-now">
				<Button type="submit" variant="secondary">Enforce Now</Button>
			</form>
			<form method="POST" action="?/logout">
				<Button type="submit" variant="destructive">Logout</Button>
			</form>
		</div>
	</Card>
</div>
