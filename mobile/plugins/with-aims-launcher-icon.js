const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const foreground = '<foreground android:drawable="@mipmap/ic_launcher_foreground"/>';
const insetForeground = `<foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="18%"/>
    </foreground>`;

module.exports = function withAimsLauncherIcon(config) {
  return withFinalizedMod(config, ['android', async (config) => {
    const resources = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/mipmap-anydpi-v26');

    // Expo generates both adaptive icons. Give the existing artwork room inside OEM launcher masks.
    for (const filename of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
      const iconPath = path.join(resources, filename);
      const xml = await fs.readFile(iconPath, 'utf8');
      if (xml.includes(insetForeground)) continue;
      if (!xml.includes(foreground)) {
        throw new Error(`Expected the AIMS adaptive icon foreground in ${filename}.`);
      }
      await fs.writeFile(iconPath, xml.replace(foreground, insetForeground), 'utf8');
    }

    return config;
  }]);
};
