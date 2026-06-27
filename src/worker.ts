import { getDb } from '$lib/server/db';
import { enforce } from '$lib/server/scheduler/enforce';

// Cloudflare Cron Trigger handler
// This is merged with SvelteKit's worker entry by the adapter
export default {
	async scheduled(event: ScheduledEvent, env: App.Platform['env'], ctx: ExecutionContext) {
		const db = getDb(env.DB);
		const saJson = env.GOOGLE_SERVICE_ACCOUNT_JSON;
		if (!saJson) {
			console.error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
			return;
		}
		ctx.waitUntil(enforce(db, saJson));
	}
};
