import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { policies } from '$lib/server/db/schema';
import { getSetting, setSetting } from '$lib/server/db/seed';
import { enforce } from '$lib/server/scheduler/enforce';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { timezone: '', enterprise: '', defaultPolicy: '', cfConfigured: false, cfTeamName: '', dnsBlockCategories: [] as string[], dnsBlockedDomains: [] as string[], dnsAllowedDomains: [] as string[] };
	const db = getDb(platform.env.DB);

	const [timezone, enterprise, defaultPolicy, dnsBlockCategories, dnsBlockedDomains, dnsAllowedDomains] = await Promise.all([
		getSetting(db, 'timezone'),
		getSetting(db, 'enterprise_name'),
		getSetting(db, 'default_policy'),
		getSetting(db, 'dns_block_categories'),
		getSetting(db, 'dns_blocked_domains'),
		getSetting(db, 'dns_allowed_domains')
	]);

	return {
		timezone: timezone || 'America/New_York',
		enterprise: enterprise || '',
		defaultPolicy: defaultPolicy || 'unrestricted',
		cfConfigured: !!(platform.env.CF_API_TOKEN && platform.env.CF_ACCOUNT_ID),
		cfTeamName: platform.env.CF_TEAM_NAME || '',
		dnsBlockCategories: dnsBlockCategories ? JSON.parse(dnsBlockCategories) as string[] : [],
		dnsBlockedDomains: dnsBlockedDomains ? JSON.parse(dnsBlockedDomains) as string[] : [],
		dnsAllowedDomains: dnsAllowedDomains ? JSON.parse(dnsAllowedDomains) as string[] : []
	};
};

export const actions: Actions = {
	'update-settings': async ({ request, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const formData = await request.formData();
		const timezone = formData.get('timezone') as string;
		const defaultPolicy = formData.get('default_policy') as string;

		const db = getDb(platform.env.DB);

		if (defaultPolicy) {
			const policy = await db.select().from(policies).where(eq(policies.name, defaultPolicy)).limit(1);
			if (policy[0] && policy[0].config.debuggingAllowed === false) {
				return fail(400, { error: 'Default policy must allow debugging (ADB access)' });
			}
		}

		if (timezone) await setSetting(db, 'timezone', timezone);
		if (defaultPolicy) await setSetting(db, 'default_policy', defaultPolicy);

		return { success: true };
	},

	'update-dns': async ({ request, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const formData = await request.formData();
		const db = getDb(platform.env.DB);

		const categories = [
			'ads', 'adultThemes', 'businessEconomy', 'education', 'entertainment',
			'gambling', 'governmentPolitics', 'health', 'internetCommunication',
			'jobSearch', 'miscellaneous', 'questionableContent', 'realEstate',
			'religion', 'safeForKids', 'securityThreats', 'shopping',
			'societyLifestyle', 'sports', 'technology', 'travel', 'vehicles',
			'violence', 'weather', 'alwaysBlocked', 'securityRisks', 'cipa'
		].filter((cat) => formData.get(`dns_cat_${cat}`) === 'on');

		const blockedDomains = (formData.get('dns_blocked_domains') as string)
			?.split('\n')
			.map((s) => s.trim())
			.filter(Boolean) || [];

		const allowedDomains = (formData.get('dns_allowed_domains') as string)
			?.split('\n')
			.map((s) => s.trim())
			.filter(Boolean) || [];

		await Promise.all([
			setSetting(db, 'dns_block_categories', JSON.stringify(categories)),
			setSetting(db, 'dns_blocked_domains', JSON.stringify(blockedDomains)),
			setSetting(db, 'dns_allowed_domains', JSON.stringify(allowedDomains))
		]);

		return { success: true };
	},

	'enforce-now': async ({ platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const db = getDb(platform.env.DB);
		const saJson =
			platform.env.GOOGLE_SERVICE_ACCOUNT_JSON || (await getSetting(db, 'service_account_json')) || undefined;

		try {
			await enforce(db, saJson, platform.env.CF_API_TOKEN, platform.env.CF_ACCOUNT_ID, platform.env.CF_TEAM_NAME);
			return { enforced: true };
		} catch (e) {
			return fail(500, {
				error: `Enforcement failed: ${e instanceof Error ? e.message : String(e)}`
			});
		}
	},

	logout: async ({ cookies }) => {
		cookies.delete('slowdm_session', { path: '/' });
		throw redirect(302, '/login');
	}
};
