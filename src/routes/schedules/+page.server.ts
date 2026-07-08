import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { schedules, policies, devices } from '$lib/server/db/schema';
import { getSetting } from '$lib/server/db/seed';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { schedules: [], policies: [], devices: [], timezone: 'America/New_York' };
	const db = getDb(platform.env.DB);

	const [allSchedules, allPolicies, allDevices, timezone] = await Promise.all([
		db.select().from(schedules),
		db.select().from(policies),
		db.select().from(devices),
		getSetting(db, 'timezone')
	]);

	return {
		schedules: allSchedules,
		policies: allPolicies,
		devices: allDevices,
		timezone: timezone || 'America/New_York'
	};
};

export const actions: Actions = {
	create: async ({ request, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const formData = await request.formData();
		const policyId = parseInt(formData.get('policy_id') as string);
		const deviceId = formData.get('device_id') as string;
		const startTime = formData.get('start_time') as string;
		const endTime = formData.get('end_time') as string;
		const timezone = formData.get('timezone') as string;
		const priority = parseInt(formData.get('priority') as string) || 0;

		const daysOfWeek = [0, 1, 2, 3, 4, 5, 6].filter(
			(d) => formData.get(`day_${d}`) === 'on'
		);

		if (!startTime || !endTime || daysOfWeek.length === 0) {
			return fail(400, { error: 'Start time, end time, and at least one day are required' });
		}

		const db = getDb(platform.env.DB);

		// Enforce: schedules that block debugging can't span more than 23 hours
		const policy = await db.select().from(policies).where(eq(policies.id, policyId)).limit(1);
		if (policy[0] && policy[0].config.debuggingAllowed === false) {
			const [sh, sm] = startTime.split(':').map(Number);
			const [eh, em] = endTime.split(':').map(Number);
			let durationMin = (eh * 60 + em) - (sh * 60 + sm);
			if (durationMin <= 0) durationMin += 24 * 60; // overnight
			if (durationMin > 23 * 60) {
				return fail(400, {
					error: 'Schedules that block debugging cannot span more than 23 hours. You must leave at least 1 hour with ADB access.'
				});
			}
			if (daysOfWeek.length === 7 && durationMin === 23 * 60) {
				// 23h every day is fine — there's always a 1h gap
			}
		}

		await db.insert(schedules).values({
			policyId,
			deviceId: deviceId ? parseInt(deviceId) : null,
			daysOfWeek,
			startTime,
			endTime,
			timezone,
			priority
		});

		return { success: true };
	},

	toggle: async ({ request, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const enabled = formData.get('enabled') === 'true';

		const db = getDb(platform.env.DB);
		await db
			.update(schedules)
			.set({ enabled: !enabled, updatedAt: new Date().toISOString() })
			.where(eq(schedules.id, id));

		return { success: true };
	},

	delete: async ({ request, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const db = getDb(platform.env.DB);
		await db.delete(schedules).where(eq(schedules.id, id));
		return { success: true };
	}
};
