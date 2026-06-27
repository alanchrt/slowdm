<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Enroll Device - SlowDM</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">Enroll Device</h1>

	{#if form?.error}
		<div class="rounded-md bg-red-50 p-3 text-sm text-red-600">{form.error}</div>
	{/if}

	{#if form?.success && form?.qrCode}
		<Card>
			<h2 class="mb-4 text-lg font-semibold">Scan QR Code</h2>
			<div class="space-y-4">
				<div class="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
					<ol class="list-inside list-decimal space-y-1">
						<li>Factory reset the Android device</li>
						<li>At the "Welcome" screen, tap the screen 6 times quickly</li>
						<li>Connect to WiFi when prompted</li>
						<li>Scan this QR code when the camera opens</li>
						<li>The device will automatically enroll and apply the policy</li>
					</ol>
				</div>
				<div class="flex justify-center">
					<img src="data:image/png;base64,{form.qrCode}" alt="Enrollment QR Code" class="max-w-xs" />
				</div>
				<p class="text-center text-xs text-muted-foreground">
					Expires: {form.expiresAt}
				</p>
			</div>
		</Card>
	{:else}
		<Card>
			<h2 class="mb-4 text-lg font-semibold">Generate Enrollment Token</h2>
			<form method="POST" action="?/enroll" class="space-y-4">
				<div>
					<label for="device_name" class="mb-1 block text-sm font-medium">Device Name</label>
					<Input
						type="text"
						name="device_name"
						id="device_name"
						placeholder="Kid's Phone"
						required
					/>
				</div>
				<div>
					<label for="policy_name" class="mb-1 block text-sm font-medium">Initial Policy</label>
					<select
						name="policy_name"
						id="policy_name"
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{#each data.policies as policy}
							<option value={policy.name}>{policy.displayName}</option>
						{/each}
					</select>
				</div>
				<Button type="submit">Generate QR Code</Button>
			</form>
		</Card>

		<Card>
			<h2 class="mb-4 text-lg font-semibold">Enrollment Instructions</h2>
			<div class="space-y-3 text-sm text-muted-foreground">
				<p><strong>Requirements:</strong> Android 6.0+ device, WiFi connection</p>
				<p><strong>Important:</strong> Enrolling a device requires a factory reset. Back up any data first.</p>
				<ol class="list-inside list-decimal space-y-2">
					<li>Generate an enrollment QR code above</li>
					<li>Factory reset the target Android device</li>
					<li>At the initial "Welcome" screen, tap 6 times rapidly on the screen</li>
					<li>The device will prompt you to connect to WiFi</li>
					<li>After connecting, a QR code scanner will appear</li>
					<li>Scan the QR code generated above</li>
					<li>The device will download the management profile and apply the selected policy</li>
				</ol>
			</div>
		</Card>
	{/if}
</div>
