package com.slowdm.agent.devicepolicy

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class SyncReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "SlowDMSync"
        const val ACTION_SYNC = "com.slowdm.agent.SYNC"
        private const val SYNC_REQUEST_CODE = 0x5900
        private const val SYNC_INTERVAL_MS = 15L * 60 * 1000 // 15 minutes

        fun schedulePeriodic(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, SyncReceiver::class.java).apply {
                action = ACTION_SYNC
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context, SYNC_REQUEST_CODE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val triggerAt = System.currentTimeMillis() + SYNC_INTERVAL_MS
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            Log.i(TAG, "Next sync alarm scheduled in 15 minutes")
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_SYNC) return
        Log.i(TAG, "Sync alarm fired")

        // Re-schedule next sync immediately
        schedulePeriodic(context)

        // Run sync in a background thread (onReceive runs on main thread)
        Thread {
            try {
                doSync(context)
            } catch (e: Exception) {
                Log.e(TAG, "Sync failed: ${e.message}", e)
            }
        }.start()
    }

    private fun doSync(context: Context) {
        val prefs = context.getSharedPreferences("slowdm", Context.MODE_PRIVATE)
        val configJson = prefs.getString("config", null)
        if (configJson == null) {
            Log.w(TAG, "No config stored, skipping sync")
            return
        }

        val config = JSONObject(configJson)
        val serverUrl = config.getString("serverUrl")
        val deviceId = config.getInt("deviceId")
        val deviceToken = config.getString("deviceToken")

        // Fetch schedules from server
        val url = URL("$serverUrl/api/device/$deviceId/schedules")
        val conn = url.openConnection() as HttpURLConnection
        conn.setRequestProperty("Authorization", "Bearer $deviceToken")
        conn.connectTimeout = 15000
        conn.readTimeout = 15000

        try {
            if (conn.responseCode != 200) {
                Log.e(TAG, "Server returned ${conn.responseCode}")
                return
            }

            val reader = BufferedReader(InputStreamReader(conn.inputStream))
            val response = reader.readText()
            reader.close()

            val data = JSONObject(response)

            // Store schedules for the JS layer
            prefs.edit().putString("schedules", response).apply()

            // Evaluate which policy should be active
            val policyConfig = evaluateActivePolicy(data)
            if (policyConfig != null) {
                PolicyApplier.apply(context, policyConfig.toString())
                Log.i(TAG, "Policy applied from background sync")
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun evaluateActivePolicy(data: JSONObject): JSONObject? {
        // Check active schedules
        val schedules = data.optJSONArray("schedules") ?: return getOverrideOrDefault(data)

        val now = System.currentTimeMillis()
        val calendar = java.util.Calendar.getInstance()
        var bestPolicy: JSONObject? = null
        var bestPriority = Int.MIN_VALUE

        for (i in 0 until schedules.length()) {
            val schedule = schedules.getJSONObject(i)
            if (!schedule.optBoolean("enabled", true)) continue

            val tz = java.util.TimeZone.getTimeZone(schedule.optString("timezone", "America/New_York"))
            calendar.timeZone = tz
            calendar.timeInMillis = now

            val dayOfWeek = calendar.get(java.util.Calendar.DAY_OF_WEEK) - 1 // 0=Sun
            val currentMinutes = calendar.get(java.util.Calendar.HOUR_OF_DAY) * 60 + calendar.get(java.util.Calendar.MINUTE)

            val daysArray = schedule.getJSONArray("daysOfWeek")
            val days = (0 until daysArray.length()).map { daysArray.getInt(it) }

            val (sh, sm) = schedule.getString("startTime").split(":").map { it.toInt() }
            val (eh, em) = schedule.getString("endTime").split(":").map { it.toInt() }
            val startMin = sh * 60 + sm
            val endMin = eh * 60 + em

            val inRange = if (startMin <= endMin) {
                currentMinutes in startMin until endMin
            } else {
                currentMinutes >= startMin || currentMinutes < endMin
            }

            val overnightCarryover = startMin > endMin &&
                    currentMinutes < endMin &&
                    days.contains((dayOfWeek + 6) % 7)

            if ((days.contains(dayOfWeek) && inRange) || overnightCarryover) {
                val priority = schedule.optInt("priority", 0)
                if (priority > bestPriority) {
                    bestPriority = priority
                    bestPolicy = schedule.getJSONObject("policy").getJSONObject("config")
                }
            }
        }

        if (bestPolicy != null) return bestPolicy
        return getOverrideOrDefault(data)
    }

    private fun getOverrideOrDefault(data: JSONObject): JSONObject? {
        val defaultPolicy = data.optJSONObject("defaultPolicy")
        return defaultPolicy?.optJSONObject("config")
    }
}
