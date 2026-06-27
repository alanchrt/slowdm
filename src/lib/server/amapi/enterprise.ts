import { amapiRequest } from './client';

export type Enterprise = {
	name: string;
	enabledNotificationTypes?: string[];
};

export type SignupUrl = {
	name: string;
	url: string;
};

export async function createSignupUrl(
	saJson: string,
	projectId: string,
	callbackUrl: string
): Promise<SignupUrl> {
	return (await amapiRequest(saJson, 'POST', `signupUrls?projectId=${projectId}&callbackUrl=${encodeURIComponent(callbackUrl)}`, {})) as SignupUrl;
}

export async function createEnterprise(
	saJson: string,
	projectId: string,
	signupUrlName: string,
	enterpriseToken: string
): Promise<Enterprise> {
	const result = (await amapiRequest(
		saJson,
		'POST',
		`enterprises?projectId=${projectId}&signupUrlName=${encodeURIComponent(signupUrlName)}&enterpriseToken=${encodeURIComponent(enterpriseToken)}`,
		{}
	)) as Enterprise;
	return result;
}

export async function getEnterprise(
	saJson: string,
	enterpriseName: string
): Promise<Enterprise> {
	return (await amapiRequest(saJson, 'GET', enterpriseName)) as Enterprise;
}
