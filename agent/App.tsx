import { useEffect } from 'react';
import { AppState } from 'react-native';
import StatusScreen from './src/screens/StatusScreen';
import { performSync } from './src/sync';

export default function App() {
  useEffect(() => {
    // Sync on app launch
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
