import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { devices, policies, schedules } from '../db/schema';
import { getSetting } from '../db/seed';
import { assignPolicy } from '../amapi/enrollment';
import { pushPolicy as pushPolicyConfig } from '../amapi/policies';
import { syncGatewayRules } from '../cloudflare/sync';

function getCurrentTimeInTz(timezone: string): { dayOfWeek: number; hours: number; minutes: number } {
	const now = new Date();
	const formatted = now.toLocaleString('en-US', {
		timeZone: timezone,
		hour12: false,
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});

	const dayMap: Record<string, number> = {
		Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
	};

	const parts = formatted.split(', ');
	const day = dayMap[parts[0]] ?? 0;
	const [h, m] = parts[1].split(':').map(Number);
	return { dayOfWeek: day, hours: h, minutes: m };
}

function parseTime(time: string): { hours: number; minutes: number } {
	const [h, m] = time.split(':').map(Number);
	return { hours: h, minutes: m };
}

function timeToMinutes(hours: number, minutes: number): number {
	return hours * 60 + minutes;
}

function isTimeInRange(
	currentMinutes: number,
	startMinutes: number,
	endMinutes: number
): boolean {
	if (startMinutes <= endMinutes) {
		return currentMinutes >= startMinutes && currentMinutes < endMinutes;
	} else {
		return currentMinutes >= startMinutes || currentMinutes < endMinutes;
	}
}

type ActivePolicy = {
	policyName: string;
	priority: number;
};

export async function evaluateDevicePolicy(
	db: Db,
	deviceId: number,
	defaultTimezone: string
): Promise<string | null> {
	const allSchedules = await db
		.select()
		.from(schedules)
		.where(eq(schedules.enabled, true));

	const applicable = allSchedules.filter(
		(s) => s.deviceId === null || s.deviceId === deviceId
	);

	const activePolices: ActivePolicy[] = [];

	for (const schedule of applicable) {
		const tz = schedule.timezone || defaultTimezone;
		const { dayOfWeek, hours, minutes } = getCurrentTimeInTz(tz);
		const currentMinutes = timeToMinutes(hours, minutes);
		const startMinutes = timeToMinutes(...Object.values(parseTime(schedule.startTime)) as [number, number]);
		const endMinutes = timeToMinutes(...Object.values(parseTime(schedule.endTime)) as [number, number]);

		const daysOfWeek = schedule.daysOfWeek as number[];

		const isOvernightCarryover =
			startMinutes > endMinutes &&
			currentMinutes < endMinutes &&
			daysOfWeek.includes((dayOfWeek + 6) % 7);

		if (
			(daysOfWeek.includes(dayOfWeek) && isTimeInRange(currentMinutes, startMinutes, endMinutes)) ||
			isOvernightCarryover
		) {
			const policy = await db
				.select()
				.from(policies)
				.where(eq(policies.id, schedule.policyId))
				.limit(1);

			if (policy[0]) {
				activePolices.push({
					policyName: policy[0].name,
					priority: schedule.priority
				});
			}
		}
	}

	if (activePolices.length === 0) return null;

	activePolices.sort((a, b) => b.priority - a.priority);
	return activePolices[0].policyName;
}

export async function enforce(db: Db, saJson: string, cfApiToken?: string, cfAccountId?: string) {
	const enterprise = await getSetting(db, 'enterprise_name');
	if (!enterprise) return;

	const defaultTimezone = (await getSetting(db, 'timezone')) || 'America/New_York';
	const defaultPolicy = (await getSetting(db, 'default_policy')) || 'unrestricted';

	// Push all policies to AMAPI first
	const cfTeamName = (await getSetting(db, 'cf_team_name')) || undefined;
	const allPolicies = await db.select().from(policies);
	for (const policy of allPolicies) {
		try {
			await pushPolicyConfig(saJson, enterprise, policy.name, policy.config, cfTeamName);
		} catch (e) {
			console.error(`Failed to push policy ${policy.name}:`, e);
		}
	}

	// Evaluate and assign for each enrolled device
	const enrolledDevices = await db
		.select()
		.from(devices)
		.where(eq(devices.enrollmentStatus, 'enrolled'));

	// Track which policy is active (for Gateway sync)
	const activePolicyNames = new Set<string>();

	for (const device of enrolledDevices) {
		if (!device.amapiDeviceName) continue;

		const activePolicyName = (await evaluateDevicePolicy(db, device.id, defaultTimezone)) || defaultPolicy;
		activePolicyNames.add(activePolicyName);

		if (activePolicyName !== device.currentPolicyName) {
			try {
				await assignPolicy(saJson, device.amapiDeviceName, enterprise, activePolicyName);
				await db
					.update(devices)
					.set({ currentPolicyName: activePolicyName, updatedAt: new Date().toISOString() })
					.where(eq(devices.id, device.id));
				console.log(`Device ${device.name}: ${device.currentPolicyName} -> ${activePolicyName}`);
			} catch (e) {
				console.error(`Failed to assign policy for ${device.name}:`, e);
			}
		} else {
			activePolicyNames.add(device.currentPolicyName!);
		}
	}

	// Sync Gateway DNS rules — enable rules for active policies, disable others
	const apiToken = cfApiToken;
	const accountId = cfAccountId;

	if (apiToken && accountId) {
		try {
			await syncGatewayRules(db, apiToken, accountId, allPolicies, activePolicyNames);
		} catch (e) {
			console.error('Failed to sync Gateway rules:', e);
		}
	}
}
