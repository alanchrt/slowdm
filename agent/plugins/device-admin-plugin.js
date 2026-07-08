const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function addDeviceAdminReceiver(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application[0];

    // Add DeviceAdminReceiver
    if (!app.receiver) app.receiver = [];

    const receiverExists = app.receiver.some(
      (r) => r.$?.['android:name'] === '.devicepolicy.DeviceAdminReceiver'
    );

    if (!receiverExists) {
      app.receiver.push({
        $: {
          'android:name': '.devicepolicy.DeviceAdminReceiver',
          'android:permission': 'android.permission.BIND_DEVICE_ADMIN',
          'android:exported': 'true',
        },
        'meta-data': [
          {
            $: {
              'android:name': 'android.app.device_admin',
              'android:resource': '@xml/device_admin',
            },
          },
        ],
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.app.action.DEVICE_ADMIN_ENABLED' } },
            ],
          },
        ],
      });
    }

    // Add AlarmReceiver for exact alarms
    const alarmReceiverExists = app.receiver.some(
      (r) => r.$?.['android:name'] === '.devicepolicy.AlarmReceiver'
    );

    if (!alarmReceiverExists) {
      app.receiver.push({
        $: {
          'android:name': '.devicepolicy.AlarmReceiver',
          'android:exported': 'false',
        },
      });
    }

    // Add BootReceiver
    const bootReceiverExists = app.receiver.some(
      (r) => r.$?.['android:name'] === '.devicepolicy.BootReceiver'
    );

    if (!bootReceiverExists) {
      app.receiver.push({
        $: {
          'android:name': '.devicepolicy.BootReceiver',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
            ],
          },
        ],
      });
    }

    // Add permissions
    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.INTERNET',
      'android.permission.READ_EXTERNAL_STORAGE',
    ];

    for (const perm of permissions) {
      const exists = manifest.manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === perm
      );
      if (!exists) {
        manifest.manifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    }

    return config;
  });
}

function addDeviceAdminXml(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );

      fs.mkdirSync(resDir, { recursive: true });

      const xml = `<?xml version="1.0" encoding="utf-8"?>
<device-admin xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-policies>
        <limit-password />
        <watch-login />
        <reset-password />
        <force-lock />
        <wipe-data />
        <expire-password />
        <encrypted-storage />
        <disable-camera />
        <disable-keyguard-features />
    </uses-policies>
</device-admin>`;

      fs.writeFileSync(path.join(resDir, 'device_admin.xml'), xml);
      return config;
    },
  ]);
}

module.exports = function deviceAdminPlugin(config) {
  config = addDeviceAdminReceiver(config);
  config = addDeviceAdminXml(config);
  return config;
};
