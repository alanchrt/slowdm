import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const devices = sqliteTable('devices', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	amapiDeviceName: text('amapi_device_name'),
	enrollmentStatus: text('enrollment_status').notNull().default('pending'),
	currentPolicyName: text('current_policy_name'),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

export const policies = sqliteTable('policies', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	displayName: text('display_name').notNull(),
	config: text('config', { mode: 'json' }).notNull().$type<PolicyConfig>(),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

export const schedules = sqliteTable('schedules', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	policyId: integer('policy_id')
		.notNull()
		.references(() => policies.id),
	deviceId: integer('device_id').references(() => devices.id),
	daysOfWeek: text('days_of_week', { mode: 'json' }).notNull().$type<number[]>(),
	startTime: text('start_time').notNull(),
	endTime: text('end_time').notNull(),
	timezone: text('timezone').notNull().default('America/New_York'),
	priority: integer('priority').notNull().default(0),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export type PolicyConfig = {
	tetheringDisabled?: boolean;
	wifiConfigDisabled?: boolean;
	allowedSsids?: string[];
	appMode?: 'allowlist' | 'blocklist' | 'none';
	allowedApps?: string[];
	blockedApps?: string[];
};

export type Device = typeof devices.$inferSelect;
export type Policy = typeof policies.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type Setting = typeof settings.$inferSelect;
