import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { policies } from '$lib/server/db/schema';
import type { PolicyConfig } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { policies: [] };
	const db = getDb(platform.env.DB);
	const allPolicies = await db.select().from(policies);
	return { policies: allPolicies };
};

export const actions: Actions = {
	create: async ({ request, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const formData = await request.formData();
		const name = (formData.get('name') as string).toLowerCase().replace(/[^a-z0-9-]/g, '-');
		const displayName = formData.get('display_name') as string;

		if (!name || !displayName) return fail(400, { error: 'Name and display name are required' });

		const config: PolicyConfig = {
			backupDisabled: formData.get('backup_disabled') === 'on',
			debuggingAllowed: formData.get('debugging_allowed') === 'on',
			unknownSourcesAllowed: formData.get('unknown_sources_allowed') === 'on',
			tetheringDisabled: formData.get('tethering_disabled') === 'on',
			wifiConfigDisabled: formData.get('wifi_config_disabled') === 'on',
			appMode: (formData.get('app_mode') as PolicyConfig['appMode']) || 'none',
			allowedApps: (formData.get('allowed_apps') as string)
				?.split('\n')
				.map((s) => s.trim())
				.filter(Boolean) || [],
			blockedApps: (formData.get('blocked_apps') as string)
				?.split('\n')
				.map((s) => s.trim())
				.filter(Boolean) || [],
			allowedSsids: (formData.get('allowed_ssids') as string)
				?.split('\n')
				.map((s) => s.trim())
				.filter(Boolean) || [],
			alwaysOnVpnPackage: (formData.get('always_on_vpn_package') as string)?.trim() || undefined,
			privateDnsMode: (formData.get('private_dns_mode') as PolicyConfig['privateDnsMode']) || undefined,
			privateDnsHost: (formData.get('private_dns_host') as string)?.trim() || undefined
		};

		const db = getDb(platform.env.DB);

		try {
			await db.insert(policies).values({ name, displayName, config });
		} catch {
			return fail(400, { error: 'A policy with that name already exists' });
		}

		return { success: true };
	},

	update: async ({ request, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const displayName = formData.get('display_name') as string;

		const config: PolicyConfig = {
			backupDisabled: formData.get('backup_disabled') === 'on',
			debuggingAllowed: formData.get('debugging_allowed') === 'on',
			unknownSourcesAllowed: formData.get('unknown_sources_allowed') === 'on',
			tetheringDisabled: formData.get('tethering_disabled') === 'on',
			wifiConfigDisabled: formData.get('wifi_config_disabled') === 'on',
			appMode: (formData.get('app_mode') as PolicyConfig['appMode']) || 'none',
			allowedApps: (formData.get('allowed_apps') as string)
				?.split('\n')
				.map((s) => s.trim())
				.filter(Boolean) || [],
			blockedApps: (formData.get('blocked_apps') as string)
				?.split('\n')
				.map((s) => s.trim())
				.filter(Boolean) || [],
			allowedSsids: (formData.get('allowed_ssids') as string)
				?.split('\n')
				.map((s) => s.trim())
				.filter(Boolean) || [],
			alwaysOnVpnPackage: (formData.get('always_on_vpn_package') as string)?.trim() || undefined,
			privateDnsMode: (formData.get('private_dns_mode') as PolicyConfig['privateDnsMode']) || undefined,
			privateDnsHost: (formData.get('private_dns_host') as string)?.trim() || undefined
		};

		const db = getDb(platform.env.DB);
		await db
			.update(policies)
			.set({ displayName, config, updatedAt: new Date().toISOString() })
			.where(eq(policies.id, id));

		return { success: true };
	},

	delete: async ({ request, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const db = getDb(platform.env.DB);
		await db.delete(policies).where(eq(policies.id, id));
		return { success: true };
	}
};
