<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Badge from '$lib/components/Badge.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Dashboard - SlowDM</title>
</svelte:head>

<div class="space-y-8">
	<h1 class="text-2xl font-bold">Dashboard</h1>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<Card>
			<div class="text-sm text-muted-foreground">Devices</div>
			<div class="mt-1 text-3xl font-bold">{data.deviceCount}</div>
		</Card>
		<Card>
			<div class="text-sm text-muted-foreground">Policies</div>
			<div class="mt-1 text-3xl font-bold">{data.policyCount}</div>
		</Card>
		<Card>
			<div class="text-sm text-muted-foreground">Schedules</div>
			<div class="mt-1 text-3xl font-bold">{data.scheduleCount}</div>
		</Card>
	</div>

	<Card>
		<h2 class="mb-4 text-lg font-semibold">Devices</h2>
		{#if data.recentDevices.length === 0}
			<p class="text-muted-foreground">No devices enrolled yet. <a href="/enrollment" class="text-primary underline">Enroll a device</a>.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border text-left">
							<th class="pb-2 font-medium">Name</th>
							<th class="pb-2 font-medium">Status</th>
							<th class="pb-2 font-medium">Current Policy</th>
						</tr>
					</thead>
					<tbody>
						{#each data.recentDevices as device}
							<tr class="border-b border-border">
								<td class="py-2">
									<a href="/devices/{device.id}" class="text-primary hover:underline">{device.name}</a>
								</td>
								<td class="py-2">
									<Badge variant={device.enrollmentStatus === 'enrolled' ? 'success' : 'warning'}>
										{device.enrollmentStatus}
									</Badge>
								</td>
								<td class="py-2">{device.currentPolicyName ?? 'none'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>
