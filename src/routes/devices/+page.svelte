<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import { page } from '$app/state';

	let { data } = $props();
</script>

<svelte:head>
	<title>Devices - SlowDM</title>
</svelte:head>

<div class="space-y-6">
	{#if page.url.searchParams.has('deleted')}
		<div class="rounded-md bg-green-50 p-3 text-sm text-green-700">Device removed.</div>
	{/if}

	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Devices</h1>
		<a href="/enrollment">
			<Button>Enroll Device</Button>
		</a>
	</div>

	{#if data.devices.length === 0}
		<Card>
			<p class="text-center text-muted-foreground">No devices enrolled yet.</p>
		</Card>
	{:else}
		<Card>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border text-left">
							<th class="pb-2 font-medium">Name</th>
							<th class="pb-2 font-medium">Status</th>
							<th class="pb-2 font-medium">Current Policy</th>
							<th class="pb-2 font-medium">Last Updated</th>
							<th class="pb-2 font-medium"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.devices as device}
							<tr class="border-b border-border">
								<td class="py-3 font-medium">{device.name}</td>
								<td class="py-3">
									<Badge variant={device.enrollmentStatus === 'enrolled' ? 'success' : 'warning'}>
										{device.enrollmentStatus}
									</Badge>
								</td>
								<td class="py-3">{device.currentPolicyName ?? 'none'}</td>
								<td class="py-3 text-muted-foreground">{new Date(device.updatedAt).toLocaleString()}</td>
								<td class="py-3">
									<a href="/devices/{device.id}" class="text-primary hover:underline">Manage</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	{/if}
</div>
