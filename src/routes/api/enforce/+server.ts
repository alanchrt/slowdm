import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getSetting } from '$lib/server/db/seed';
import { enforce } from '$lib/server/scheduler/enforce';

export const POST: RequestHandler = async ({ platform, locals }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });

	const db = getDb(platform.env.DB);
	const saJson =
		platform.env.GOOGLE_SERVICE_ACCOUNT_JSON || (await getSetting(db, 'service_account_json'));

	if (!saJson) return json({ error: 'AMAPI not configured' }, { status: 400 });

	try {
		await enforce(db, saJson);
		return json({ ok: true });
	} catch (e) {
		return json(
			{ error: e instanceof Error ? e.message : String(e) },
			{ status: 500 }
		);
	}
};
