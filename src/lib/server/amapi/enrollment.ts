import { amapiRequest } from './client';

export type EnrollmentToken = {
	name: string;
	value: string;
	qrCode: string;
	expirationTimestamp: string;
};

export async function createEnrollmentToken(
	saJson: string,
	enterprise: string,
	policyName: string
): Promise<EnrollmentToken> {
	const result = (await amapiRequest(saJson, 'POST', `${enterprise}/enrollmentTokens`, {
		policyName: `${enterprise}/policies/${policyName}`,
		duration: '86400s',
		allowPersonalUsage: 'ALLOW_PERSONAL_USAGE_ON_ORGANIZATION_OWNED_DEVICE'
	})) as Record<string, string>;

	return {
		name: result.name,
		value: result.value,
		qrCode: result.qrCode,
		expirationTimestamp: result.expirationTimestamp
	};
}

export async function listDevices(
	saJson: string,
	enterprise: string
): Promise<Record<string, unknown>[]> {
	const result = (await amapiRequest(saJson, 'GET', `${enterprise}/devices`)) as {
		devices?: Record<string, unknown>[];
	};
	return result.devices ?? [];
}

export async function getDevice(
	saJson: string,
	deviceName: string
): Promise<Record<string, unknown>> {
	return (await amapiRequest(saJson, 'GET', deviceName)) as Record<string, unknown>;
}

export async function assignPolicy(
	saJson: string,
	deviceName: string,
	enterprise: string,
	policyName: string
): Promise<unknown> {
	return amapiRequest(saJson, 'PATCH', `${deviceName}?updateMask=policyName`, {
		policyName: `${enterprise}/policies/${policyName}`
	});
}
