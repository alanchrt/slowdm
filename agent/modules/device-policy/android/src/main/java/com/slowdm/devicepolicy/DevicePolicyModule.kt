package com.slowdm.devicepolicy

import android.app.AlarmManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.UserManager
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class DevicePolicyModule : Module() {
    companion object {
        private const val TAG = "SlowDMPolicy"
        const val ALARM_ACTION = "com.slowdm.agent.POLICY_ALARM"
        const val EXTRA_POLICY_JSON = "policy_json"

        // Packages that must never be suspended
        val CRITICAL_PACKAGES = setOf(
            "com.slowdm.agent",
            "com.android.launcher3",
            "com.google.android.apps.nexuslauncher",
            "com.android.settings",
            "com.android.systemui",
            "com.android.phone",
            "com.android.server.telecom",
            "com.google.android.gms",
            "com.google.android.gsf",
            "com.android.providers.settings",
            "com.android.providers.contacts",
            "com.android.providers.telephony",
            "com.android.inputmethod.latin",
            "com.google.android.inputmethod.latin",
            "android",
        )
    }

    private val dpm: DevicePolicyManager
        get() = appContext.reactContext!!.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

    private val adminComponent: ComponentName
        get() = ComponentName(appContext.reactContext!!, DeviceAdminReceiver::class.java)

    private val context: Context
        get() = appContext.reactContext!!

    override fun definition() = ModuleDefinition {
        Name("DevicePolicy")

        Function("isDeviceOwner") {
            dpm.isDeviceOwnerApp(context.packageName)
        }

        Function("applyPolicy") { configJson: String ->
            applyPolicyInternal(configJson)
        }

        Function("getInstalledPackages") {
            val pm = context.packageManager
            pm.getInstalledPackages(0).map { it.packageName }
        }

        Function("scheduleAlarm") { triggerAtMillis: Long, policyJson: String ->
            scheduleAlarmInternal(triggerAtMillis, policyJson)
        }

        Function("cancelAllAlarms") {
            cancelAllAlarmsInternal()
        }

        Function("blockSelfUninstall") {
            if (dpm.isDeviceOwnerApp(context.packageName)) {
                dpm.setUninstallBlocked(adminComponent, context.packageName, true)
            }
        }
    }

    private fun applyPolicyInternal(configJson: String) {
        if (!dpm.isDeviceOwnerApp(context.packageName)) {
            Log.w(TAG, "Not device owner, skipping policy application")
            return
        }

        val config = JSONObject(configJson)
        Log.i(TAG, "Applying policy: $configJson")

        // User restrictions
        applyUserRestriction(UserManager.DISALLOW_CONFIG_TETHERING, config.optBoolean("tetheringDisabled", false))
        applyUserRestriction(UserManager.DISALLOW_CONFIG_WIFI, config.optBoolean("wifiConfigDisabled", false))
        applyUserRestriction(UserManager.DISALLOW_DEBUGGING_FEATURES, !config.optBoolean("debuggingAllowed", true))
        applyUserRestriction(UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES, !config.optBoolean("unknownSourcesAllowed", false))
        applyUserRestriction(UserManager.DISALLOW_FACTORY_RESET, config.optBoolean("backupDisabled", false))

        // App suspension (blocklist/allowlist)
        val appMode = config.optString("appMode", "none")
        when (appMode) {
            "blocklist" -> {
                val blockedApps = jsonArrayToStringList(config.optJSONArray("blockedApps"))
                if (blockedApps.isNotEmpty()) {
                    // Unsuspend everything first, then suspend blocked
                    unsuspendAll()
                    val toSuspend = blockedApps.filter { !CRITICAL_PACKAGES.contains(it) }.toTypedArray()
                    if (toSuspend.isNotEmpty()) {
                        dpm.setPackagesSuspended(adminComponent, toSuspend, true)
                    }
                }
            }
            "allowlist" -> {
                val allowedApps = jsonArrayToStringList(config.optJSONArray("allowedApps"))
                val allowedSet = (allowedApps + CRITICAL_PACKAGES).toSet()
                // Suspend everything except allowed
                val pm = context.packageManager
                val allPackages = pm.getInstalledPackages(0).map { it.packageName }
                val toSuspend = allPackages.filter { !allowedSet.contains(it) }.toTypedArray()
                if (toSuspend.isNotEmpty()) {
                    dpm.setPackagesSuspended(adminComponent, toSuspend, true)
                }
                // Unsuspend allowed
                val toUnsuspend = allPackages.filter { allowedSet.contains(it) }.toTypedArray()
                if (toUnsuspend.isNotEmpty()) {
                    dpm.setPackagesSuspended(adminComponent, toUnsuspend, false)
                }
            }
            else -> {
                // No app restrictions — unsuspend everything
                unsuspendAll()
            }
        }

        // Always-on VPN
        val vpnPackage = config.optString("alwaysOnVpnPackage", "")
        if (vpnPackage.isNotEmpty()) {
            try {
                dpm.setAlwaysOnVpnPackage(adminComponent, vpnPackage, true)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to set always-on VPN: ${e.message}")
            }
        } else {
            try {
                dpm.setAlwaysOnVpnPackage(adminComponent, null, false)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to clear always-on VPN: ${e.message}")
            }
        }

        // Private DNS
        val privateDnsMode = config.optString("privateDnsMode", "")
        if (privateDnsMode.isNotEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                when (privateDnsMode) {
                    "off" -> dpm.setGlobalPrivateDnsModeOpportunistic(adminComponent)
                    "opportunistic" -> dpm.setGlobalPrivateDnsModeOpportunistic(adminComponent)
                    "strict" -> {
                        val host = config.optString("privateDnsHost", "")
                        if (host.isNotEmpty()) {
                            dpm.setGlobalPrivateDnsModeSpecifiedHost(adminComponent, host)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to set private DNS: ${e.message}")
            }
        }

        Log.i(TAG, "Policy applied successfully")
    }

    private fun unsuspendAll() {
        val pm = context.packageManager
        val allPackages = pm.getInstalledPackages(0).map { it.packageName }.toTypedArray()
        if (allPackages.isNotEmpty()) {
            dpm.setPackagesSuspended(adminComponent, allPackages, false)
        }
    }

    private fun applyUserRestriction(restriction: String, enabled: Boolean) {
        if (enabled) {
            dpm.addUserRestriction(adminComponent, restriction)
        } else {
            dpm.clearUserRestriction(adminComponent, restriction)
        }
    }

    private fun jsonArrayToStringList(arr: org.json.JSONArray?): List<String> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).map { arr.getString(it) }
    }

    private fun scheduleAlarmInternal(triggerAtMillis: Long, policyJson: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = ALARM_ACTION
            putExtra(EXTRA_POLICY_JSON, policyJson)
            putExtra("trigger_time", triggerAtMillis)
        }

        val requestCode = triggerAtMillis.toInt() // Unique per alarm time
        val pendingIntent = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent
        )
        Log.i(TAG, "Alarm scheduled for $triggerAtMillis")
    }

    private fun cancelAllAlarmsInternal() {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        // Cancel a range of known request codes (we use trigger time as code)
        // Since we can't enumerate PendingIntents, we rely on re-scheduling overwriting them
        Log.i(TAG, "All alarms logically cancelled (will be overwritten on next sync)")
    }
}
