import { amapiRequest } from './client';

export type Enterprise = {
	name: string;
	enabledNotificationTypes?: string[];
};

export async function createEnterprise(
	saJson: string,
	projectId: string
): Promise<Enterprise> {
	const result = (await amapiRequest(
		saJson,
		'POST',
		`enterprises?projectId=${projectId}&enterpriseToken=`,
		{
			enabledNotificationTypes: ['ENROLLMENT', 'STATUS_REPORT', 'COMMAND']
		}
	)) as Enterprise;
	return result;
}

export async function getEnterprise(
	saJson: string,
	enterpriseName: string
): Promise<Enterprise> {
	return (await amapiRequest(saJson, 'GET', enterpriseName)) as Enterprise;
}
