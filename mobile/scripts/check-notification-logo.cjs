/* global __dirname */
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = process.env.AIMS_MOBILE_ROOT || path.resolve(__dirname, '..');
const projectFixture = path.resolve(process.env.AIMS_TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'aims-notification-logo-check'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

(async () => {
  const plugin = require(path.join(root, 'plugins/with-aims-notification-logo.js'));
  const sourcePath = path.join(root, 'assets/images/aims-identity-icon.png');
  const original = await fs.readFile(sourcePath);
  const assetPath = path.join(projectFixture, 'assets/images/aims-identity-icon.png');
  await fs.mkdir(path.dirname(assetPath), { recursive: true });
  await fs.writeFile(assetPath, original);
  const app = JSON.parse(await fs.readFile(path.join(root, 'app.json'), 'utf8')).expo;
  assert.equal(app.plugins.filter(p => p === './plugins/with-aims-notification-logo').length, 1);
  const smallIcon = app.plugins.find(p => Array.isArray(p) && p[0] === 'expo-notifications')[1];
  assert.equal(smallIcon.icon, './assets/images/aims-notification-icon.png');

  // Run the actual Expo mod wrappers, only against a disposable Android resource directory.
  const config = plugin({ name: 'AIMS fixture', slug: 'aims-fixture' });
  const metadata = [
    { $: { 'android:name': 'unrelated.setting', 'android:value': 'preserve' } },
    { $: { 'android:name': 'expo.modules.notifications.default_notification_icon', 'android:resource': '@drawable/notification_icon' } },
    { $: { 'android:name': 'expo.modules.notifications.large_notification_icon', 'android:value': 'obsolete' } },
    { $: { 'android:name': 'expo.modules.notifications.large_notification_icon', 'android:resource': '@drawable/obsolete' } },
  ];
  let manifestConfig = { ...config, modResults: { manifest: { application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': metadata }] } },
    modRequest: { projectRoot: projectFixture, platformProjectRoot: path.join(projectFixture, 'android'), platform: 'android', modName: 'manifest' } };
  manifestConfig = await config.mods.android.manifest(manifestConfig);
  manifestConfig = await config.mods.android.manifest(manifestConfig);
  const entries = manifestConfig.modResults.manifest.application[0]['meta-data'];
  const logoEntries = entries.filter(item => item.$['android:name'] === 'expo.modules.notifications.large_notification_icon');
  assert.equal(logoEntries.length, 1);
  assert.deepEqual(logoEntries[0].$, { 'android:name': 'expo.modules.notifications.large_notification_icon', 'android:resource': '@drawable/aims_notification_logo' });
  assert.ok(entries.some(item => item.$['android:name'] === 'unrelated.setting'));
  assert.ok(entries.some(item => item.$['android:resource'] === '@drawable/notification_icon'));
  const dangerousConfig = { ...config, modResults: {}, modRequest: { ...manifestConfig.modRequest, modName: 'dangerous' } };
  await config.mods.android.dangerous(dangerousConfig);
  const generatedPath = path.join(projectFixture, 'android/app/src/main/res/drawable-nodpi/aims_notification_logo.png');
  const generated = await fs.readFile(generatedPath);
  assert.equal(generated.subarray(1, 4).toString(), 'PNG');
  assert.equal(generated.readUInt32BE(16), 192);
  assert.equal(generated.readUInt32BE(20), 192);
  await config.mods.android.dangerous(dangerousConfig);
  assert.equal(hash(await fs.readFile(generatedPath)), hash(generated));
  assert.equal(hash(await fs.readFile(sourcePath)), hash(original));
  const native = await fs.readFile(path.join(root, 'node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/builders/ExpoNotificationBuilder.kt'), 'utf8');
  assert.ok(native.includes('"expo.modules.notifications.large_notification_icon"'), 'Recheck native integration after an Expo upgrade');
  assert.ok(native.includes('builder.setLargeIcon(largeIcon)'));
  assert.ok(native.includes('BitmapFactory.decodeResource(context.resources, resourceId)'));
  const missingFixture = { ...dangerousConfig, modRequest: { ...dangerousConfig.modRequest, projectRoot: path.join(projectFixture, 'missing-source') } };
  await assert.rejects(() => config.mods.android.dangerous(missingFixture));
  await fs.writeFile(path.join(projectFixture, 'manifest-results.json'), JSON.stringify(manifestConfig.modResults, null, 2));
  const result = { passed: true, checks: ['original full-color asset', '192px offline bitmap', 'manifest resource matches installed native reader', 'small status icon preserved', 'unrelated metadata preserved', 'idempotent prebuild', 'missing source fails visibly', 'original artwork unchanged'], apkBuilt: false, deviceNotification: 'not tested', generated: generatedPath };
  await fs.writeFile(path.join(projectFixture, 'results.json'), JSON.stringify(result, null, 2));
  console.log('PASS: native notification logo configuration and bitmap generation in isolated fixture; no APK built.');
})().catch(error => { console.error(error); process.exitCode = 1; });
