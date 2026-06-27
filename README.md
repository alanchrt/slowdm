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

## Quick start

> **Note:** The `slowdm` npm package is not yet published. For now, clone the repo and use `npm run setup` (see [From source](#from-source) below).

```sh
npx slowdm setup     # first-time: creates DB, sets secrets, deploys
```

That's it. The CLI handles Cloudflare login, D1 database creation, migrations, secrets, and deployment. It will prompt you for an admin password and (optionally) your Google Cloud service account JSON.

For subsequent updates:

```sh
npx slowdm update    # idempotent: ensures resources, deploys
```

### Google Cloud setup

Before running setup, create a Google Cloud service account:

1. Create a new project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Android Management API**
3. Create a **Service Account** and grant it the **Android Management User** role
4. Create a JSON key for the service account -- the setup CLI will ask you to paste it

### After deploy

Visit your deployment URL. The setup wizard will walk you through creating your Android enterprise and configuring your first policies.

## From source

If you want to develop or customize SlowDM:

```sh
git clone <repo-url> && cd slowdm
npm install
npm run setup         # first-time Cloudflare setup
```

### Local development

```sh
npm run db:migrate    # apply migrations to local D1
npm run dev           # start dev server at localhost:5173
```

For local dev, set secrets in a `.dev.vars` file:

```
AUTH_PASSWORD=your-password
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

### Scripts

| Command | Description |
|---|---|
| `npm run setup` | First-time setup (create DB, set secrets, build, deploy) |
| `npm run update` | Ensure resources, build, deploy (ongoing) |
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
