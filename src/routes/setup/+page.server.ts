import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSetting, setSetting, seedDefaults } from '$lib/server/db/seed';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return {};

	const db = getDb(platform.env.DB);
	const setupComplete = await getSetting(db, 'setup_complete');
	if (setupComplete) throw redirect(302, '/');
};

export const actions: Actions = {
	'complete-setup': async ({ request, platform, cookies }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'Platform not available' });

		const formData = await request.formData();
		const timezone = formData.get('timezone') as string;

		if (!timezone) return fail(400, { error: 'Timezone is required' });

		const db = getDb(platform.env.DB);

		await setSetting(db, 'timezone', timezone);
		await seedDefaults(db);
		await setSetting(db, 'setup_complete', 'true');

		// Auto-login after setup
		if (platform.env.AUTH_PASSWORD) {
			const { createSessionCookie } = await import('$lib/server/auth');
			const cookieHeader = await createSessionCookie(platform);
			const [nameValue] = cookieHeader.split(';');
			const [, value] = nameValue.split('=');
			cookies.set('slowdm_session', value, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 7 * 24 * 60 * 60
			});
		}

		throw redirect(302, '/');
	}
};
