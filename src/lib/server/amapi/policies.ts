import type { PolicyConfig } from '../db/schema';
import { amapiRequest } from './client';

type AmapiPolicy = Record<string, unknown>;

export function buildAmapiPolicy(config: PolicyConfig): AmapiPolicy {
	const policy: AmapiPolicy = {
		// Always allow system updates
		systemUpdate: { type: 'WINDOWED', startMinutes: 120, endMinutes: 300 },
		// Status bar always visible
		statusBarDisabled: false
	};

	// Backup enabled by default; only disable if explicitly set
	if (config.backupDisabled) {
		policy.advancedSecurityOverrides = {
			...(policy.advancedSecurityOverrides as Record<string, unknown>),
			googlePlayProtectVerifyApps: 'VERIFY_APPS_ENFORCED'
		};
		policy.backupDisabled = true;
	}

	if (config.debuggingAllowed) {
		policy.debuggingFeaturesAllowed = true;
	}

	if (config.unknownSourcesAllowed) {
		policy.advancedSecurityOverrides = {
			...(policy.advancedSecurityOverrides as Record<string, unknown>),
			untrustedAppsPolicy: 'ALLOW_INSTALL_DEVICE_WIDE'
		};
	}

	if (config.tetheringDisabled) {
		policy.tetheringConfigDisabled = true;
	}

	if (config.wifiConfigDisabled) {
		policy.wifiConfigDisabled = true;
	}

	if (config.allowedSsids && config.allowedSsids.length > 0) {
		policy.openNetworkConfiguration = {
			NetworkConfigurations: config.allowedSsids.map((ssid) => ({
				GUID: ssid,
				Name: ssid,
				Type: 'WiFi',
				WiFi: { SSID: ssid, Security: 'None' }
			}))
		};
	}

	if (config.appMode === 'allowlist' && config.allowedApps?.length) {
		policy.applications = config.allowedApps.map((pkg) => ({
			packageName: pkg,
			installType: 'FORCE_INSTALLED',
			defaultPermissionPolicy: 'GRANT'
		}));
		// Block everything else with kiosk-like restrictions
		policy.kioskCustomization = {
			powerButtonActions: 'POWER_BUTTON_AVAILABLE',
			statusBar: 'NOTIFICATIONS_AND_SYSTEM_INFO_ENABLED'
		};
	} else if (config.appMode === 'blocklist' && config.blockedApps?.length) {
		policy.applications = config.blockedApps.map((pkg) => ({
			packageName: pkg,
			installType: 'BLOCKED'
		}));
	}

	if (config.alwaysOnVpnPackage) {
		policy.alwaysOnVpnPackage = {
			packageName: config.alwaysOnVpnPackage,
			lockdownEnabled: true
		};
	}

	if (config.privateDnsMode === 'strict' && config.privateDnsHost) {
		policy.advancedSecurityOverrides = {
			...(policy.advancedSecurityOverrides as Record<string, unknown>),
			personalAppsThatCanReadWorkNotifications: [],
			commonCriteriaMode: 'COMMON_CRITERIA_MODE_DISABLED'
		};
		policy.privateDnsMode = {
			privateDnsMode: 'STRICT',
			privateDnsHost: config.privateDnsHost
		};
	} else if (config.privateDnsMode === 'off') {
		policy.privateDnsMode = { privateDnsMode: 'OFF' };
	}

	return policy;
}

export async function pushPolicy(
	saJson: string,
	enterprise: string,
	policyName: string,
	config: PolicyConfig
): Promise<unknown> {
	const amapiPolicy = buildAmapiPolicy(config);
	return amapiRequest(saJson, 'PATCH', `${enterprise}/policies/${policyName}`, amapiPolicy);
}
