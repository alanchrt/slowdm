package com.slowdm.agent.devicepolicy

import org.junit.Assert.assertEquals
import org.junit.Test

class SuspensionReconcilerTest {
    private val critical = setOf("agent")

    private fun transition(
        suspended: MutableSet<String>,
        mode: String,
        installed: Set<String>,
        blocked: Set<String> = emptySet(),
        allowed: Set<String> = emptySet(),
        remembered: Set<String> = suspended.toSet()
    ): Set<String> {
        val desired = SuspensionReconciler.desired(mode, installed + remembered + allowed + blocked, blocked, allowed, critical)
        return SuspensionReconciler.reconcile(remembered + installed + allowed + blocked, desired) { packages, suspend ->
            if (suspend) suspended.addAll(packages) else suspended.removeAll(packages)
            emptySet()
        }
    }

    @Test fun removingAnAppFromActiveBlocklistReleasesItEvenIfNotVisible() {
        val suspended = mutableSetOf("removed", "still-blocked")
        transition(suspended, "blocklist", setOf("agent"), setOf("still-blocked"))
        assertEquals(setOf("still-blocked"), suspended)
    }

    @Test fun switchingToAnotherBlocklistReplacesRestrictions() {
        val suspended = mutableSetOf("old")
        transition(suspended, "blocklist", setOf("new"), setOf("new"))
        assertEquals(setOf("new"), suspended)
    }

    @Test fun unrestrictedPolicyReleasesAllRememberedPackages() {
        val suspended = mutableSetOf("hidden")
        transition(suspended, "none", setOf("agent"))
        assertEquals(emptySet<String>(), suspended)
    }

    @Test fun allowlistReleasesExplicitlyAllowedInvisiblePackagesAndProtectsAgent() {
        val suspended = mutableSetOf("allowed", "agent")
        transition(suspended, "allowlist", setOf("other", "agent"), allowed = setOf("allowed"))
        assertEquals(setOf("other"), suspended)
    }

    @Test fun allowlistKeepsRememberedInvisibleAppsBlockedUnlessAllowed() {
        val suspended = mutableSetOf("hidden")
        transition(suspended, "allowlist", setOf("agent"))
        assertEquals(setOf("hidden"), suspended)
    }

    @Test fun criticalPackagesCannotBeBlocked() {
        val suspended = mutableSetOf<String>()
        transition(suspended, "blocklist", setOf("agent"), setOf("agent", "blocked"))
        assertEquals(setOf("blocked"), suspended)
    }

    @Test fun failedReleaseIsRetriedOnNextSync() {
        val remaining = SuspensionReconciler.reconcile(setOf("old"), emptySet()) { packages, _ -> packages }
        assertEquals(setOf("old"), remaining)
        val suspended = mutableSetOf("old")
        val next = transition(suspended, "none", emptySet(), remembered = remaining)
        assertEquals(emptySet<String>(), suspended)
        assertEquals(emptySet<String>(), next)
    }
}
