const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export async function cfRequest(
	apiToken: string,
	method: string,
	path: string,
	body?: unknown
): Promise<unknown> {
	const res = await fetch(`${CF_API_BASE}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json'
		},
		body: body ? JSON.stringify(body) : undefined
	});

	const data = (await res.json()) as { success: boolean; result: unknown; errors: { message: string }[] };

	if (!data.success) {
		const msg = data.errors?.map((e) => e.message).join(', ') || `HTTP ${res.status}`;
		throw new Error(`Cloudflare API error: ${msg}`);
	}

	return data.result;
}

export async function testCfToken(apiToken: string): Promise<{ id: string; name: string } | null> {
	try {
		const result = (await cfRequest(apiToken, 'GET', '/accounts?page=1&per_page=1')) as {
			id: string;
			name: string;
		}[];
		return result[0] ?? null;
	} catch {
		return null;
	}
}