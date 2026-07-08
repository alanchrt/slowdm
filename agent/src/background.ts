import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { performSync } from './sync';

const BACKGROUND_SYNC_TASK = 'slowdm-background-sync';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const result = await performSync();
    console.log('Background sync:', result.success ? result.policyName : result.error);
    return result.success
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.Failed;
  } catch (e) {
    console.error('Background sync error:', e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
    console.warn('Background fetch is denied by the system');
    return;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  if (isRegistered) return;

  await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
    minimumInterval: 15 * 60, // 15 minutes (Android minimum)
    stopOnTerminate: false,
    startOnBoot: true,
  });

  console.log('Background sync registered');
}
