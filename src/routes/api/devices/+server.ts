import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getSetting } from '$lib/server/db/seed';
import { listDevices } from '$lib/server/amapi/enrollment';

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });

	const db = getDb(platform.env.DB);
	const enterprise = await getSetting(db, 'enterprise_name');
	const saJson =
		platform.env.GOOGLE_SERVICE_ACCOUNT_JSON || (await getSetting(db, 'service_account_json'));

	if (!enterprise || !saJson) return json({ error: 'AMAPI not configured' }, { status: 400 });

	try {
		const devices = await listDevices(saJson, enterprise);
		return json({ count: devices.length, devices });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
