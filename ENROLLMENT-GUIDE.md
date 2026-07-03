# Enrolling a Pixel 9 Pro in SlowDM

This is a step-by-step guide for enrolling your personal Pixel 9 Pro as a fully managed device under SlowDM. Read the entire document before starting -- especially the failure scenarios and recovery sections.

## The big picture

Enrolling puts your phone under **fully managed mode** via Google's Android Management API. This means:

- SlowDM controls which apps are available, network settings, VPN, etc.
- You cannot unenroll the device without a factory reset
- A factory reset is required to start enrollment
- All data on the phone will be erased

**This is reversible.** A factory reset always returns the phone to a clean, unmanaged state. You cannot permanently brick a Pixel 9 Pro through MDM enrollment.

---

## Phase 1: Back up everything

### Google account sync

Your Google account automatically backs up most things. Verify it's current:

1. **Settings > System > Backup** -- confirm "Back up to Google One" is on
2. Tap "Back up now" and wait for it to complete
3. Verify the backup timestamp is current

This covers: app data (for apps that support it), call history, contacts, device settings, SMS/MMS, photos/videos (if Google Photos backup is on), WiFi passwords.

**Important: Fully managed mode skips the normal restore flow.** SlowDM enrolls devices with `PERSONAL_USAGE_DISALLOWED` so restrictions can't be bypassed via a personal profile. This means Android does NOT offer the "restore from backup" option during setup. You will need to:
- Reinstall all apps manually from the Play Store
- Sign back into each app individually
- Some app data may be restored once you install the app and sign in (if the app uses Google's backup API), but don't count on it

Your Google account data (contacts, calendar, photos, etc.) will sync back once you add your Google account to the device. But the app list, home screen layout, and app-specific data will not auto-restore.

### Things that DON'T auto-backup

- **Authenticator apps**: Export your 2FA codes before resetting
  - Google Authenticator: Settings > Transfer accounts > Export accounts (screenshot the QR codes or transfer to another device)
  - **Authy**: See detailed Authy backup steps below
  - Consider switching to a cloud-synced 2FA app first if you haven't
- **App-specific data**: Some apps don't use Android's backup API. Check any apps with important local data
- **Downloads folder**: Copy any important files to Google Drive or your computer
- **WhatsApp**: Has its own backup to Google Drive (Settings > Chats > Chat backup > Back up)
- **Signal**: Does NOT backup to Google. Export if needed
- **Banking/payment apps**: You'll need to re-authenticate. Make sure you have access to recovery methods
- **eSIM**: Note your carrier details. You may need to re-activate your eSIM after reset. Contact your carrier if unsure

### Backing up Authy

Authy stores 2FA tokens in the cloud, but you need multi-device enabled to restore them on a freshly reset phone.

1. **Open Authy** on your Pixel
2. Go to **Settings** (gear icon or three dots menu) > **Devices**
3. Make sure **"Allow Multi-device"** is toggled **ON**
   - If it's off, turn it on now. This lets you add Authy to the phone again after reset.
4. **Verify your backup password is set**:
   - Go to **Settings > Accounts** (or **Backups**)
   - "Authenticator Backups" should show **Enabled**
   - If you don't remember your backup password, you can change it here -- but you'll need the current password first. If you've lost it, you'll need to re-add each 2FA account manually after reset.
5. **Optional but recommended**: Install Authy on a second device (laptop, tablet, or another phone) as a safety net
   - Desktop app: authy.com/download
   - Once installed and logged in with your phone number, all your tokens sync over
   - This gives you 2FA access even during the factory reset window

6. **After the factory reset**: Install Authy on the enrolled phone, log in with your phone number, enter your backup password, and all tokens restore.

7. **After tokens are restored**: Consider going back to Authy Settings > Devices and toggling "Allow Multi-device" back **OFF** to prevent unauthorized device additions.

**If you lose your Authy backup password**: You will NOT be able to decrypt your tokens on the new device. You'd need to go to each service (GitHub, AWS, etc.) and re-set up 2FA. This is why testing on a second device first is recommended.

### Verify backup completeness

1. Check Google Dashboard (myaccount.google.com/dashboard) to see what's synced
2. Open Google Photos and confirm recent photos are backed up
3. Check Google Drive for any local files you care about
4. Screenshot your home screen layout — it will not be restored
5. Screenshot your app drawer — you'll reinstall everything manually since fully managed mode skips restore

---

## Phase 2: Configure SlowDM policies

**Do this BEFORE factory resetting.** You want policies ready so the phone enrolls into a known-good state.

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
- **DNS Filtering**: unchecked for now

This gives you a fully permissive policy -- the phone behaves almost normally, but is managed. You can tighten restrictions later once you've confirmed everything works.

### Verify the policy pushes to AMAPI

Go to **Settings > Enforce Now** and confirm no errors. This pushes your policies to Google's servers. If it fails, fix the issue before proceeding -- you don't want to factory reset and then discover AMAPI isn't working.

### Generate an enrollment QR code

1. Go to **Enroll** in SlowDM
2. Device name: "Pixel 9 Pro" (or whatever you want)
3. Initial policy: "Developer" (the permissive one you just created)
4. Click "Generate QR Code"
5. **Keep this page open** -- you'll scan the QR from another device or screen

The QR code expires in 24 hours. If it expires, generate a new one.

---

## Phase 3: Factory reset

1. **Settings > System > Reset options > Erase all data (factory reset)**
2. Confirm and enter your PIN/password
3. The phone will reboot and erase everything
4. This takes a few minutes

If you have an eSIM, the reset dialog will ask whether to keep it. **Keep the eSIM** if you want cellular connectivity during setup.

---

## Phase 4: Enroll the device

After the factory reset, the phone boots to the Welcome screen:

1. **At the "Hi there" / Welcome screen**: Tap the screen **6 times rapidly** in the same spot
   - A QR code reader should appear
   - If it doesn't appear, you may need to connect to WiFi first (some Android versions show the QR reader after WiFi)
   - On Pixel 9 Pro with Android 14+, tapping 6 times on the Welcome screen should work directly

2. **Connect to WiFi** when prompted

3. **Scan the QR code** from the SlowDM enrollment page
   - Use another device (laptop, tablet, another phone) to display the QR code
   - Or print it

4. **Wait for the device to download and install** the Android Device Policy app
   - This can take several minutes
   - The phone will show "Setting up your device..." or similar
   - Don't interrupt this process

5. **Google account sign-in**: You may be prompted to sign in to your Google account
   - Since this is fully managed mode with `PERSONAL_USAGE_DISALLOWED`, you might not get the option to add a personal account
   - The work profile will be the entire device

6. **Setup completes**: The phone boots to the home screen with your policy applied

---

## Failure scenarios and recovery

### QR code doesn't scan / "Invalid QR code"

**Cause**: The QR code data is malformed, expired, or the enrollment token is invalid.

**Fix**: Generate a new QR code in SlowDM. If it keeps failing:
- Check that your AMAPI service account is valid (Settings > Enforce Now should succeed)
- Check the enterprise name is set (Settings page shows it)
- The enrollment token expires after 24 hours -- generate fresh

**Recovery**: The phone is still at the setup screen. You can restart setup or proceed with normal (unmanaged) setup.

### "Something went wrong" during enrollment

**Cause**: The Android Device Policy app failed to download or install, or AMAPI rejected the enrollment.

**Fix**: Ensure the phone has a stable WiFi connection. Try again. If it persists:
- Check Google Cloud Console > Android Management API for error logs
- Verify the enterprise is active

**Recovery**: Factory reset and try again, or proceed with normal setup.

### Phone enrolls but no apps appear / blank home screen

**Cause**: If you accidentally enrolled with the "bedtime" policy (which has an app allowlist), only a handful of system apps would be visible.

**Fix**: In SlowDM, go to **Devices > [your device] > Manual Policy Override** and switch to the "Developer" policy. Click "Enforce Now" in Settings. Wait a few minutes for the policy to push.

**Recovery**: If you can't access SlowDM (e.g., you only have this one phone):
- The phone should still have a browser or Settings app accessible
- Use another device to access SlowDM and change the policy
- If truly locked out: factory reset. This always works.

### Policy is too restrictive / can't install apps

**Cause**: App allowlist mode (`playStoreMode: WHITELIST`) blocks Play Store installs for unlisted apps.

**Fix**: Switch the policy to "No restriction" app mode, or use blocklist mode instead. Enforce Now.

**If you can't reach SlowDM from the managed device**: Use another device (laptop, another phone) to access your SlowDM dashboard and change the policy.

### VPN lockdown blocks all internet

**Cause**: `alwaysOnVpnPackage` with `lockdownEnabled: true` blocks ALL traffic when the VPN app isn't connected. If the VPN app isn't installed or configured, you have no internet.

**THIS IS THE HIGHEST RISK SCENARIO for your first enrollment.** This is why the developer policy above leaves VPN empty.

**Fix**: From another device, edit the policy in SlowDM to remove the always-on VPN. Enforce Now. Wait for the device to receive the policy update (requires some connectivity -- try connecting to WiFi, as the device may briefly allow connections during policy sync).

**Recovery**: If the device is completely offline and can't receive policy updates:
- Factory reset. This is the nuclear option but always works.
- The phone is not bricked -- it just has no internet. All hardware functions still work.

### AMAPI push fails / policy stuck

**Cause**: SlowDM's enforce endpoint failed, or the service account token expired, or the AMAPI call returned an error.

**Fix**: Check SlowDM Settings > Enforce Now and look for errors. Common issues:
- Service account JSON is malformed (re-paste it in the setup wizard)
- Token exchange failed (service account permissions may have changed)
- Enterprise was deleted in Google Cloud Console

**Recovery**: The device keeps its last-applied policy until a new one is pushed. It won't revert or change on its own. You have time to fix the issue.

### Can't factory reset a managed device

**This cannot happen.** AMAPI fully managed mode does NOT prevent factory reset on Pixel devices. You can always:
- Use the hardware button combo: Power off > hold Power + Volume Down to enter bootloader > select "Recovery mode" > hold Power + tap Volume Up > select "Wipe data/factory reset"
- This works even if the screen is locked, the device is offline, or the policy blocks everything

### Device shows as "pending" in SlowDM for a while after enrollment

**Cause**: SlowDM creates a local device record when you generate the QR code, then syncs with AMAPI during the next enforce cycle (every 5 minutes or when you click "Enforce Now").

**Fix**: Click **Enforce Now** in Settings. The enforce cycle queries AMAPI for all enrolled devices and automatically matches them to pending local records using the enrollment token. Your device should switch to "enrolled" status within a few seconds.

**If it still shows pending**: The matching might have failed. This can happen if you generated multiple QR codes without enrolling. Click Enforce Now again -- the sync also falls back to matching by policy name if the token match fails.

---

## Can this brick my phone?

**No.** Here's why:

- **Factory reset always works.** Even from bootloader mode (hardware buttons). AMAPI cannot disable this on Pixel devices.
- **MDM doesn't modify firmware.** AMAPI operates at the Android OS level. It can restrict apps, network, and settings, but cannot modify the bootloader, firmware, or recovery partition.
- **Google controls the kill switch.** If AMAPI somehow malfunctions, Google can revoke the enterprise. Worst case, you factory reset.
- **The phone still makes emergency calls** even if all policies block everything.

The worst realistic outcome is: phone has no internet due to VPN lockdown + VPN not configured. Fix: factory reset (5 minutes) and set up normally.

---

## After successful enrollment

Once the phone is enrolled and working with the permissive developer policy:

1. **Verify basic functionality**: Make calls, send texts, use WiFi, open browser, install an app from Play Store
2. **Test developer tools**: Enable developer options (Settings > About phone > tap Build number 7 times), connect ADB, sideload a test APK
3. **Test policy changes**: In SlowDM, edit the developer policy to toggle a restriction (e.g., disable tethering), Enforce Now, and verify it takes effect on the phone
4. **Gradually tighten**: Once you're confident, create your actual policies (bedtime, etc.) and schedules
5. **Set up WARP/Gateway**: Add the always-on VPN and DNS filtering only after you've confirmed the basic enrollment works

---

## Quick reference: Emergency recovery

| Situation | Fix |
|---|---|
| Phone has no internet | Factory reset (hardware buttons) |
| Can't access SlowDM | Use another device (laptop/tablet) |
| Policy too restrictive | Change policy in SlowDM from another device, Enforce Now |
| Phone stuck on setup | Factory reset, try again or skip enrollment |
| Device stuck on "pending" | Click Enforce Now in Settings |
| Everything is broken | Factory reset. Phone returns to stock. Start over. |

**Factory reset from hardware (always works):**
1. Power off the phone
2. Hold **Power + Volume Down** until bootloader appears
3. Use volume buttons to select **Recovery mode**, press Power
4. Hold **Power**, tap **Volume Up** once
5. Select **Wipe data/factory reset**
