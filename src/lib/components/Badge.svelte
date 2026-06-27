<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'default',
		children,
		class: className = ''
	}: { variant?: 'default' | 'success' | 'warning' | 'destructive'; children: Snippet; class?: string } = $props();

	const variants = {
		default: 'bg-secondary text-secondary-foreground',
		success: 'bg-green-100 text-green-800',
		warning: 'bg-yellow-100 text-yellow-800',
		destructive: 'bg-red-100 text-red-800'
	};
</script>

<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {variants[variant]} {className}">
	{@render children()}
</span>
