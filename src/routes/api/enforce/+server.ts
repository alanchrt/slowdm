import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { enforce } from '$lib/server/scheduler/enforce';

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	// Allow auth via session cookie or cron secret header
	const cronSecret = request.headers.get('X-Cron-Secret');
	const isCron =
		cronSecret && platform?.env?.CRON_SECRET && cronSecret === platform.env.CRON_SECRET;

	if (!locals.authenticated && !isCron) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });

	const db = getDb(platform.env.DB);

	try {
		await enforce(db);
		return json({ ok: true });
	} catch (e) {
		return json(
			{ error: e instanceof Error ? e.message : String(e) },
			{ status: 500 }
		);
	}
};
