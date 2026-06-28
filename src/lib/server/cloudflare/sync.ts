import type { Db } from '../db';
import { settings } from '../db/schema';
import { getSetting, setSetting } from '../db/seed';
import type { Policy } from '../db/schema';
import type { DnsCategoryKey } from './gateway';
import {
	createGatewayRule,
	updateGatewayRule,
	enableRule,
	listGatewayRules,
	deleteGatewayRule
} from './gateway';

const RULE_PREFIX = 'slowdm:';

function ruleNameForPolicy(policyName: string): string {
	return `${RULE_PREFIX}${policyName}`;
}

export async function syncGatewayRules(
	db: Db,
	apiToken: string,
	accountId: string,
	allPolicies: Policy[],
	activePolicyNames: Set<string>
) {
	// Get existing SlowDM-managed rules
	const existingRules = await listGatewayRules(apiToken, accountId);
	const slowdmRules = existingRules.filter((r) => r.name.startsWith(RULE_PREFIX));
	const rulesByName = new Map(slowdmRules.map((r) => [r.name, r]));

	for (const policy of allPolicies) {
		const config = policy.config;
		if (!config.dnsFilteringEnabled || !config.dnsBlockCategories?.length) {
			// No DNS filtering — delete rule if it exists
			const existing = rulesByName.get(ruleNameForPolicy(policy.name));
			if (existing?.id) {
				try {
					await deleteGatewayRule(apiToken, accountId, existing.id);
					console.log(`Gateway: deleted rule for ${policy.name}`);
				} catch (e) {
					console.error(`Gateway: failed to delete rule for ${policy.name}:`, e);
				}
			}
			continue;
		}

		const ruleName = ruleNameForPolicy(policy.name);
		const categories = config.dnsBlockCategories as DnsCategoryKey[];
		const blockedDomains = config.dnsBlockedDomains ?? [];
		const shouldBeEnabled = activePolicyNames.has(policy.name);
		const existing = rulesByName.get(ruleName);

		if (existing?.id) {
			// Update existing rule — sync enabled state
			if (existing.enabled !== shouldBeEnabled) {
				try {
					await enableRule(apiToken, accountId, existing.id, shouldBeEnabled);
					console.log(`Gateway: ${shouldBeEnabled ? 'enabled' : 'disabled'} ${policy.name}`);
				} catch (e) {
					console.error(`Gateway: failed to toggle rule for ${policy.name}:`, e);
				}
			}
		} else {
			// Create new rule
			try {
				await createGatewayRule(
					apiToken,
					accountId,
					ruleName,
					categories,
					blockedDomains,
					shouldBeEnabled,
					10000 + allPolicies.indexOf(policy)
				);
				console.log(`Gateway: created rule for ${policy.name} (${shouldBeEnabled ? 'enabled' : 'disabled'})`);
			} catch (e) {
				console.error(`Gateway: failed to create rule for ${policy.name}:`, e);
			}
		}
	}

	// Clean up rules for deleted policies
	const policyNames = new Set(allPolicies.map((p) => ruleNameForPolicy(p.name)));
	for (const rule of slowdmRules) {
		if (!policyNames.has(rule.name) && rule.id) {
			try {
				await deleteGatewayRule(apiToken, accountId, rule.id);
				console.log(`Gateway: cleaned up orphaned rule ${rule.name}`);
			} catch (e) {
				console.error(`Gateway: failed to clean up ${rule.name}:`, e);
			}
		}
	}
}
