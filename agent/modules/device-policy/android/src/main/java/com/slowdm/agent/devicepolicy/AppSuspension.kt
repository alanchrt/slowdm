package com.slowdm.agent.devicepolicy

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/** Shared by manual sync, background sync, alarms, and boot recovery. */
internal object AppSuspension {
    private const val TARGETS_KEY = "suspension_targets"

    @Synchronized
    fun apply(context: Context, dpm: DevicePolicyManager, admin: ComponentName, config: JSONObject) {
        val prefs = context.getSharedPreferences("slowdm", Context.MODE_PRIVATE)
        val installed = context.packageManager.getInstalledPackages(0).map { it.packageName }.toSet()
        val allowed = packages(config.optJSONArray("allowedApps"))
        val blocked = packages(config.optJSONArray("blockedApps"))
        val critical = DevicePolicyModule.CRITICAL_PACKAGES + context.packageName
        val known = prefs.getStringSet(TARGETS_KEY, emptySet())!!.toSet() +
            installed + allowed + blocked + critical
        val desired = SuspensionReconciler.desired(
            config.optString("appMode", "none"), known, blocked, allowed, critical
        )

        // Persist before changing Android state: an interrupted sync must not lose
        // the packages it needs to release later. Never mutate a preference set.
        check(prefs.edit().putStringSet(TARGETS_KEY, known + desired).commit()) {
            "Could not persist app suspension targets"
        }
        val remaining = SuspensionReconciler.reconcile(known, desired) { targets, suspended ->
            val failed = dpm.setPackagesSuspended(admin, targets.toTypedArray(), suspended).toSet()
            if (failed.isNotEmpty()) {
                Log.w("SlowDMPolicy", "Could not ${if (suspended) "suspend" else "unsuspend"}: $failed")
            }
            failed
        }
        check(prefs.edit().putStringSet(TARGETS_KEY, remaining).commit()) {
            "Could not persist reconciled app suspension targets"
        }
    }

    private fun packages(array: JSONArray?): Set<String> =
        if (array == null) emptySet() else (0 until array.length()).map { array.getString(it) }.toSet()
}
