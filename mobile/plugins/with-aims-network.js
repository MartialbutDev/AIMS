const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// The hosted AIMS API currently serves HTTP. Permit it only for this host.
module.exports = function withAimsNetwork(config) {
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
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">3.25.132.153</domain>
  </domain-config>
</network-security-config>
`);
    return config;
  }]);
};
