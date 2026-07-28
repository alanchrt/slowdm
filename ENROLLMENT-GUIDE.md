# Enrolling a Device in SlowDM

This is a step-by-step guide for enrolling your Android device under SlowDM's agent-based management.

## The big picture

SlowDM uses an on-device agent to enforce policies. The agent syncs with the server every minute and applies the current policy locally. Schedules are evaluated server-side by a cron job that runs every 5 minutes.

- Policies control app restrictions, network settings, VPN, etc.
- The agent pulls its policy from the server on each sync
- You can unenroll by uninstalling the agent app

---

## Phase 1: Configure SlowDM policies

**Do this before enrolling.** You want policies ready so the device enrolls into a known-good state.

### Create a permissive "developer" policy

In SlowDM (your deployed instance), go to **Policies** and create a new policy:

- **Name**: Developer
- **Slug**: developer
- **Allow Developer/Debugging**: checked
- **Allow Unknown Sources**: checked
- **Disable Backup & Restore**: unchecked (leave backup enabled)
- **Disable Tethering/Hotspot**: unchecked
- **Lock WiFi Config**: unchecked
- **App Mode**: No restriction
- **Always-On VPN**: leave empty for now
- **Private DNS**: Default

This gives you a fully permissive policy -- the phone behaves almost normally, but is managed. You can tighten restrictions later once you've confirmed everything works.

---

## Phase 2: Enroll the device

1. Go to **Enrollment** in SlowDM
2. Device name: "Pixel 9 Pro" (or whatever you want)
3. Click "Enroll"
4. You'll receive a **device token** and **server URL**
5. Install the SlowDM agent app on the device
6. Enter the server URL and device token in the agent app
7. The agent will sync and apply the current policy

---

## After successful enrollment

Once the device is enrolled and working with the permissive developer policy:

1. **Verify basic functionality**: Make calls, send texts, use WiFi, open browser, install an app from Play Store
2. **Test policy changes**: In SlowDM, edit the developer policy to toggle a restriction (e.g., disable tethering), wait for the next sync cycle (~1 minute), and verify it takes effect on the device
3. **Gradually tighten**: Once you're confident, create your actual policies (bedtime, etc.) and schedules

---

## Quick reference: Troubleshooting

| Situation | Fix |
|---|---|
| Policy not applying | Wait for next agent sync (~1 minute) or trigger manual sync in agent |
| Device shows wrong policy | Check schedules and default policy in Settings |
| Agent can't reach server | Verify server URL and network connectivity |
| Need to unenroll | Uninstall the agent app |

**Recovery from hardware (always works):**
1. Power off the phone
2. Hold **Power + Volume Down** until bootloader appears
3. Use volume buttons to select **Recovery mode**, press Power
4. Hold **Power**, tap **Volume Up** once
5. Select **Wipe data/factory reset**
