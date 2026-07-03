import {
  loadConfig,
  fetchSchedules,
  getStoredSchedules,
  setActivePolicy,
  type ScheduleResponse,
} from './api';
import { evaluateSchedules, getUpcomingTransitions } from './scheduler';
import {
  applyPolicy,
  scheduleAlarm,
  cancelAllAlarms,
  blockSelfUninstall,
  isDeviceOwner,
} from '../modules/device-policy';

export type SyncResult = {
  success: boolean;
  policyName?: string;
  error?: string;
};

export async function performSync(): Promise<SyncResult> {
  try {
    const config = await loadConfig();
    if (!config) {
      return { success: false, error: 'No config found' };
    }

    // Block self-uninstall on every sync
    if (isDeviceOwner()) {
      blockSelfUninstall();
    }

    // Fetch schedules from server
    let data: ScheduleResponse;
    try {
      data = await fetchSchedules(config);
    } catch (e) {
      // If fetch fails, use cached schedules
      const cached = await getStoredSchedules();
      if (!cached) {
        return { success: false, error: `Sync failed and no cached data: ${e}` };
      }
      data = cached;
    }

    // Evaluate which policy should be active right now
    const active = evaluateSchedules(data);

    // Apply the policy via native module
    if (isDeviceOwner()) {
      applyPolicy(JSON.stringify(active.config));
    }

    await setActivePolicy(active.policyName);

    // Schedule alarms for upcoming transitions
    cancelAllAlarms();
    const transitions = getUpcomingTransitions(data);
    for (const transition of transitions) {
      scheduleAlarm(transition.timeMs, JSON.stringify(transition.config));
    }

    return { success: true, policyName: active.policyName };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
