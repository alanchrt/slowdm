package com.slowdm.devicepolicy

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.UserManager
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

object PolicyApplier {
    private const val TAG = "SlowDMApplier"

    fun apply(context: Context, configJson: String) {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(context, DeviceAdminReceiver::class.java)

        if (!dpm.isDeviceOwnerApp(context.packageName)) {
            Log.w(TAG, "Not device owner, skipping")
            return
        }

        val config = JSONObject(configJson)

        // Save as last applied for boot recovery
        context.getSharedPreferences("slowdm", Context.MODE_PRIVATE)
            .edit()
            .putString("last_policy_json", configJson)
            .apply()

        // User restrictions
        setRestriction(dpm, admin, UserManager.DISALLOW_CONFIG_TETHERING, config.optBoolean("tetheringDisabled", false))
        setRestriction(dpm, admin, UserManager.DISALLOW_CONFIG_WIFI, config.optBoolean("wifiConfigDisabled", false))
        setRestriction(dpm, admin, UserManager.DISALLOW_DEBUGGING_FEATURES, !config.optBoolean("debuggingAllowed", true))
        setRestriction(dpm, admin, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES, !config.optBoolean("unknownSourcesAllowed", false))
        setRestriction(dpm, admin, UserManager.DISALLOW_FACTORY_RESET, config.optBoolean("backupDisabled", false))

        // App suspension
        val appMode = config.optString("appMode", "none")
        val pm = context.packageManager
        val allPackages = pm.getInstalledPackages(0).map { it.packageName }

        when (appMode) {
            "blocklist" -> {
                val blocked = jsonArrayToList(config.optJSONArray("blockedApps"))
                // Unsuspend all first
                dpm.setPackagesSuspended(admin, allPackages.toTypedArray(), false)
                val toSuspend = blocked.filter { !DevicePolicyModule.CRITICAL_PACKAGES.contains(it) }.toTypedArray()
                if (toSuspend.isNotEmpty()) {
                    dpm.setPackagesSuspended(admin, toSuspend, true)
                }
            }
            "allowlist" -> {
                val allowed = (jsonArrayToList(config.optJSONArray("allowedApps")) + DevicePolicyModule.CRITICAL_PACKAGES).toSet()
                val toSuspend = allPackages.filter { !allowed.contains(it) }.toTypedArray()
                val toUnsuspend = allPackages.filter { allowed.contains(it) }.toTypedArray()
                if (toSuspend.isNotEmpty()) dpm.setPackagesSuspended(admin, toSuspend, true)
                if (toUnsuspend.isNotEmpty()) dpm.setPackagesSuspended(admin, toUnsuspend, false)
            }
            else -> {
                dpm.setPackagesSuspended(admin, allPackages.toTypedArray(), false)
            }
        }

        // Always-on VPN
        val vpnPackage = config.optString("alwaysOnVpnPackage", "")
        try {
            if (vpnPackage.isNotEmpty()) {
                dpm.setAlwaysOnVpnPackage(admin, vpnPackage, true)
            } else {
                dpm.setAlwaysOnVpnPackage(admin, null, false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "VPN config failed: ${e.message}")
        }

        // Private DNS
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val dnsMode = config.optString("privateDnsMode", "")
            try {
                when (dnsMode) {
                    "strict" -> {
                        val host = config.optString("privateDnsHost", "")
                        if (host.isNotEmpty()) dpm.setGlobalPrivateDnsModeSpecifiedHost(admin, host)
                    }
                    "off", "opportunistic" -> dpm.setGlobalPrivateDnsModeOpportunistic(admin)
                }
            } catch (e: Exception) {
                Log.e(TAG, "DNS config failed: ${e.message}")
            }
        }

        Log.i(TAG, "Policy applied successfully")
    }

    private fun setRestriction(dpm: DevicePolicyManager, admin: ComponentName, restriction: String, enabled: Boolean) {
        if (enabled) dpm.addUserRestriction(admin, restriction)
        else dpm.clearUserRestriction(admin, restriction)
    }

    private fun jsonArrayToList(arr: JSONArray?): List<String> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).map { arr.getString(it) }
    }
}
