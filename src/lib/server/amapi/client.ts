const AMAPI_BASE = 'https://androidmanagement.googleapis.com/v1';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidmanagement';

type ServiceAccount = {
	client_email: string;
	private_key: string;
	project_id: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(data: Uint8Array): string {
	return btoa(String.fromCharCode(...data))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

async function createJwt(sa: ServiceAccount): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: 'RS256', typ: 'JWT' };
	const payload = {
		iss: sa.client_email,
		scope: SCOPE,
		aud: TOKEN_URL,
		iat: now,
		exp: now + 3600
	};

	const headerB64 = base64url(new TextEncoder().encode(JSON.stringify(header)));
	const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
	const unsigned = `${headerB64}.${payloadB64}`;

	// Import RSA private key
	const pemContents = sa.private_key
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\s/g, '');
	const keyData = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

	const key = await crypto.subtle.importKey(
		'pkcs8',
		keyData,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);

	const signature = new Uint8Array(
		await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
	);

	return `${unsigned}.${base64url(signature)}`;
}

export function parseServiceAccount(json: string): ServiceAccount {
	const sa = JSON.parse(json);
	if (!sa.client_email || !sa.private_key) {
		throw new Error('Invalid service account JSON: missing client_email or private_key');
	}
	return sa;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
	if (cachedToken && Date.now() < cachedToken.expiresAt) {
		return cachedToken.token;
	}

	const jwt = await createJwt(sa);
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt
		})
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Token exchange failed: ${res.status} ${text}`);
	}

	const data = (await res.json()) as { access_token: string; expires_in: number };
	cachedToken = {
		token: data.access_token,
		expiresAt: Date.now() + (data.expires_in - 60) * 1000
	};
	return cachedToken.token;
}

export async function amapiRequest(
	saJson: string,
	method: string,
	path: string,
	body?: unknown
): Promise<unknown> {
	const sa = parseServiceAccount(saJson);
	const token = await getAccessToken(sa);

	const url = path.startsWith('http') ? path : `${AMAPI_BASE}/${path}`;
	const res = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: body ? JSON.stringify(body) : undefined
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`AMAPI ${method} ${path}: ${res.status} ${text}`);
	}

	return res.json();
}

export async function testAuth(saJson: string): Promise<boolean> {
	try {
		const sa = parseServiceAccount(saJson);
		await getAccessToken(sa);
		return true;
	} catch {
		return false;
	}
}
