<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Badge from '$lib/components/Badge.svelte';

	let { data, form } = $props();
	let showCreate = $state(false);

	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	function getPolicyName(id: number): string {
		return data.policies.find((p) => p.id === id)?.displayName ?? 'Unknown';
	}

	function getDeviceName(id: number | null): string {
		if (id === null) return 'All devices';
		return data.devices.find((d) => d.id === id)?.name ?? 'Unknown';
	}
</script>

<svelte:head>
	<title>Schedules - SlowDM</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Schedules</h1>
		<Button onclick={() => (showCreate = !showCreate)}>
			{showCreate ? 'Cancel' : 'New Schedule'}
		</Button>
	</div>

	{#if form?.error}
		<div class="rounded-md bg-red-50 p-3 text-sm text-red-600">{form.error}</div>
	{/if}

	{#if showCreate}
		<Card>
			<h2 class="mb-4 text-lg font-semibold">Create Schedule</h2>
			<form method="POST" action="?/create" class="space-y-4">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label for="policy_id" class="mb-1 block text-sm font-medium">Policy</label>
						<select name="policy_id" id="policy_id" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required>
							{#each data.policies as policy}
								<option value={policy.id}>{policy.displayName}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="device_id" class="mb-1 block text-sm font-medium">Device</label>
						<select name="device_id" id="device_id" class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
							<option value="">All devices</option>
							{#each data.devices as device}
								<option value={device.id}>{device.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<div>
					<span class="mb-2 block text-sm font-medium">Days of Week</span>
					<div class="flex flex-wrap gap-3">
						{#each dayNames as day, i}
							<label class="flex items-center gap-1.5 text-sm">
								<input type="checkbox" name="day_{i}" checked class="rounded" />
								{day}
							</label>
						{/each}
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div>
						<label for="start_time" class="mb-1 block text-sm font-medium">Start Time</label>
						<Input type="time" name="start_time" id="start_time" value="22:00" required />
					</div>
					<div>
						<label for="end_time" class="mb-1 block text-sm font-medium">End Time</label>
						<Input type="time" name="end_time" id="end_time" value="06:00" required />
					</div>
					<div>
						<label for="priority" class="mb-1 block text-sm font-medium">Priority</label>
						<Input type="number" name="priority" id="priority" value="0" />
					</div>
				</div>

				<div>
					<label for="timezone" class="mb-1 block text-sm font-medium">Timezone</label>
					<Input type="text" name="timezone" id="timezone" value={data.timezone} />
				</div>

				<Button type="submit">Create Schedule</Button>
			</form>
		</Card>
	{/if}

	{#if data.schedules.length === 0}
		<Card>
			<p class="text-center text-muted-foreground">No schedules configured.</p>
		</Card>
	{:else}
		{#each data.schedules as schedule}
			<Card>
				<div class="flex items-start justify-between">
					<div>
						<div class="flex items-center gap-2">
							<h3 class="font-semibold">{getPolicyName(schedule.policyId)}</h3>
							<Badge variant={schedule.enabled ? 'success' : 'default'}>
								{schedule.enabled ? 'Active' : 'Disabled'}
							</Badge>
						</div>
						<p class="mt-1 text-sm text-muted-foreground">
							{getDeviceName(schedule.deviceId)} &middot;
							{schedule.startTime} - {schedule.endTime} &middot;
							Priority {schedule.priority}
						</p>
						<div class="mt-2 flex gap-1">
							{#each dayNames as day, i}
								<span
									class="rounded px-1.5 py-0.5 text-xs {(schedule.daysOfWeek as number[]).includes(i)
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground'}"
								>
									{day}
								</span>
							{/each}
						</div>
					</div>
					<div class="flex gap-2">
						<form method="POST" action="?/toggle">
							<input type="hidden" name="id" value={schedule.id} />
							<input type="hidden" name="enabled" value={String(schedule.enabled)} />
							<Button type="submit" variant="secondary" size="sm">
								{schedule.enabled ? 'Disable' : 'Enable'}
							</Button>
						</form>
						<form method="POST" action="?/delete">
							<input type="hidden" name="id" value={schedule.id} />
							<Button type="submit" variant="destructive" size="sm">Delete</Button>
						</form>
					</div>
				</div>
			</Card>
		{/each}
	{/if}
</div>
