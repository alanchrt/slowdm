package com.slowdm.devicepolicy

import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.UserManager
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "SlowDMAlarm"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == PolicyApplier.ACTION_SAFETY_REENABLE_ADB) {
            Log.w(TAG, "Safety alarm fired — re-enabling ADB after 23h limit")
            try {
                val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
                val admin = ComponentName(context, DeviceAdminReceiver::class.java)
                if (dpm.isDeviceOwnerApp(context.packageName)) {
                    dpm.clearUserRestriction(admin, UserManager.DISALLOW_DEBUGGING_FEATURES)
                    Log.i(TAG, "ADB re-enabled by safety alarm")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to re-enable ADB: ${e.message}", e)
            }
            return
        }

        val policyJson = intent.getStringExtra(DevicePolicyModule.EXTRA_POLICY_JSON) ?: return
        Log.i(TAG, "Alarm fired, applying policy: $policyJson")

        try {
            PolicyApplier.apply(context, policyJson)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply policy from alarm: ${e.message}", e)
        }
    }
}
