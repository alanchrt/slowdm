<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';

	let { children, data } = $props();

	const navItems = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/devices', label: 'Devices' },
		{ href: '/policies', label: 'Policies' },
		{ href: '/schedules', label: 'Schedules' },
		{ href: '/enrollment', label: 'Enroll' },
		{ href: '/settings', label: 'Settings' }
	];
</script>

{#if data.authenticated}
	<div class="min-h-screen bg-background">
		<nav class="border-b border-border bg-card">
			<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
				<a href="/" class="text-lg font-bold text-foreground">SlowDM</a>
				<div class="flex gap-1">
					{#each navItems as item}
						<a
							href={item.href}
							class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
						>
							{item.label}
						</a>
					{/each}
				</div>
			</div>
		</nav>
		<main class="mx-auto max-w-6xl px-4 py-8">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}
