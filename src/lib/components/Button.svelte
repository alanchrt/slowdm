<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		children: Snippet;
	};

	let { variant = 'primary', size = 'md', children, class: className = '', ...rest }: Props = $props();

	const variants = {
		primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
		secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
		destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
		ghost: 'hover:bg-accent hover:text-accent-foreground'
	};

	const sizes = {
		sm: 'h-8 px-3 text-sm',
		md: 'h-10 px-4',
		lg: 'h-12 px-6 text-lg'
	};
</script>

<button
	class="inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 {variants[variant]} {sizes[size]} {className}"
	{...rest}
>
	{@render children()}
</button>
