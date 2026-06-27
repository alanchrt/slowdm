declare global {
	namespace App {
		interface Locals {
			authenticated: boolean;
		}
		interface Platform {
			env: {
				DB: D1Database;
				AUTH_PASSWORD?: string;
				AUTH_SECRET?: string;
				CRON_SECRET?: string;
				GOOGLE_SERVICE_ACCOUNT_JSON?: string;
			};
			cf?: CfProperties;
			ctx?: ExecutionContext;
		}
	}
}

export {};
