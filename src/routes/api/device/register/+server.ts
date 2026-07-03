import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { devices } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ platform, request }) => {
	const adminPassword = request.headers.get('X-Admin-Password');
	if (!adminPassword || !platform?.env?.AUTH_PASSWORD || adminPassword !== platform.env.AUTH_PASSWORD) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });

	const body = await request.json();
	const { name, deviceToken } = body;

	if (!name || !deviceToken) {
		return json({ error: 'name and deviceToken are required' }, { status: 400 });
	}

	const db = getDb(platform.env.DB);
	const result = await db.insert(devices).values({
		name,
		deviceToken,
		enrollmentStatus: 'enrolled'
	}).returning({ id: devices.id });

	return json({ deviceId: result[0].id });
};
