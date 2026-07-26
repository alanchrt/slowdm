import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { devices, schedules, policies } from '$lib/server/db/schema';
import { getSetting } from '$lib/server/db/seed';
import { eq, or, isNull } from 'drizzle-orm';

export const GET: RequestHandler = async ({ platform, request, params }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });

	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const token = auth.slice(7);

	const db = getDb(platform.env.DB);
	const deviceId = parseInt(params.deviceId);
	if (isNaN(deviceId)) return json({ error: 'Invalid device ID' }, { status: 400 });

	const device = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1);
	if (!device[0] || device[0].deviceToken !== token) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Get default policy
	const defaultPolicyName = (await getSetting(db, 'default_policy')) || 'unrestricted';
	const defaultPolicyRow = await db
		.select()
		.from(policies)
		.where(eq(policies.name, defaultPolicyName))
		.limit(1);

	// Get all schedules for this device (device-specific + global)
	const deviceSchedules = await db
		.select()
		.from(schedules)
		.where(
			or(eq(schedules.deviceId, deviceId), isNull(schedules.deviceId))
		);

	// Build response with full policy config for each schedule
	const schedulesWithPolicies = await Promise.all(
		deviceSchedules.filter((s) => s.enabled).map(async (s) => {
			const policy = await db
				.select()
				.from(policies)
				.where(eq(policies.id, s.policyId))
				.limit(1);

			return {
				id: s.id,
				daysOfWeek: s.daysOfWeek,
				startTime: s.startTime,
				endTime: s.endTime,
				timezone: s.timezone,
				priority: s.priority,
				enabled: s.enabled,
				policy: policy[0]
					? { name: policy[0].name, config: policy[0].config }
					: null
			};
		})
	);

	return json({
		defaultPolicy: defaultPolicyRow[0]
			? { name: defaultPolicyRow[0].name, config: defaultPolicyRow[0].config }
			: { name: 'unrestricted', config: {} },
		schedules: schedulesWithPolicies.filter((s) => s.policy !== null),
		syncedAt: new Date().toISOString()
	});
};
