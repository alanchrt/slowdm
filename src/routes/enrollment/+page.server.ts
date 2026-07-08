import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { devices, policies } from '$lib/server/db/schema';

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

		if (!deviceName) return fail(400, { error: 'Device name is required' });

		const db = getDb(platform.env.DB);
		const deviceToken = crypto.randomUUID();

		const result = await db.insert(devices).values({
			name: deviceName,
			deviceToken,
			enrollmentStatus: 'enrolled'
		}).returning({ id: devices.id });

		const serverUrl = platform.env.PUBLIC_URL || '';

		return {
			success: true,
			deviceId: result[0].id,
			deviceName,
			deviceToken,
			serverUrl
		};
	}
};
