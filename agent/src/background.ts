// Background sync is handled natively via AlarmManager (SyncReceiver.kt).
// The periodic alarm is started when config loads (saveConfigAndStartSync)
// and restarted on boot (BootReceiver). No JS-level background task needed.
