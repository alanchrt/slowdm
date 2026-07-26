package com.slowdm.agent.devicepolicy

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "SlowDMBoot"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        Log.i(TAG, "Boot completed — re-applying last known policy and starting sync")

        val prefs = context.getSharedPreferences("slowdm", Context.MODE_PRIVATE)

        // Re-apply last known policy
        val lastPolicy = prefs.getString("last_policy_json", null)
        if (lastPolicy != null) {
            try {
                PolicyApplier.apply(context, lastPolicy)
                Log.i(TAG, "Policy re-applied after boot")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to re-apply policy after boot: ${e.message}", e)
            }
        }

        // Restart periodic sync alarm
        val config = prefs.getString("config", null)
        if (config != null) {
            SyncReceiver.schedulePeriodic(context)
            Log.i(TAG, "Sync alarm restarted after boot")
        }
    }
}
