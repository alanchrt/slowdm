import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { isDeviceOwner } from '../../modules/device-policy';
import { loadConfig, getLastSyncTime, getActivePolicy, getStoredSchedules } from '../api';
import { getUpcomingTransitions } from '../scheduler';
import { performSync } from '../sync';

export default function StatusScreen() {
  const [deviceOwner, setDeviceOwner] = useState<boolean | null>(null);
  const [currentPolicy, setCurrentPolicy] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [nextTransition, setNextTransition] = useState<string | null>(null);
  const [nextTransitionTime, setNextTransitionTime] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      setDeviceOwner(isDeviceOwner());
    } catch {
      setDeviceOwner(false);
    }

    const config = await loadConfig();
    setConfigLoaded(config !== null);

    const policy = await getActivePolicy();
    setCurrentPolicy(policy);

    const syncTime = await getLastSyncTime();
    setLastSync(syncTime);

    const schedules = await getStoredSchedules();
    if (schedules) {
      const transitions = getUpcomingTransitions(schedules);
      if (transitions.length > 0) {
        setNextTransition(transitions[0].policyName);
        setNextTransitionTime(new Date(transitions[0].timeMs).toLocaleTimeString());
      } else {
        setNextTransition(null);
        setNextTransitionTime(null);
      }
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    const result = await performSync();
    if (!result.success) {
      setError(result.error || 'Sync failed');
    }
    await refreshStatus();
    setSyncing(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="light" />
      <Text style={styles.title}>SlowDM Agent</Text>

      <View style={styles.card}>
        <StatusRow
          label="Device Owner"
          value={deviceOwner === null ? '...' : deviceOwner ? 'Active' : 'Not set'}
          ok={deviceOwner === true}
        />
        <StatusRow
          label="Config"
          value={configLoaded === null ? '...' : configLoaded ? 'Loaded' : 'Missing'}
          ok={configLoaded === true}
        />
        <StatusRow
          label="Current Policy"
          value={currentPolicy || 'None'}
          ok={currentPolicy !== null}
        />
        <StatusRow
          label="Last Sync"
          value={lastSync ? formatRelativeTime(lastSync) : 'Never'}
          ok={lastSync !== null}
        />
        {nextTransition && (
          <StatusRow
            label="Next Transition"
            value={`${nextTransition} at ${nextTransitionTime}`}
            ok={true}
          />
        )}
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, syncing && styles.buttonDisabled]}
        onPress={handleSync}
        disabled={syncing}
      >
        {syncing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sync Now</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, ok ? styles.dotGreen : styles.dotRed]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 24,
    paddingTop: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  dotGreen: {
    backgroundColor: '#22c55e',
  },
  dotRed: {
    backgroundColor: '#ef4444',
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: '#94a3b8',
  },
  value: {
    fontSize: 14,
    color: '#f8fafc',
    fontWeight: '500',
  },
  errorCard: {
    backgroundColor: '#450a0a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
