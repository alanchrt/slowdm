<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';

	let { data, form } = $props();
	let showCreate = $state(false);
	let editingId = $state<number | null>(null);
</script>

<svelte:head>
	<title>Policies - SlowDM</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Policies</h1>
		<Button onclick={() => (showCreate = !showCreate)}>
			{showCreate ? 'Cancel' : 'New Policy'}
		</Button>
	</div>

	{#if form?.error}
		<div class="rounded-md bg-red-50 p-3 text-sm text-red-600">{form.error}</div>
	{/if}
	{#if form?.success}
		<div class="rounded-md bg-green-50 p-3 text-sm text-green-700">Policy saved.</div>
	{/if}

	{#if showCreate}
		<Card>
			<h2 class="mb-4 text-lg font-semibold">Create Policy</h2>
			<form method="POST" action="?/create" class="space-y-4">
				<div>
					<label for="display_name" class="mb-1 block text-sm font-medium">Name</label>
					<Input type="text" name="display_name" id="display_name" placeholder="Bedtime" required oninput={(e) => {
						const slug = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
						const slugInput = e.currentTarget.form?.querySelector('[name=name]');
						if (slugInput) slugInput.value = slug;
					}} />
				</div>
				<div>
					<label for="name" class="mb-1 block text-sm font-medium">Slug</label>
					<Input type="text" name="name" id="name" placeholder="bedtime" required class="font-mono text-xs" />
				</div>

				<div class="flex flex-wrap gap-6">
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" name="backup_disabled" class="rounded" />
						Disable Backup & Restore
					</label>
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" name="tethering_disabled" class="rounded" />
						Disable Tethering/Hotspot
					</label>
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" name="wifi_config_disabled" class="rounded" />
						Lock WiFi Config
					</label>
				</div>

				<div>
					<label for="app_mode" class="mb-1 block text-sm font-medium">App Mode</label>
					<select name="app_mode" id="app_mode" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
						<option value="none">No restriction</option>
						<option value="allowlist">Allowlist</option>
						<option value="blocklist">Blocklist</option>
					</select>
				</div>

				<div>
					<label for="allowed_apps" class="mb-1 block text-sm font-medium">Allowed Apps (one package per line)</label>
					<textarea name="allowed_apps" id="allowed_apps" rows="3" class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs" placeholder="com.android.dialer"></textarea>
				</div>

				<div>
					<label for="blocked_apps" class="mb-1 block text-sm font-medium">Blocked Apps (one package per line)</label>
					<textarea name="blocked_apps" id="blocked_apps" rows="3" class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs" placeholder="com.example.app"></textarea>
				</div>

				<div>
					<label for="allowed_ssids" class="mb-1 block text-sm font-medium">Allowed WiFi SSIDs (one per line)</label>
					<textarea name="allowed_ssids" id="allowed_ssids" rows="2" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="HomeWiFi"></textarea>
				</div>

				<Button type="submit">Create Policy</Button>
			</form>
		</Card>
	{/if}

	{#each data.policies as policy}
		<Card>
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-lg font-semibold">{policy.displayName}</h3>
					<p class="font-mono text-xs text-muted-foreground">{policy.name}</p>
				</div>
				<div class="flex gap-2">
					<Button variant="secondary" size="sm" onclick={() => (editingId = editingId === policy.id ? null : policy.id)}>
						{editingId === policy.id ? 'Cancel' : 'Edit'}
					</Button>
					<form method="POST" action="?/delete" class="inline">
						<input type="hidden" name="id" value={policy.id} />
						<Button type="submit" variant="destructive" size="sm">Delete</Button>
					</form>
				</div>
			</div>

			<div class="mt-3 flex flex-wrap gap-2 text-xs">
				{#if policy.config.backupDisabled}
					<span class="rounded bg-red-100 px-2 py-1 text-red-700">Backup Disabled</span>
				{/if}
				{#if policy.config.tetheringDisabled}
					<span class="rounded bg-red-100 px-2 py-1 text-red-700">Hotspot Disabled</span>
				{/if}
				{#if policy.config.wifiConfigDisabled}
					<span class="rounded bg-red-100 px-2 py-1 text-red-700">WiFi Locked</span>
				{/if}
				{#if policy.config.appMode === 'allowlist'}
					<span class="rounded bg-blue-100 px-2 py-1 text-blue-700">Allowlist: {policy.config.allowedApps?.length ?? 0} apps</span>
				{:else if policy.config.appMode === 'blocklist'}
					<span class="rounded bg-yellow-100 px-2 py-1 text-yellow-700">Blocklist: {policy.config.blockedApps?.length ?? 0} apps</span>
				{:else}
					<span class="rounded bg-green-100 px-2 py-1 text-green-700">No app restrictions</span>
				{/if}
			</div>

			{#if editingId === policy.id}
				<form method="POST" action="?/update" class="mt-4 space-y-4 border-t border-border pt-4">
					<input type="hidden" name="id" value={policy.id} />
					<div>
						<label class="mb-1 block text-sm font-medium">Display Name</label>
						<Input type="text" name="display_name" value={policy.displayName} required />
					</div>
					<div class="flex flex-wrap gap-6">
						<label class="flex items-center gap-2 text-sm">
							<input type="checkbox" name="backup_disabled" checked={policy.config.backupDisabled} />
							Disable Backup & Restore
						</label>
						<label class="flex items-center gap-2 text-sm">
							<input type="checkbox" name="tethering_disabled" checked={policy.config.tetheringDisabled} />
							Disable Tethering
						</label>
						<label class="flex items-center gap-2 text-sm">
							<input type="checkbox" name="wifi_config_disabled" checked={policy.config.wifiConfigDisabled} />
							Lock WiFi
						</label>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium">App Mode</label>
						<select name="app_mode" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
							<option value="none" selected={policy.config.appMode === 'none'}>No restriction</option>
							<option value="allowlist" selected={policy.config.appMode === 'allowlist'}>Allowlist</option>
							<option value="blocklist" selected={policy.config.appMode === 'blocklist'}>Blocklist</option>
						</select>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium">Allowed Apps</label>
						<textarea name="allowed_apps" rows="3" class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs">{policy.config.allowedApps?.join('\n') ?? ''}</textarea>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium">Blocked Apps</label>
						<textarea name="blocked_apps" rows="3" class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs">{policy.config.blockedApps?.join('\n') ?? ''}</textarea>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium">Allowed SSIDs</label>
						<textarea name="allowed_ssids" rows="2" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{policy.config.allowedSsids?.join('\n') ?? ''}</textarea>
					</div>
					<Button type="submit">Save Changes</Button>
				</form>
			{/if}
		</Card>
	{/each}
</div>
