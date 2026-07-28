import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { devices, policies, schedules } from '../db/schema';
import { getSetting } from '../db/seed';

function getCurrentTimeInTz(timezone: string): { dayOfWeek: number; hours: number; minutes: number } {
	const now = new Date();
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		hour12: false,
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});

	const partsMap = Object.fromEntries(
		fmt.formatToParts(now).map((p) => [p.type, p.value])
	);

	const dayMap: Record<string, number> = {
		Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
	};

	return {
		dayOfWeek: dayMap[partsMap.weekday] ?? 0,
		hours: Number(partsMap.hour),
		minutes: Number(partsMap.minute)
	};
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

export async function enforce(db: Db) {
	const defaultTimezone = (await getSetting(db, 'timezone')) || 'America/New_York';
	const defaultPolicy = (await getSetting(db, 'default_policy')) || 'unrestricted';

	const enrolledDevices = await db
		.select()
		.from(devices)
		.where(eq(devices.enrollmentStatus, 'enrolled'));

	for (const device of enrolledDevices) {
		const activePolicyName = (await evaluateDevicePolicy(db, device.id, defaultTimezone)) || defaultPolicy;

		if (activePolicyName !== device.currentPolicyName) {
			await db
				.update(devices)
				.set({ currentPolicyName: activePolicyName, updatedAt: new Date().toISOString() })
				.where(eq(devices.id, device.id));
			console.log(`Device ${device.name}: ${device.currentPolicyName} -> ${activePolicyName}`);
		}
	}
}
