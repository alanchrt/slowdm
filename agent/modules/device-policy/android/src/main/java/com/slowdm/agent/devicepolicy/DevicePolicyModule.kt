package com.slowdm.agent.devicepolicy

import android.app.AlarmManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
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
                try {
                    dpm.setUninstallBlocked(adminComponent, context.packageName, true)
                } catch (e: SecurityException) {
                    Log.e(TAG, "blockSelfUninstall failed (component=${adminComponent.flattenToString()}): ${e.message}")
                }
            }
        }

        Function("readConfigFile") {
            // Read config from Android global settings (written by ADB setup script)
            val raw = android.provider.Settings.Global.getString(
                context.contentResolver, "slowdm_config"
            )
            // ADB shell escaping may leave literal backslashes before quotes
            val config = raw?.replace("\\\"", "\"")
            if (config != null && config.isNotEmpty()) config else null
        }

        Function("saveConfigAndStartSync") { configJson: String ->
            // Save config for native background sync
            context.getSharedPreferences("slowdm", Context.MODE_PRIVATE)
                .edit()
                .putString("config", configJson)
                .apply()
            // Start periodic AlarmManager sync
            SyncReceiver.schedulePeriodic(context)
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
                // Always unsuspend everything first — handles removals from blocklist
                unsuspendAll()
                val toSuspend = blockedApps.filter { !CRITICAL_PACKAGES.contains(it) }.toTypedArray()
                if (toSuspend.isNotEmpty()) {
                    dpm.setPackagesSuspended(adminComponent, toSuspend, true)
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
        // Lock Private DNS settings when a mode is explicitly set
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            applyUserRestriction(UserManager.DISALLOW_CONFIG_PRIVATE_DNS, privateDnsMode.isNotEmpty())
        }
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

        // Browser DoH
        val disableDoh = config.optBoolean("disableBrowserDoh", false)
        applyBrowserDohRestrictions(disableDoh)

        Log.i(TAG, "Policy applied successfully")
    }

    private val CHROMIUM_BROWSERS = listOf(
        "com.android.chrome",
        "com.brave.browser",
        "com.microsoft.emmx",
        "com.opera.browser",
        "com.vivaldi.browser"
    )

    private val FIREFOX_BROWSERS = listOf(
        "org.mozilla.firefox",
        "org.mozilla.fenix",
        "org.mozilla.focus"
    )

    private fun applyBrowserDohRestrictions(disable: Boolean) {
        // Chromium browsers: DnsOverHttpsMode = "off"
        for (pkg in CHROMIUM_BROWSERS) {
            try {
                if (disable) {
                    val restrictions = Bundle().apply {
                        putString("DnsOverHttpsMode", "off")
                    }
                    dpm.setApplicationRestrictions(adminComponent, pkg, restrictions)
                } else {
                    dpm.setApplicationRestrictions(adminComponent, pkg, Bundle())
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to set DoH restriction for $pkg: ${e.message}")
            }
        }

        // Firefox browsers: DNSOverHTTPS policy via managed config
        for (pkg in FIREFOX_BROWSERS) {
            try {
                if (disable) {
                    val restrictions = Bundle().apply {
                        val dnsPolicy = Bundle().apply {
                            putBoolean("Enabled", false)
                            putBoolean("Locked", true)
                        }
                        putBundle("DNSOverHTTPS", dnsPolicy)
                    }
                    dpm.setApplicationRestrictions(adminComponent, pkg, restrictions)
                } else {
                    dpm.setApplicationRestrictions(adminComponent, pkg, Bundle())
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to set DoH restriction for $pkg: ${e.message}")
            }
        }

        if (disable) {
            Log.i(TAG, "Browser DoH restrictions applied")
        } else {
            Log.i(TAG, "Browser DoH restrictions cleared")
        }
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
        }

        val requestCode = (triggerAtMillis % Int.MAX_VALUE).toInt()
        val pendingIntent = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent
        )

        // Track request code for cancellation
        val prefs = context.getSharedPreferences("slowdm", Context.MODE_PRIVATE)
        val codes = prefs.getStringSet("alarm_codes", mutableSetOf())!!.toMutableSet()
        codes.add(requestCode.toString())
        prefs.edit().putStringSet("alarm_codes", codes).apply()

        Log.i(TAG, "Alarm scheduled for $triggerAtMillis (code=$requestCode)")
    }

    private fun cancelAllAlarmsInternal() {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val prefs = context.getSharedPreferences("slowdm", Context.MODE_PRIVATE)
        val codes = prefs.getStringSet("alarm_codes", mutableSetOf())!!

        for (codeStr in codes) {
            val code = codeStr.toIntOrNull() ?: continue
            val intent = Intent(context, AlarmReceiver::class.java).apply {
                action = ALARM_ACTION
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context, code, intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent)
            }
        }

        prefs.edit().putStringSet("alarm_codes", mutableSetOf()).apply()
        Log.i(TAG, "Cancelled ${codes.size} transition alarms")
    }
}
