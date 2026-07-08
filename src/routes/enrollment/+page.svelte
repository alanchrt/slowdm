<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';

	let { data, form } = $props();
	let copied = $state('');

	function copy(text: string, label: string) {
		navigator.clipboard.writeText(text);
		copied = label;
		setTimeout(() => (copied = ''), 2000);
	}
</script>

<svelte:head>
	<title>Enroll Device - SlowDM</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">Enroll Device</h1>

	{#if form?.error}
		<div class="rounded-md bg-red-50 p-3 text-sm text-red-600">{form.error}</div>
	{/if}

	{#if form?.success}
		<Card>
			<h2 class="mb-4 text-lg font-semibold">Device Registered</h2>
			<div class="space-y-4">
				<div class="rounded-md bg-green-50 p-4 text-sm text-green-800">
					<strong>{form.deviceName}</strong> has been registered (ID #{form.deviceId}).
					Follow the steps below to finish setup.
				</div>

				<h3 class="font-medium">Option A: Automated setup</h3>
				<p class="text-sm text-muted-foreground">
					Run this from the SlowDM project directory on a computer with ADB:
				</p>
				<div class="relative">
					<pre class="overflow-x-auto rounded-md bg-muted p-3 text-sm"><code>node scripts/adb-setup.mjs \
  --server-url {form.serverUrl || 'https://your-server.example.com'} \
  --admin-password YOUR_PASSWORD \
  --name "{form.deviceName}"</code></pre>
				</div>
				<p class="text-xs text-muted-foreground">
					This will install the APK, set device owner, and write the config automatically.
					The device registered above won't be used — the script creates its own.
				</p>

				<div class="border-t pt-4">
					<h3 class="font-medium">Option B: Manual setup</h3>
					<p class="mb-3 text-sm text-muted-foreground">
						Use these credentials with the manual ADB commands below.
					</p>

					<div class="space-y-2 rounded-md bg-muted p-3 text-sm">
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground">Device ID:</span>
							<div class="flex items-center gap-2">
								<code class="font-mono">{form.deviceId}</code>
								<button
									class="text-xs text-blue-600 hover:underline"
									onclick={() => copy(String(form.deviceId), 'id')}
								>
									{copied === 'id' ? 'Copied' : 'Copy'}
								</button>
							</div>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground">Device Token:</span>
							<div class="flex items-center gap-2">
								<code class="select-all break-all font-mono text-xs">{form.deviceToken}</code>
								<button
									class="whitespace-nowrap text-xs text-blue-600 hover:underline"
									onclick={() => copy(form.deviceToken, 'token')}
								>
									{copied === 'token' ? 'Copied' : 'Copy'}
								</button>
							</div>
						</div>
					</div>

					<ol class="mt-4 list-inside list-decimal space-y-3 text-sm text-muted-foreground">
						<li>
							<strong>Factory reset</strong> the Android device. Do <em>not</em> add any Google account during setup.
						</li>
						<li>
							<strong>Enable USB debugging</strong> on the device
							(Settings &rarr; About &rarr; tap Build Number 7 times &rarr; Developer Options &rarr; USB Debugging).
						</li>
						<li>
							<strong>Connect via USB</strong> and verify:
							<pre class="mt-1 rounded bg-muted p-2"><code>adb devices</code></pre>
						</li>
						<li>
							<strong>Install the agent APK:</strong>
							<pre class="mt-1 rounded bg-muted p-2"><code>adb install agent/build/slowdm-agent.apk</code></pre>
						</li>
						<li>
							<strong>Set device owner:</strong>
							<pre class="mt-1 rounded bg-muted p-2"><code>adb shell dpm set-device-owner com.slowdm.agent/.devicepolicy.DeviceAdminReceiver</code></pre>
						</li>
						<li>
							<strong>Write config to device:</strong>
							<pre class="mt-1 rounded bg-muted p-2"><code>echo '{JSON.stringify({ serverUrl: form.serverUrl || 'https://your-server.example.com', deviceId: form.deviceId, deviceToken: form.deviceToken })}' &gt; /tmp/slowdm-config.json
adb push /tmp/slowdm-config.json /data/local/tmp/slowdm-config.json
adb shell cp /data/local/tmp/slowdm-config.json /data/data/com.slowdm.agent/files/config.json</code></pre>
						</li>
						<li>
							<strong>Exempt from battery optimization:</strong>
							<pre class="mt-1 rounded bg-muted p-2"><code>adb shell dumpsys deviceidle whitelist +com.slowdm.agent</code></pre>
						</li>
						<li>
							<strong>Launch the app:</strong>
							<pre class="mt-1 rounded bg-muted p-2"><code>adb shell am start -n com.slowdm.agent/.MainActivity</code></pre>
						</li>
					</ol>
				</div>
			</div>
		</Card>
	{:else}
		<Card>
			<h2 class="mb-4 text-lg font-semibold">Register Device</h2>
			<form method="POST" action="?/enroll" class="space-y-4">
				<div>
					<label for="device_name" class="mb-1 block text-sm font-medium">Device Name</label>
					<Input
						type="text"
						name="device_name"
						id="device_name"
						placeholder="pixel-9-pro"
						required
					/>
				</div>
				<Button type="submit">Register Device</Button>
			</form>
		</Card>

		<Card>
			<h2 class="mb-4 text-lg font-semibold">How It Works</h2>
			<div class="space-y-3 text-sm text-muted-foreground">
				<p>
					<strong>Requirements:</strong> Android 7.0+ device, USB cable, computer with ADB installed.
				</p>
				<p>
					<strong>Important:</strong> The device must be factory reset with no Google accounts added.
					Device Owner can only be set on a fresh device.
				</p>
				<ol class="list-inside list-decimal space-y-2">
					<li>Register the device above to get credentials</li>
					<li>Factory reset the target Android device</li>
					<li>Skip through setup <em>without</em> adding a Google account</li>
					<li>Enable USB debugging in Developer Options</li>
					<li>Connect to your computer and run the setup script (or follow manual steps)</li>
					<li>The agent app will sync schedules and enforce policies automatically</li>
				</ol>
				<p class="mt-2">
					<strong>After setup:</strong> The agent app runs as Device Owner — it can't be uninstalled,
					and restrictions persist across reboots. Schedules sync every 15 minutes, and policy
					transitions fire at exact times via AlarmManager.
				</p>
			</div>
		</Card>
	{/if}
</div>
