package com.slowdm.agent.devicepolicy

/** Reconcile against remembered targets as well as currently visible packages. */
internal object SuspensionReconciler {
    fun desired(
        mode: String,
        installed: Set<String>,
        blocked: Set<String>,
        allowed: Set<String>,
        critical: Set<String>
    ): Set<String> = when (mode) {
        "blocklist" -> blocked - critical
        "allowlist" -> installed - allowed - critical
        else -> emptySet()
    }

    // The callback returns packages Android could not change. Keep failed releases
    // in the ledger so the next sync retries rather than forgetting a restriction.
    fun reconcile(
        known: Set<String>,
        desired: Set<String>,
        setSuspended: (Set<String>, Boolean) -> Set<String>
    ): Set<String> {
        val release = known - desired
        val failedRelease = if (release.isEmpty()) emptySet() else setSuspended(release, false)
        if (desired.isNotEmpty()) setSuspended(desired, true)
        return desired + failedRelease
    }
}
