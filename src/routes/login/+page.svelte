<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Card from '$lib/components/Card.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>Login - SlowDM</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background">
	<Card class="w-full max-w-sm">
		<h1 class="mb-6 text-center text-2xl font-bold">SlowDM</h1>
		<form method="POST" class="space-y-4">
			{#if form?.error}
				<div class="rounded-md bg-red-50 p-3 text-sm text-red-600">{form.error}</div>
			{/if}
			<div>
				<label for="password" class="mb-1 block text-sm font-medium">Password</label>
				<Input type="password" name="password" id="password" required autofocus />
			</div>
			<Button type="submit" class="w-full">Sign In</Button>
		</form>
	</Card>
</div>
