import './src/background'; // Must be imported at top level to define the task
import { useEffect } from 'react';
import { AppState } from 'react-native';
import StatusScreen from './src/screens/StatusScreen';
import { performSync } from './src/sync';
import { registerBackgroundSync } from './src/background';

export default function App() {
  useEffect(() => {
    // Register background sync and run initial sync
    registerBackgroundSync().catch(console.error);
    performSync().catch(console.error);

    // Sync when app comes to foreground
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        performSync().catch(console.error);
      }
    });

    return () => subscription.remove();
  }, []);

  return <StatusScreen />;
}
