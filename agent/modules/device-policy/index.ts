import { requireNativeModule } from 'expo';

const DevicePolicyModule = requireNativeModule('DevicePolicy');

export function isDeviceOwner(): boolean {
  return DevicePolicyModule.isDeviceOwner();
}

export function applyPolicy(configJson: string): void {
  DevicePolicyModule.applyPolicy(configJson);
}

export function getInstalledPackages(): string[] {
  return DevicePolicyModule.getInstalledPackages();
}

export function scheduleAlarm(triggerAtMillis: number, policyJson: string): void {
  DevicePolicyModule.scheduleAlarm(triggerAtMillis, policyJson);
}

export function cancelAllAlarms(): void {
  DevicePolicyModule.cancelAllAlarms();
}

export function blockSelfUninstall(): void {
  DevicePolicyModule.blockSelfUninstall();
}
