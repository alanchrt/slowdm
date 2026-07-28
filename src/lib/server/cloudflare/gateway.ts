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
// Top-level content category IDs from Cloudflare Gateway
// https://developers.cloudflare.com/cloudflare-one/policies/gateway/domain-categories/
// Blocking a top-level category blocks all its subcategories
export const DNS_CATEGORIES = {
	ads: { id: 1, label: 'Ads' },
	adultThemes: { id: 2, label: 'Adult Themes' },
	businessEconomy: { id: 3, label: 'Business & Economy' },
	education: { id: 6, label: 'Education' },
	entertainment: { id: 7, label: 'Entertainment' },
	gambling: { id: 8, label: 'Gambling' },
	governmentPolitics: { id: 9, label: 'Government & Politics' },
	health: { id: 10, label: 'Health' },
	internetCommunication: { id: 12, label: 'Internet Communication' },
	jobSearch: { id: 13, label: 'Job Search & Careers' },
	miscellaneous: { id: 15, label: 'Miscellaneous' },
	questionableContent: { id: 17, label: 'Questionable Content' },
	realEstate: { id: 18, label: 'Real Estate' },
	religion: { id: 19, label: 'Religion' },
	safeForKids: { id: 20, label: 'Safe for Kids' },
	securityThreats: { id: 21, label: 'Security Threats' },
	shopping: { id: 22, label: 'Shopping & Auctions' },
	societyLifestyle: { id: 24, label: 'Society & Lifestyle' },
	sports: { id: 25, label: 'Sports' },
	technology: { id: 26, label: 'Technology' },
	travel: { id: 27, label: 'Travel' },
	vehicles: { id: 28, label: 'Vehicles' },
	violence: { id: 29, label: 'Violence' },
	weather: { id: 30, label: 'Weather' },
	alwaysBlocked: { id: 31, label: 'Always Blocked' },
	securityRisks: { id: 32, label: 'Security Risks' },
	cipa: { id: 34, label: 'CIPA Filter' }
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
	updates: {
		name: string;
		enabled: boolean;
		categories: DnsCategoryKey[];
		blockedDomains: string[];
		precedence: number;
	}
): Promise<GatewayRule> {
	const traffic = buildTrafficExpression(updates.categories, updates.blockedDomains);

	return (await cfRequest(
		apiToken,
		'PUT',
		`/accounts/${accountId}/gateway/rules/${ruleId}`,
		{
			name: updates.name,
			description: 'Managed by SlowDM',
			enabled: updates.enabled,
			action: 'block',
			filters: ['dns'],
			traffic,
			identity: '',
			rule_settings: {
				block_page_enabled: false
			},
			precedence: updates.precedence
		}
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
