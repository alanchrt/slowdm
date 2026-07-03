import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { devices, policies } from '$lib/server/db/schema';
import { getSetting } from '$lib/server/db/seed';
import { assignPolicy } from '$lib/server/amapi/enrollment';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) throw error(500, 'DB not available');
	const db = getDb(platform.env.DB);

	const device = await db.select().from(devices).where(eq(devices.id, parseInt(params.id))).limit(1);
	if (!device[0]) throw error(404, 'Device not found');

	const allPolicies = await db.select().from(policies);

	return { device: device[0], policies: allPolicies };
};

export const actions: Actions = {
	'assign-policy': async ({ request, params, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const formData = await request.formData();
		const policyName = formData.get('policy_name') as string;
		const db = getDb(platform.env.DB);

		const device = await db.select().from(devices).where(eq(devices.id, parseInt(params.id))).limit(1);
		if (!device[0]) return fail(404, { error: 'Device not found' });

		const enterprise = await getSetting(db, 'enterprise_name');
		const saJson = platform.env.GOOGLE_SERVICE_ACCOUNT_JSON || await getSetting(db, 'service_account_json');

		if (enterprise && saJson && device[0].amapiDeviceName) {
			try {
				await assignPolicy(saJson, device[0].amapiDeviceName, enterprise, policyName);
			} catch (e) {
				return fail(500, { error: `AMAPI error: ${e instanceof Error ? e.message : String(e)}` });
			}
		}

		await db
			.update(devices)
			.set({ currentPolicyName: policyName, updatedAt: new Date().toISOString() })
			.where(eq(devices.id, parseInt(params.id)));

		return { success: true };
	},

	'delete-device': async ({ params, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });
		const db = getDb(platform.env.DB);
		await db.delete(devices).where(eq(devices.id, parseInt(params.id)));
		throw redirect(302, '/devices?deleted=1');
	}
};
