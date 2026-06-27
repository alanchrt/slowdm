# SlowDM

Personal/family MDM for managing boundaries with technology. Lock down Android devices on a schedule -- disable hotspot, lock WiFi, restrict apps at bedtime -- without paying for enterprise MDM.

Runs on Cloudflare (free tier) using Google's Android Management API. No custom Android app needed.

## How it works

- Define **policies** (e.g. "bedtime": disable hotspot, lock WiFi, allow only phone/messages/alarm)
- Create **schedules** (e.g. bedtime policy from 10pm-6am on weekdays)
- A cron job runs every 5 minutes, checks which policy should be active, and pushes it to enrolled devices via Google AMAPI
- Enrolled devices enforce restrictions at the OS level -- no way to bypass without a factory reset

## Prerequisites

- A Google Cloud account (free)
- A Cloudflare account (free tier works)
- An Android 6.0+ device to manage
- The managed device must be factory reset for enrollment

## Google Cloud setup

1. Create a new project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Android Management API**
3. Create a **Service Account** and grant it the **Android Management User** role
4. Create a JSON key for the service account -- save this for later

## Deploy to Cloudflare

```sh
git clone <repo-url> && cd slowdm
npm run setup       # first-time: creates DB, sets secrets, builds, deploys
```

The setup script handles everything: Cloudflare login, D1 database creation, migrations, secrets, build, and deploy. It will prompt you for an admin password and (optionally) your Google Cloud service account JSON.

After deploy, visit your deployment URL. The setup wizard will walk you through connecting your Google Cloud project and creating your Android enterprise.

For subsequent deploys after code changes:

```sh
npm run deploy      # builds, runs migrations, deploys
```

## Local development

```sh
npm install
npm run db:migrate    # apply migrations to local D1
npm run dev           # start dev server at localhost:5173
```

The setup wizard runs on first visit. For local dev, set `AUTH_PASSWORD` in a `.dev.vars` file:

```
AUTH_PASSWORD=your-password
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

## Scripts

| Command | Description |
|---|---|
| `npm run setup` | First-time setup (create DB, set secrets, build, deploy) |
| `npm run deploy` | Build, run migrations, deploy (ongoing deploys) |
| `npm run deploy:secrets` | Update Cloudflare secrets |
| `npm run dev` | Start local dev server |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:migrate` | Apply migrations locally |
| `npm run db:migrate:remote` | Apply migrations to production D1 |

## Enrolling a device

1. Go to the **Enroll** page and generate a QR code
2. Factory reset the target Android device
3. At the "Welcome" screen, tap 6 times rapidly
4. Connect to WiFi when prompted
5. Scan the QR code when the camera opens
6. The device enrolls automatically and applies the selected policy

## Policy options

- **Disable tethering/hotspot** -- prevents sharing the connection
- **Lock WiFi config** -- prevents changing WiFi settings
- **Disable backup & restore** -- prevents data backup
- **App allowlist** -- only specified apps are available
- **App blocklist** -- specified apps are blocked
- **Allowed SSIDs** -- restrict which WiFi networks can be used

## Architecture

```
SvelteKit (Cloudflare Pages)
  +-- D1 database (policies, schedules, devices, settings)
  +-- Cron trigger (every 5 min) --> evaluates schedules --> AMAPI
  +-- Google AMAPI --> pushes policies to enrolled Android devices
```

Single-tenant: one deployment = one family. No multi-user auth needed.
