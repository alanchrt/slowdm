import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { devices } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { devices: [] };
	const db = getDb(platform.env.DB);
	const allDevices = await db.select().from(devices);
	return { devices: allDevices };
};
