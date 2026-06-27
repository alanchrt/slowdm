import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSetting, setSetting, seedDefaults } from '$lib/server/db/seed';
import { testAuth, parseServiceAccount } from '$lib/server/amapi/client';
import { createSignupUrl, createEnterprise } from '$lib/server/amapi/enterprise';

export const load: PageServerLoad = async ({ platform, url }) => {
	if (!platform?.env?.DB) return { step: 1 };

	const db = getDb(platform.env.DB);
	const setupComplete = await getSetting(db, 'setup_complete');
	if (setupComplete) throw redirect(302, '/');

	// Handle enterprise signup callback from Google
	const enterpriseToken = url.searchParams.get('enterpriseToken');
	if (enterpriseToken) {
		const saJson = await getSetting(db, 'service_account_json');
		const signupUrlName = await getSetting(db, 'signup_url_name');
		if (saJson && signupUrlName) {
			try {
				const sa = parseServiceAccount(saJson);
				const enterprise = await createEnterprise(saJson, sa.project_id, signupUrlName, enterpriseToken);
				await setSetting(db, 'enterprise_name', enterprise.name);
				await setSetting(db, 'setup_step', '3');
				return { step: 3, enterpriseName: enterprise.name };
			} catch (e) {
				return { step: 2, error: `Failed to create enterprise: ${e instanceof Error ? e.message : String(e)}` };
			}
		}
	}

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

	'create-enterprise': async ({ platform, url }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'Platform not available' });

		const db = getDb(platform.env.DB);
		const saJson = await getSetting(db, 'service_account_json');
		if (!saJson) return fail(400, { error: 'Service account not configured' });

		try {
			const sa = parseServiceAccount(saJson);
			const callbackUrl = `${url.origin}/setup`;
			const signup = await createSignupUrl(saJson, sa.project_id, callbackUrl);
			await setSetting(db, 'signup_url_name', signup.name);
			// Redirect user to Google's enterprise signup page
			throw redirect(302, signup.url);
		} catch (e) {
			if (e instanceof Response || (e as any)?.status === 302) throw e;
			return fail(500, { error: `Failed to create signup URL: ${e instanceof Error ? e.message : String(e)}` });
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
