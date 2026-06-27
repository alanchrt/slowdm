import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession } from '$lib/server/auth';
import { getSetting } from '$lib/server/db/seed';
import { getDb } from '$lib/server/db';

const PUBLIC_PATHS = ['/login', '/setup'];

export const handle: Handle = async ({ event, resolve }) => {
	const platform = event.platform;

	// During development, platform may not be available
	if (!platform?.env?.DB) {
		event.locals.authenticated = false;
		return resolve(event);
	}

	const db = getDb(platform.env.DB);
	const setupComplete = await getSetting(db, 'setup_complete');

	// If setup not complete, redirect everything to /setup
	if (!setupComplete && !event.url.pathname.startsWith('/setup')) {
		throw redirect(302, '/setup');
	}

	// Check auth for non-public paths
	const isPublic = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));
	const authenticated = await validateSession(platform, event.cookies);
	event.locals.authenticated = authenticated;

	if (!isPublic && !authenticated) {
		throw redirect(302, '/login');
	}

	return resolve(event);
};
