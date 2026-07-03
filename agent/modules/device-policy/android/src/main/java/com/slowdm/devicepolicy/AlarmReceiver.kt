package com.slowdm.devicepolicy

import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.UserManager
import android.util.Log
import org.json.JSONObject

class AlarmReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "SlowDMAlarm"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val policyJson = intent.getStringExtra(DevicePolicyModule.EXTRA_POLICY_JSON) ?: return
        Log.i(TAG, "Alarm fired, applying policy: $policyJson")

        try {
            PolicyApplier.apply(context, policyJson)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply policy from alarm: ${e.message}", e)
        }
    }
}
