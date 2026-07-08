import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

export type PolicyConfig = {
  backupDisabled?: boolean;
  debuggingAllowed?: boolean;
  unknownSourcesAllowed?: boolean;
  tetheringDisabled?: boolean;
  wifiConfigDisabled?: boolean;
  allowedSsids?: string[];
  appMode?: 'allowlist' | 'blocklist' | 'none';
  allowedApps?: string[];
  blockedApps?: string[];
  alwaysOnVpnPackage?: string;
  privateDnsMode?: 'off' | 'opportunistic' | 'strict';
  privateDnsHost?: string;
  dnsFilteringEnabled?: boolean;
  dnsBlockCategories?: string[];
  dnsBlockedDomains?: string[];
  dnsAllowedDomains?: string[];
};

export type ScheduleEntry = {
  id: number;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  timezone: string;
  priority: number;
  enabled: boolean;
  policy: { name: string; config: PolicyConfig };
};

export type ScheduleResponse = {
  defaultPolicy: { name: string; config: PolicyConfig };
  schedules: ScheduleEntry[];
  syncedAt: string;
};

export type AppConfig = {
  serverUrl: string;
  deviceId: number;
  deviceToken: string;
};

const CONFIG_EXTERNAL_PATH = `${FileSystem.cacheDirectory}../files/slowdm-config.json`;
const CONFIG_SDCARD_PATH = '/sdcard/Download/slowdm-config.json';
const STORAGE_KEY_CONFIG = 'slowdm_config';
const STORAGE_KEY_SCHEDULES = 'slowdm_schedules';
const STORAGE_KEY_LAST_SYNC = 'slowdm_last_sync';
const STORAGE_KEY_ACTIVE_POLICY = 'slowdm_active_policy';

export async function loadConfig(): Promise<AppConfig | null> {
  // First check AsyncStorage
  const stored = await AsyncStorage.getItem(STORAGE_KEY_CONFIG);
  if (stored) return JSON.parse(stored);

  // Check for config file pushed by ADB (try multiple locations)
  for (const configPath of [CONFIG_SDCARD_PATH, CONFIG_EXTERNAL_PATH]) {
    try {
      const info = await FileSystem.getInfoAsync(configPath);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(configPath);
        const config = JSON.parse(content);
        await AsyncStorage.setItem(STORAGE_KEY_CONFIG, content);
        await FileSystem.deleteAsync(configPath, { idempotent: true });
        return config;
      }
    } catch (e) {
      console.warn(`Failed to read config from ${configPath}:`, e);
    }
  }

  return null;
}

export async function fetchSchedules(config: AppConfig): Promise<ScheduleResponse> {
  const url = `${config.serverUrl}/api/device/${config.deviceId}/schedules`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.deviceToken}` },
  });

  if (!res.ok) {
    throw new Error(`Sync failed: ${res.status} ${res.statusText}`);
  }

  const data: ScheduleResponse = await res.json();

  await AsyncStorage.setItem(STORAGE_KEY_SCHEDULES, JSON.stringify(data));
  await AsyncStorage.setItem(STORAGE_KEY_LAST_SYNC, new Date().toISOString());

  return data;
}

export async function getStoredSchedules(): Promise<ScheduleResponse | null> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY_SCHEDULES);
  return stored ? JSON.parse(stored) : null;
}

export async function getLastSyncTime(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY_LAST_SYNC);
}

export async function setActivePolicy(name: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_POLICY, name);
}

export async function getActivePolicy(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY_ACTIVE_POLICY);
}
