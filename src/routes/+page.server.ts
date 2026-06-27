import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { devices, policies, schedules } from '$lib/server/db/schema';
import { count } from 'drizzle-orm';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) {
		return { deviceCount: 0, policyCount: 0, scheduleCount: 0, recentDevices: [] };
	}

	const db = getDb(platform.env.DB);

	const [deviceResult, policyResult, scheduleResult, recentDevices] = await Promise.all([
		db.select({ count: count() }).from(devices),
		db.select({ count: count() }).from(policies),
		db.select({ count: count() }).from(schedules),
		db.select().from(devices).limit(5)
	]);

	return {
		deviceCount: deviceResult[0]?.count ?? 0,
		policyCount: policyResult[0]?.count ?? 0,
		scheduleCount: scheduleResult[0]?.count ?? 0,
		recentDevices
	};
};
