#!/usr/bin/env node

import { parseArgs } from 'util';
import * as readline from 'readline';
import { execFile } from 'child_process';
import { access, readFile, writeFile, unlink } from 'fs/promises';

// Load .env file if present (simple KEY=VALUE parser, no dependencies)
try {
  const envFile = await readFile('.env', 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
} catch {}

const { values: flags } = parseArgs({
  args: process.argv.slice(2),
  options: {
    remove: { type: 'boolean', default: false },
    'server-url': { type: 'string' },
    'admin-password': { type: 'string' },
    name: { type: 'string' },
    'apk-path': { type: 'string', default: 'agent/build/slowdm-agent.apk' },
  },
});

const PACKAGE = 'com.slowdm.agent';
const RECEIVER = `${PACKAGE}/.devicepolicy.DeviceAdminReceiver`;

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function adb(...args) {
  return run('adb', args);
}

async function checkPrerequisites() {
  // Check adb exists
  try {
    await run('which', ['adb']);
  } catch {
    console.error('Error: adb not found in PATH. Install Android SDK platform-tools.');
    process.exit(1);
  }

  // Check device connected
  const devices = await adb('devices');
  const lines = devices.split('\n').filter((l) => l.includes('\tdevice'));
  if (lines.length === 0) {
    console.error('Error: No Android device connected. Connect via USB and enable USB debugging.');
    process.exit(1);
  }
  if (lines.length > 1) {
    console.error('Error: Multiple devices connected. Disconnect all but one.');
    process.exit(1);
  }

  console.log(`Device: ${lines[0].split('\t')[0]}`);

  // Check Android version
  const apiLevel = await adb('shell', 'getprop', 'ro.build.version.sdk');
  const version = await adb('shell', 'getprop', 'ro.build.version.release');
  console.log(`Android ${version} (API ${apiLevel})`);

  if (parseInt(apiLevel) < 24) {
    console.error('Error: Android 7.0+ (API 24) required.');
    process.exit(1);
  }
}

async function checkNoAccounts() {
  const accounts = await adb('shell', 'dumpsys', 'account');
  const match = accounts.match(/Accounts:\s*(\d+)/);
  if (match && parseInt(match[1]) > 0) {
    console.error('Error: Device has accounts registered.');
    console.error('Device owner can only be set on a freshly reset device with no accounts.');
    console.error('Factory reset the device and try again (do NOT add any Google account).');
    process.exit(1);
  }
}

async function setupDevice() {
  await checkPrerequisites();
  await checkNoAccounts();

  const serverUrl =
    flags['server-url'] || process.env.SLOWDM_URL || (await prompt('Server URL (e.g., https://slowdm.example.com): '));
  const adminPassword =
    flags['admin-password'] || process.env.SLOWDM_PASSWORD || (await prompt('Admin password: '));
  const deviceName = flags.name || (await prompt('Device name (e.g., pixel-9-pro): '));
  const apkPath = flags['apk-path'];

  // Check APK exists
  try {
    await access(apkPath);
  } catch {
    console.error(`Error: APK not found at ${apkPath}`);
    console.error('Build it first: cd agent && eas build --platform android --profile production --local');
    process.exit(1);
  }

  // Generate device token
  const deviceToken = crypto.randomUUID();

  // Register device with server
  console.log('\nRegistering device with server...');
  const registerRes = await fetch(`${serverUrl}/api/device/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': adminPassword,
    },
    body: JSON.stringify({ name: deviceName, deviceToken }),
  });

  if (!registerRes.ok) {
    const err = await registerRes.text();
    console.error(`Error: Registration failed (${registerRes.status}): ${err}`);
    process.exit(1);
  }

  const { deviceId } = await registerRes.json();
  console.log(`Registered as device #${deviceId}`);

  // Install APK
  console.log('\nInstalling APK...');
  await adb('install', '-r', apkPath);
  console.log('APK installed');

  // Set device owner
  console.log('\nSetting device owner...');
  try {
    const result = await adb('shell', 'dpm', 'set-device-owner', RECEIVER);
    console.log(result);
  } catch (e) {
    console.error('Error: Failed to set device owner.');
    console.error('Make sure no accounts are on the device and it was factory reset.');
    console.error(String(e));
    process.exit(1);
  }

  // Write config to device
  console.log('\nWriting config to device...');
  const config = JSON.stringify({ serverUrl, deviceId, deviceToken });
  const tmpFile = '/tmp/slowdm-config.json';
  await writeFile(tmpFile, config);
  await adb('push', tmpFile, '/data/local/tmp/slowdm-config.json');
  await adb('shell', 'run-as', PACKAGE, 'mkdir', '-p', `/data/data/${PACKAGE}/files`);
  await adb('shell', 'cp', '/data/local/tmp/slowdm-config.json', `/data/data/${PACKAGE}/files/config.json`);
  await adb('shell', 'run-as', PACKAGE, 'chmod', '600', `/data/data/${PACKAGE}/files/config.json`);
  await adb('shell', 'rm', '/data/local/tmp/slowdm-config.json');
  await unlink(tmpFile);

  // Request battery optimization exemption
  console.log('\nRequesting battery optimization exemption...');
  await adb('shell', 'dumpsys', 'deviceidle', 'whitelist', `+${PACKAGE}`);

  // Launch app
  console.log('\nLaunching app...');
  await adb('shell', 'am', 'start', '-n', `${PACKAGE}/.MainActivity`);

  console.log('\n--- Setup complete ---');
  console.log(`Device: ${deviceName} (#${deviceId})`);
  console.log(`Server: ${serverUrl}`);
  console.log(`Token: ${deviceToken}`);
  console.log('\nThe app should sync automatically on launch.');
  console.log('Check the SlowDM web dashboard to verify the device appears as enrolled.');
}

async function removeDevice() {
  await checkPrerequisites();

  console.log('Removing device owner and uninstalling...');

  try {
    await adb('shell', 'dpm', 'remove-active-admin', RECEIVER);
    console.log('Device owner removed');
  } catch (e) {
    console.error('Warning: Could not remove device owner:', String(e));
  }

  try {
    await adb('shell', 'pm', 'uninstall', PACKAGE);
    console.log('App uninstalled');
  } catch (e) {
    console.error('Warning: Could not uninstall:', String(e));
  }

  console.log('\nDevice owner removed and app uninstalled.');
  console.log('You may also want to delete the device from the SlowDM web dashboard.');
}

if (flags.remove) {
  removeDevice().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  setupDevice().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
