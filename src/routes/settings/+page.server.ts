import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSetting, setSetting } from '$lib/server/db/seed';
import { enforce } from '$lib/server/scheduler/enforce';
import { clearSessionCookie } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { timezone: '', enterprise: '', defaultPolicy: '' };
	const db = getDb(platform.env.DB);

	const [timezone, enterprise, defaultPolicy] = await Promise.all([
		getSetting(db, 'timezone'),
		getSetting(db, 'enterprise_name'),
		getSetting(db, 'default_policy')
	]);

	return {
		timezone: timezone || 'America/New_York',
		enterprise: enterprise || '',
		defaultPolicy: defaultPolicy || 'unrestricted'
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

	'enforce-now': async ({ platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const db = getDb(platform.env.DB);
		const saJson =
			platform.env.GOOGLE_SERVICE_ACCOUNT_JSON || (await getSetting(db, 'service_account_json'));

		if (!saJson) return fail(400, { error: 'AMAPI not configured' });

		try {
			await enforce(db, saJson);
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
