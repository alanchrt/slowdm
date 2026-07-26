package com.slowdm.agent.devicepolicy

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class ConfigReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "SlowDMConfig"
        const val ACTION_SET_CONFIG = "com.slowdm.agent.SET_CONFIG"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_SET_CONFIG) return

        val config = intent.getStringExtra("config") ?: return
        Log.i(TAG, "Received config via broadcast")

        context.getSharedPreferences("slowdm", Context.MODE_PRIVATE)
            .edit()
            .putString("pending_config", config)
            .apply()

        Log.i(TAG, "Config saved to SharedPreferences")
    }
}
