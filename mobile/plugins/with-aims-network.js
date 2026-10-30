const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Hosted builds require TLS; explicit local HTTP origins remain available for development.
module.exports = function withAimsNetwork(config) {
  const origin = new URL(process.env.EXPO_PUBLIC_BASE_URL || "https://3.25.132.153");
  const localHttp = origin.protocol === "http:" && (origin.hostname === "localhost" || origin.hostname.startsWith("192.168.") || origin.hostname.startsWith("10."));
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    application.$['android:networkSecurityConfig'] = '@xml/aims_network_security_config';
    return config;
  });

  return withDangerousMod(config, ['android', async (config) => {
    const directory = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'aims_network_security_config.xml'), `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  ${localHttp ? `<domain-config cleartextTrafficPermitted="true"><domain includeSubdomains="false">${origin.hostname}</domain></domain-config>` : ""}
</network-security-config>
`);
    return config;
  }]);
};
