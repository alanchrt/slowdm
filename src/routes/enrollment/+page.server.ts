import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { devices, policies } from '$lib/server/db/schema';
import { getSetting } from '$lib/server/db/seed';
import { createEnrollmentToken } from '$lib/server/amapi/enrollment';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { policies: [] };
	const db = getDb(platform.env.DB);
	const allPolicies = await db.select().from(policies);
	return { policies: allPolicies };
};

export const actions: Actions = {
	enroll: async ({ request, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const formData = await request.formData();
		const deviceName = formData.get('device_name') as string;
		const policyName = formData.get('policy_name') as string;

		if (!deviceName) return fail(400, { error: 'Device name is required' });

		const db = getDb(platform.env.DB);
		const enterprise = await getSetting(db, 'enterprise_name');
		const saJson =
			platform.env.GOOGLE_SERVICE_ACCOUNT_JSON || (await getSetting(db, 'service_account_json'));

		if (!enterprise || !saJson) {
			return fail(400, { error: 'AMAPI not configured. Complete setup first.' });
		}

		try {
			const token = await createEnrollmentToken(saJson, enterprise, policyName || 'unrestricted');

			// Create device record
			await db.insert(devices).values({
				name: deviceName,
				enrollmentStatus: 'pending',
				currentPolicyName: policyName || 'unrestricted'
			});

			return {
				success: true,
				qrCode: token.qrCode,
				tokenValue: token.value,
				expiresAt: token.expirationTimestamp
			};
		} catch (e) {
			return fail(500, {
				error: `Failed to create enrollment token: ${e instanceof Error ? e.message : String(e)}`
			});
		}
	}
};
