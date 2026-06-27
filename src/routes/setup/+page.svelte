<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Card from '$lib/components/Card.svelte';

	let { data, form } = $props();
	let step = $derived(form?.step ?? data.step);
</script>

<svelte:head>
	<title>Setup - SlowDM</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
	<Card class="w-full max-w-2xl">
		<h1 class="mb-2 text-2xl font-bold">SlowDM Setup</h1>
		<p class="mb-6 text-muted-foreground">Step {step} of 3</p>

		{#if form?.error}
			<div class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{form.error}</div>
		{/if}

		{#if step === 1}
			<div class="space-y-4">
				<div class="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
					<h3 class="mb-2 font-semibold">Prerequisites</h3>
					<ol class="list-inside list-decimal space-y-1">
						<li>Go to <strong>Google Cloud Console</strong> and create a new project</li>
						<li>Enable the <strong>Android Management API</strong></li>
						<li>Create a <strong>Service Account</strong> and grant it the <strong>Android Management User</strong> role</li>
						<li>Create a JSON key for the service account</li>
						<li>Paste the JSON key contents below</li>
					</ol>
				</div>

				<form method="POST" action="?/test-credentials" class="space-y-4">
					<div>
						<label for="sa-json" class="mb-1 block text-sm font-medium">Service Account JSON</label>
						<textarea
							name="service_account_json"
							id="sa-json"
							rows="8"
							class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
							placeholder='Paste the entire JSON key file contents here...'
							required
						></textarea>
					</div>
					<Button type="submit">Test & Continue</Button>
				</form>
			</div>
		{:else if step === 2}
			<div class="space-y-4">
				<p>Credentials verified. Now let's create your Android Enterprise.</p>
				<p class="text-sm text-muted-foreground">This creates a managed Google Play enterprise that will manage your devices.</p>

				<form method="POST" action="?/create-enterprise">
					<Button type="submit">Create Enterprise</Button>
				</form>
			</div>
		{:else if step === 3}
			<div class="space-y-4">
				{#if form?.enterpriseName}
					<div class="rounded-md bg-green-50 p-3 text-sm text-green-700">
						Enterprise created: <code>{form.enterpriseName}</code>
					</div>
				{/if}

				<p>Final step: configure your timezone and you're ready to go.</p>

				<form method="POST" action="?/complete-setup" class="space-y-4">
					<div>
						<label for="timezone" class="mb-1 block text-sm font-medium">Timezone</label>
						<Input
							type="text"
							name="timezone"
							id="timezone"
							value="America/New_York"
							placeholder="America/New_York"
							required
						/>
						<p class="mt-1 text-xs text-muted-foreground">IANA timezone (e.g. America/Chicago, Europe/London)</p>
					</div>
					<Button type="submit">Complete Setup</Button>
				</form>
			</div>
		{/if}
	</Card>
</div>
