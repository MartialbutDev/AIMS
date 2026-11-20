const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');
const fs = require('node:fs/promises');
const path = require('node:path');

// Expo Notifications 0.32 reads this bitmap when building local and remote notifications.
const METADATA_KEY = 'expo.modules.notifications.large_notification_icon';
const RESOURCE_NAME = 'aims_notification_logo';

module.exports = function withAimsNotificationLogo(config) {
  config = withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application['meta-data'] = (application['meta-data'] || []).filter(item => item.$?.['android:name'] !== METADATA_KEY);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application, METADATA_KEY, `@drawable/${RESOURCE_NAME}`, 'resource'
    );
    return config;
  });

  return withDangerousMod(config, ['android', async (config) => {
    const source = path.join(config.modRequest.projectRoot, 'assets/images/aims-identity-icon.png');
    await fs.access(source);
    const { source: bitmap } = await generateImageAsync(
      { projectRoot: config.modRequest.projectRoot, cacheType: 'aims-notification-logo' },
      { src: source, width: 192, height: 192, resizeMode: 'contain', backgroundColor: 'transparent' }
    );
    // A bundled bitmap works offline. drawable-nodpi avoids decoding the full launcher artwork.
    const directory = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/drawable-nodpi');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, `${RESOURCE_NAME}.png`), bitmap);
    return config;
  }]);
};
