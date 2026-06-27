import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSetting, setSetting, seedDefaults } from '$lib/server/db/seed';
import { testAuth, parseServiceAccount } from '$lib/server/amapi/client';
import { createEnterprise } from '$lib/server/amapi/enterprise';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { step: 1 };

	const db = getDb(platform.env.DB);
	const setupComplete = await getSetting(db, 'setup_complete');
	if (setupComplete) throw redirect(302, '/');

	const currentStep = await getSetting(db, 'setup_step');
	return { step: parseInt(currentStep || '1') };
};

export const actions: Actions = {
	'test-credentials': async ({ request, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'Platform not available' });

		const formData = await request.formData();
		const saJson = formData.get('service_account_json') as string;

		if (!saJson) return fail(400, { error: 'Service account JSON is required' });

		try {
			parseServiceAccount(saJson);
		} catch {
			return fail(400, { error: 'Invalid JSON format' });
		}

		const valid = await testAuth(saJson);
		if (!valid) return fail(400, { error: 'Authentication failed. Check your service account credentials.' });

		const db = getDb(platform.env.DB);
		await setSetting(db, 'service_account_json', saJson);
		await setSetting(db, 'setup_step', '2');
		return { success: true, step: 2 };
	},

	'create-enterprise': async ({ platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'Platform not available' });

		const db = getDb(platform.env.DB);
		const saJson = await getSetting(db, 'service_account_json');
		if (!saJson) return fail(400, { error: 'Service account not configured' });

		try {
			const sa = parseServiceAccount(saJson);
			const enterprise = await createEnterprise(saJson, sa.project_id);
			await setSetting(db, 'enterprise_name', enterprise.name);
			await setSetting(db, 'setup_step', '3');
			return { success: true, step: 3, enterpriseName: enterprise.name };
		} catch (e) {
			return fail(500, { error: `Failed to create enterprise: ${e instanceof Error ? e.message : String(e)}` });
		}
	},

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
