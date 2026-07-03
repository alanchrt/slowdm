import type { ScheduleResponse, ScheduleEntry, PolicyConfig } from './api';

function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number);
  return { hours: h, minutes: m };
}

function timeToMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

function isTimeInRange(current: number, start: number, end: number): boolean {
  if (start <= end) {
    return current >= start && current < end;
  }
  // Overnight range (e.g., 22:00 - 06:00)
  return current >= start || current < end;
}

function getCurrentTimeInTz(timezone: string): { dayOfWeek: number; hours: number; minutes: number } {
  const now = new Date();
  const formatted = now.toLocaleString('en-US', {
    timeZone: timezone,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const parts = formatted.split(', ');
  const day = dayMap[parts[0]] ?? 0;
  const [h, m] = parts[1].split(':').map(Number);
  return { dayOfWeek: day, hours: h, minutes: m };
}

export type ActivePolicyResult = {
  policyName: string;
  config: PolicyConfig;
};

export function evaluateSchedules(data: ScheduleResponse): ActivePolicyResult {
  const active: { name: string; config: PolicyConfig; priority: number }[] = [];

  for (const schedule of data.schedules) {
    if (!schedule.enabled) continue;

    const { dayOfWeek, hours, minutes } = getCurrentTimeInTz(schedule.timezone);
    const currentMinutes = timeToMinutes(hours, minutes);
    const startMinutes = timeToMinutes(...Object.values(parseTime(schedule.startTime)) as [number, number]);
    const endMinutes = timeToMinutes(...Object.values(parseTime(schedule.endTime)) as [number, number]);

    const daysOfWeek = schedule.daysOfWeek;

    // Handle overnight carryover (e.g., schedule on Mon 22:00-06:00, currently Tue 03:00)
    const isOvernightCarryover =
      startMinutes > endMinutes &&
      currentMinutes < endMinutes &&
      daysOfWeek.includes((dayOfWeek + 6) % 7);

    if (
      (daysOfWeek.includes(dayOfWeek) && isTimeInRange(currentMinutes, startMinutes, endMinutes)) ||
      isOvernightCarryover
    ) {
      active.push({
        name: schedule.policy.name,
        config: schedule.policy.config,
        priority: schedule.priority,
      });
    }
  }

  if (active.length === 0) {
    return {
      policyName: data.defaultPolicy.name,
      config: data.defaultPolicy.config,
    };
  }

  active.sort((a, b) => b.priority - a.priority);
  return { policyName: active[0].name, config: active[0].config };
}

export type TransitionEvent = {
  timeMs: number;
  policyName: string;
  config: PolicyConfig;
};

/**
 * Calculate upcoming schedule transition times (next 24 hours).
 * Returns times when a schedule starts or ends, with the policy that should be active after that transition.
 */
export function getUpcomingTransitions(data: ScheduleResponse, lookAheadMs: number = 24 * 60 * 60 * 1000): TransitionEvent[] {
  const now = Date.now();
  const transitions: TransitionEvent[] = [];

  for (const schedule of data.schedules) {
    if (!schedule.enabled) continue;

    // Calculate next start and end times in the schedule's timezone
    const transitionTimes = getNextTransitionTimes(schedule, now, lookAheadMs);
    for (const t of transitionTimes) {
      // At each transition, re-evaluate which policy should be active
      // For simplicity, we'll store the schedule's policy for start transitions
      // and the default for end transitions — but the real evaluation happens on the device
      transitions.push({
        timeMs: t,
        policyName: schedule.policy.name,
        config: schedule.policy.config,
      });
    }
  }

  // Deduplicate by time and sort
  const uniqueTimes = [...new Set(transitions.map((t) => t.timeMs))].sort();
  return uniqueTimes.map((timeMs) => {
    // For each transition time, we'll just pick the highest priority
    const matching = transitions.filter((t) => t.timeMs === timeMs);
    matching.sort((a, b) => {
      const schedA = data.schedules.find((s) => s.policy.name === a.policyName);
      const schedB = data.schedules.find((s) => s.policy.name === b.policyName);
      return (schedB?.priority ?? 0) - (schedA?.priority ?? 0);
    });
    return matching[0];
  });
}

function getNextTransitionTimes(
  schedule: ScheduleEntry,
  nowMs: number,
  lookAheadMs: number
): number[] {
  const times: number[] = [];
  const end = nowMs + lookAheadMs;

  // Check each day in the look-ahead window
  for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
    const baseDate = new Date(nowMs + dayOffset * 24 * 60 * 60 * 1000);

    // Get the date in the schedule's timezone
    const dateStr = baseDate.toLocaleDateString('en-CA', { timeZone: schedule.timezone });
    const [year, month, day] = dateStr.split('-').map(Number);

    const dow = new Date(baseDate.toLocaleString('en-US', { timeZone: schedule.timezone })).getDay();
    if (!schedule.daysOfWeek.includes(dow)) continue;

    const start = parseTime(schedule.startTime);
    const endTime = parseTime(schedule.endTime);

    // Create Date objects in UTC offset by timezone
    // Use a simple approach: set the time in the target timezone
    const startDate = new Date(
      `${dateStr}T${schedule.startTime}:00`
    );
    const endDate = new Date(
      `${dateStr}T${schedule.endTime}:00`
    );

    // Adjust for timezone by getting the offset
    const tzOffset = getTimezoneOffsetMs(schedule.timezone, startDate);
    const startMs = startDate.getTime() - tzOffset;
    const endMs = endDate.getTime() - tzOffset;

    if (startMs > nowMs && startMs < end) times.push(startMs);
    if (endMs > nowMs && endMs < end) times.push(endMs);
  }

  return times;
}

function getTimezoneOffsetMs(timezone: string, date: Date): number {
  // Get the offset between UTC and the target timezone
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return tzDate.getTime() - utcDate.getTime();
}
