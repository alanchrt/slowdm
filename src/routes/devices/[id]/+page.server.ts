import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { devices } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) throw error(500, 'DB not available');
	const db = getDb(platform.env.DB);

	const device = await db.select().from(devices).where(eq(devices.id, parseInt(params.id))).limit(1);
	if (!device[0]) throw error(404, 'Device not found');

	return { device: device[0] };
};

export const actions: Actions = {
	'delete-device': async ({ params, platform }) => {
		if (!platform?.env?.DB) return fail(500, { error: 'DB not available' });
		const db = getDb(platform.env.DB);
		await db.delete(devices).where(eq(devices.id, parseInt(params.id)));
		throw redirect(302, '/devices?deleted=1');
	}
};
