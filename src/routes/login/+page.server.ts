import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { checkPassword, createSessionCookie } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.authenticated) throw redirect(302, '/');
};

export const actions: Actions = {
	default: async ({ request, platform, cookies }) => {
		if (!platform) return fail(500, { error: 'Platform not available' });

		const formData = await request.formData();
		const password = formData.get('password') as string;

		if (!password || !checkPassword(platform, password)) {
			return fail(401, { error: 'Invalid password' });
		}

		const cookieHeader = await createSessionCookie(platform);
		// Parse the Set-Cookie header and set via SvelteKit cookies API
		const [nameValue] = cookieHeader.split(';');
		const [, value] = nameValue.split('=');
		cookies.set('slowdm_session', value, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 7 * 24 * 60 * 60
		});

		throw redirect(302, '/');
	}
};
