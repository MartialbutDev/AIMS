const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  // EAS file environment variable, or the Firebase Android client configuration.
  const file = process.env.GOOGLE_SERVICES_JSON || path.join(__dirname, 'google-services.json');
  if (!fs.existsSync(file)) {
    if (process.env.EAS_BUILD_PLATFORM === 'android') {
      throw new Error('Android push requires google-services.json in mobile/ or an EAS file variable named GOOGLE_SERVICES_JSON. Use the Firebase Android client file for com.aims.mobile.');
    }
    return config;
  }
  const services = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!services.client?.some(client => client.client_info?.android_client_info?.package_name === config.android?.package)) {
    throw new Error('Firebase Android client configuration must include com.aims.mobile. Do not use a service-account private key as google-services.json.');
  }
  return { ...config, android: { ...config.android, googleServicesFile: file } };
};
