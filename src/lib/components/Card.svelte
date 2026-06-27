<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children, class: className = '' }: { children: Snippet; class?: string } = $props();
</script>

<div class="rounded-lg border border-border bg-card p-6 shadow-sm {className}">
	{@render children()}
</div>
