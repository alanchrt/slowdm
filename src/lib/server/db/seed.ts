import { eq } from 'drizzle-orm';
import type { Db } from './index';
import { policies, settings } from './schema';

export async function seedDefaults(db: Db) {
	const existing = await db.select().from(policies).limit(1);
	if (existing.length > 0) return;

	await db.insert(policies).values([
		{
			name: 'unrestricted',
			displayName: 'Unrestricted',
			config: {
				tetheringDisabled: false,
				wifiConfigDisabled: false,
				appMode: 'none'
			}
		},
		{
			name: 'bedtime',
			displayName: 'Bedtime',
			config: {
				tetheringDisabled: true,
				wifiConfigDisabled: true,
				appMode: 'allowlist',
				allowedApps: [
					'com.android.dialer',
					'com.android.contacts',
					'com.android.settings',
					'com.google.android.apps.messaging',
					'com.google.android.deskclock'
				]
			}
		}
	]);
}

export async function getSetting(db: Db, key: string): Promise<string | null> {
	const row = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
	return row[0]?.value ?? null;
}

export async function setSetting(db: Db, key: string, value: string) {
	await db
		.insert(settings)
		.values({ key, value })
		.onConflictDoUpdate({ target: settings.key, set: { value } });
}
