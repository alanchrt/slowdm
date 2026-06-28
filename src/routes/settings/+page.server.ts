import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSetting, setSetting } from '$lib/server/db/seed';
import { enforce } from '$lib/server/scheduler/enforce';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { timezone: '', enterprise: '', defaultPolicy: '', cfConfigured: false, cfTeamName: '' };
	const db = getDb(platform.env.DB);

	const [timezone, enterprise, defaultPolicy, cfTeamName] = await Promise.all([
		getSetting(db, 'timezone'),
		getSetting(db, 'enterprise_name'),
		getSetting(db, 'default_policy'),
		getSetting(db, 'cf_team_name')
	]);

	return {
		timezone: timezone || 'America/New_York',
		enterprise: enterprise || '',
		defaultPolicy: defaultPolicy || 'unrestricted',
		cfConfigured: !!(platform.env.CF_API_TOKEN && platform.env.CF_ACCOUNT_ID),
		cfTeamName: cfTeamName || ''
	};
};

export const actions: Actions = {
	'update-settings': async ({ request, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const formData = await request.formData();
		const timezone = formData.get('timezone') as string;
		const defaultPolicy = formData.get('default_policy') as string;

		const db = getDb(platform.env.DB);
		if (timezone) await setSetting(db, 'timezone', timezone);
		if (defaultPolicy) await setSetting(db, 'default_policy', defaultPolicy);

		return { success: true };
	},

	'update-team-name': async ({ request, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const formData = await request.formData();
		const teamName = (formData.get('cf_team_name') as string)?.trim();

		if (!teamName) return fail(400, { error: 'Team name is required' });

		const db = getDb(platform.env.DB);
		await setSetting(db, 'cf_team_name', teamName);

		return { success: true };
	},

	'enforce-now': async ({ platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const db = getDb(platform.env.DB);
		const saJson =
			platform.env.GOOGLE_SERVICE_ACCOUNT_JSON || (await getSetting(db, 'service_account_json'));

		if (!saJson) return fail(400, { error: 'AMAPI not configured' });

		try {
			await enforce(db, saJson, platform.env.CF_API_TOKEN, platform.env.CF_ACCOUNT_ID);
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
