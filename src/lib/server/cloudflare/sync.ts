import type { Db } from '../db';
import { getSetting } from '../db/seed';
import type { DnsCategoryKey } from './gateway';
import {
	createGatewayRule,
	updateGatewayRule,
	listGatewayRules,
	deleteGatewayRule
} from './gateway';

const RULE_NAME = 'slowdm:dns-filter';

export async function syncGatewayRules(
	db: Db,
	apiToken: string,
	accountId: string
) {
	// Load DNS config from settings
	const [catJson, blockedJson, allowedJson] = await Promise.all([
		getSetting(db, 'dns_block_categories'),
		getSetting(db, 'dns_blocked_domains'),
		getSetting(db, 'dns_allowed_domains')
	]);

	const categories: DnsCategoryKey[] = catJson ? JSON.parse(catJson) : [];
	const blockedDomains: string[] = blockedJson ? JSON.parse(blockedJson) : [];

	// Get existing SlowDM-managed rules
	const existingRules = await listGatewayRules(apiToken, accountId);
	console.log(`Gateway: found ${existingRules.length} total rules: ${existingRules.map((r) => `${r.name}(${r.id})`).join(', ')}`);
	const slowdmRules = existingRules.filter((r) => r.name.startsWith('slowdm:'));
	const mainRule = slowdmRules.find((r) => r.name === RULE_NAME);

	// Clean up legacy per-policy rules (slowdm:* but not slowdm:dns-filter)
	for (const rule of slowdmRules) {
		if (rule.name !== RULE_NAME && rule.id) {
			try {
				await deleteGatewayRule(apiToken, accountId, rule.id);
				console.log(`Gateway: cleaned up legacy rule ${rule.name}`);
			} catch (e) {
				console.error(`Gateway: failed to clean up ${rule.name}:`, e);
			}
		}
	}

	// If no categories configured, delete rule and bail
	if (categories.length === 0 && blockedDomains.length === 0) {
		if (mainRule?.id) {
			try {
				await deleteGatewayRule(apiToken, accountId, mainRule.id);
				console.log('Gateway: deleted dns-filter rule (no categories configured)');
			} catch (e) {
				console.error('Gateway: failed to delete dns-filter rule:', e);
			}
		}
		return;
	}

	if (mainRule?.id) {
		// Update existing rule — sync enabled state and traffic expression
		try {
			await updateGatewayRule(apiToken, accountId, mainRule.id, {
				name: RULE_NAME,
				enabled: true,
				categories,
				blockedDomains,
				precedence: 14999
			});
			console.log(`Gateway: updated dns-filter (${true ? 'enabled' : 'disabled'})`);
		} catch (e) {
			console.error('Gateway: failed to update dns-filter rule:', e);
		}
	} else {
		// Create new rule
		try {
			await createGatewayRule(
				apiToken,
				accountId,
				RULE_NAME,
				categories,
				blockedDomains,
				true,
				14999
			);
			console.log(`Gateway: created dns-filter rule (${true ? 'enabled' : 'disabled'})`);
		} catch (e) {
			console.error('Gateway: failed to create dns-filter rule:', e);
		}
	}
}
