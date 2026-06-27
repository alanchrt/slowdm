const COOKIE_NAME = 'slowdm_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function hmacSign(secret: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(secret: string, data: string, signature: string): Promise<boolean> {
	const expected = await hmacSign(secret, data);
	return expected === signature;
}

function getSecret(platform: App.Platform): string {
	return platform.env.AUTH_SECRET || platform.env.AUTH_PASSWORD || 'dev-secret-change-me';
}

export async function createSessionCookie(platform: App.Platform): Promise<string> {
	const secret = getSecret(platform);
	const expires = Date.now() + SESSION_DURATION_MS;
	const data = `session:${expires}`;
	const sig = await hmacSign(secret, data);
	const token = btoa(JSON.stringify({ data, sig }));
	return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_MS / 1000}`;
}

export async function validateSession(
	platform: App.Platform,
	cookies: { get(name: string): string | undefined }
): Promise<boolean> {
	const token = cookies.get(COOKIE_NAME);
	if (!token) return false;

	try {
		const { data, sig } = JSON.parse(atob(token));
		const secret = getSecret(platform);
		if (!(await hmacVerify(secret, data, sig))) return false;

		const expires = parseInt(data.split(':')[1]);
		return Date.now() < expires;
	} catch {
		return false;
	}
}

export function clearSessionCookie(): string {
	return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function checkPassword(platform: App.Platform, password: string): boolean {
	const stored = platform.env.AUTH_PASSWORD;
	if (!stored) return false;
	return stored === password;
}
