<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	let { data } = $props();
	let showDeleteConfirm = $state(false);
	let deleteConfirmText = $state('');
</script>

<svelte:head>
	<title>{data.device.name} - SlowDM</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<a href="/devices" class="text-muted-foreground hover:text-foreground">&larr; Devices</a>
		<h1 class="text-2xl font-bold">{data.device.name}</h1>
		<Badge variant={data.device.enrollmentStatus === 'enrolled' ? 'success' : 'warning'}>
			{data.device.enrollmentStatus}
		</Badge>
	</div>

	<Card>
		<h2 class="mb-4 text-lg font-semibold">Device Info</h2>
		<dl class="space-y-2 text-sm">
			<div class="flex justify-between">
				<dt class="text-muted-foreground">Current Policy</dt>
				<dd>{data.device.currentPolicyName ?? 'default'}</dd>
			</div>
			<div class="flex justify-between">
				<dt class="text-muted-foreground">Enrolled</dt>
				<dd>{new Date(data.device.createdAt).toLocaleDateString()}</dd>
			</div>
		</dl>
		<p class="mt-4 text-xs text-muted-foreground">
			Policy is determined by schedules. Create or edit schedules to change which policy applies.
		</p>
	</Card>

	<Card>
		<h2 class="mb-4 text-lg font-semibold text-destructive">Danger Zone</h2>
		{#if !showDeleteConfirm}
			<Button variant="destructive" onclick={() => (showDeleteConfirm = true)}>Remove Device</Button>
		{:else}
			<div class="space-y-3">
				<p class="text-sm text-muted-foreground">
					Type <strong>delete</strong> to confirm removing <strong>{data.device.name}</strong>.
				</p>
				<input
					type="text"
					placeholder="delete"
					bind:value={deleteConfirmText}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				/>
				<div class="flex gap-2">
					<form method="POST" action="?/delete-device">
						<Button type="submit" variant="destructive" disabled={deleteConfirmText.trim().toLowerCase() !== 'delete'}>
							Permanently Remove
						</Button>
					</form>
					<Button variant="secondary" onclick={() => { showDeleteConfirm = false; deleteConfirmText = ''; }}>
						Cancel
					</Button>
				</div>
			</div>
		{/if}
	</Card>
</div>
