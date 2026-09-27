const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds with the shop's own keystore instead of the debug key.
 *
 * Android refuses an update signed with a different key than the installed
 * build, and the only way past that is an uninstall — which deletes the
 * database. So the signing key has to be settled before the shop has data,
 * and it has to keep working after `expo prebuild --clean` wipes android/.
 * Hence a plugin rather than an edit someone has to remember to redo.
 *
 * The credentials are never in the repo. Gradle reads them at build time from
 * a properties file in the user's home directory, and falls back to the debug
 * key when that file is absent, so a fresh clone still builds.
 */
const PROPERTIES_PATH = 'keystores/gupta-home-solutions.keystore.properties';

const LOADER = `
// Injected by plugins/withReleaseSigning.js — see that file for why.
def guptaKeystoreProps = new Properties()
def guptaKeystoreFile = new File("\${System.properties['user.home']}/${PROPERTIES_PATH}")
def guptaHasReleaseKey = guptaKeystoreFile.exists()
if (guptaHasReleaseKey) {
    guptaKeystoreFile.withInputStream { guptaKeystoreProps.load(it) }
}
`;

const RELEASE_SIGNING_CONFIG = `
        if (guptaHasReleaseKey) {
            release {
                storeFile file(guptaKeystoreProps['storeFile'])
                storePassword guptaKeystoreProps['storePassword']
                keyAlias guptaKeystoreProps['keyAlias']
                keyPassword guptaKeystoreProps['keyPassword']
            }
        }`;

function patch(contents) {
  if (contents.includes('guptaHasReleaseKey')) return contents;

  let next = contents.replace(/^android \{/m, `${LOADER}\nandroid {`);

  // Add the release signing config beside the debug one.
  next = next.replace(
    /(signingConfigs \{\s*\n\s*debug \{[\s\S]*?\n {8}\})/m,
    `$1${RELEASE_SIGNING_CONFIG}`,
  );

  // Point the release build type at it, falling back to debug when the
  // keystore is not on this machine.
  next = next.replace(
    /(release \{\s*\n(?:\s*\/\/[^\n]*\n)*)\s*signingConfig signingConfigs\.debug/m,
    `$1            signingConfig guptaHasReleaseKey ? signingConfigs.release : signingConfigs.debug`,
  );

  return next;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning expects a groovy build.gradle');
    }
    cfg.modResults.contents = patch(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.patch = patch;
