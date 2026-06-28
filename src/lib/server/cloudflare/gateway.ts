import { cfRequest } from './api';

export type GatewayRule = {
	id?: string;
	name: string;
	description?: string;
	enabled: boolean;
	action: 'block' | 'allow';
	filters: string[];
	traffic: string;
	identity: string;
	rule_settings: Record<string, unknown>;
	precedence: number;
};

// Content category IDs from Cloudflare Gateway
// https://developers.cloudflare.com/cloudflare-one/policies/gateway/domain-categories/
export const DNS_CATEGORIES = {
	adult: { id: 1, label: 'Adult Content' },
	gambling: { id: 5, label: 'Gambling' },
	malware: { id: 32, label: 'Malware' },
	phishing: { id: 33, label: 'Phishing' },
	socialMedia: { id: 52, label: 'Social Media' },
	streaming: { id: 55, label: 'Streaming' },
	gaming: { id: 12, label: 'Gaming' },
	drugs: { id: 7, label: 'Drugs' },
	newMalware: { id: 83, label: 'New Malware' },
	spyware: { id: 84, label: 'Spyware' },
	cryptomining: { id: 85, label: 'Cryptomining' },
	doh: { id: 135, label: 'DNS over HTTPS (DoH)' }
} as const;

export type DnsCategoryKey = keyof typeof DNS_CATEGORIES;

function buildTrafficExpression(
	categories: DnsCategoryKey[],
	blockedDomains: string[]
): string {
	const parts: string[] = [];

	if (categories.length > 0) {
		const ids = categories.map((k) => DNS_CATEGORIES[k].id);
		parts.push(`any(dns.content_category[*] in {${ids.join(' ')}})`);
	}

	if (blockedDomains.length > 0) {
		const domainConditions = blockedDomains.map((d) => `dns.fqdn == "${d}" or dns.fqdn_regex == ".*\\\\.${d.replace(/\./g, '\\\\.')}$"`);
		parts.push(`(${domainConditions.join(' or ')})`);
	}

	return parts.join(' or ');
}

export async function createGatewayRule(
	apiToken: string,
	accountId: string,
	name: string,
	categories: DnsCategoryKey[],
	blockedDomains: string[],
	enabled: boolean,
	precedence: number
): Promise<GatewayRule> {
	const traffic = buildTrafficExpression(categories, blockedDomains);

	return (await cfRequest(apiToken, 'POST', `/accounts/${accountId}/gateway/rules`, {
		name,
		description: `Managed by SlowDM`,
		enabled,
		action: 'block',
		filters: ['dns'],
		traffic,
		identity: '',
		rule_settings: {
			block_page_enabled: false
		},
		precedence
	})) as GatewayRule;
}

export async function updateGatewayRule(
	apiToken: string,
	accountId: string,
	ruleId: string,
	updates: Partial<{
		name: string;
		enabled: boolean;
		traffic: string;
		categories: DnsCategoryKey[];
		blockedDomains: string[];
		precedence: number;
	}>
): Promise<GatewayRule> {
	const body: Record<string, unknown> = {};

	if (updates.name !== undefined) body.name = updates.name;
	if (updates.enabled !== undefined) body.enabled = updates.enabled;
	if (updates.precedence !== undefined) body.precedence = updates.precedence;

	if (updates.categories || updates.blockedDomains) {
		body.traffic = buildTrafficExpression(
			updates.categories ?? [],
			updates.blockedDomains ?? []
		);
	}

	if (updates.traffic) body.traffic = updates.traffic;

	return (await cfRequest(
		apiToken,
		'PUT',
		`/accounts/${accountId}/gateway/rules/${ruleId}`,
		body
	)) as GatewayRule;
}

export async function deleteGatewayRule(
	apiToken: string,
	accountId: string,
	ruleId: string
): Promise<void> {
	await cfRequest(apiToken, 'DELETE', `/accounts/${accountId}/gateway/rules/${ruleId}`);
}

export async function listGatewayRules(
	apiToken: string,
	accountId: string
): Promise<GatewayRule[]> {
	return (await cfRequest(apiToken, 'GET', `/accounts/${accountId}/gateway/rules`)) as GatewayRule[];
}

export async function enableRule(
	apiToken: string,
	accountId: string,
	ruleId: string,
	enabled: boolean
): Promise<void> {
	await cfRequest(apiToken, 'PATCH', `/accounts/${accountId}/gateway/rules/${ruleId}`, { enabled });
}
