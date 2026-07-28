import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { policies } from '$lib/server/db/schema';
import { getSetting, setSetting } from '$lib/server/db/seed';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { timezone: '', defaultPolicy: '' };
	const db = getDb(platform.env.DB);

	const [timezone, defaultPolicy] = await Promise.all([
		getSetting(db, 'timezone'),
		getSetting(db, 'default_policy')
	]);

	return {
		timezone: timezone || 'America/New_York',
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

	logout: async ({ cookies }) => {
		cookies.delete('slowdm_session', { path: '/' });
		throw redirect(302, '/login');
	}
};
