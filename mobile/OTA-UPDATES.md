# AIMS Android preview updates

GitHub Actions runs backend tests, web checks, and mobile checks on pull requests. It uses a disposable SQLite database and disables outbound notifications during backend tests.

## First install

Build the signed preview APK from the mobile directory and install it over AIMS 1.0.11 using the same Android signing key.

```powershell
npx.cmd eas-cli@27.2.0 build --platform android --profile preview
```

AIMS 1.0.12 checks for compatible preview updates at launch. It downloads updates in the background and applies them on a later launch. Open **Profile → About AIMS** to see **Preview build** for the APK's bundled code or **Preview update installed** after an update has been applied.

## Publish a preview

Use the **AIMS checks** workflow in GitHub Actions. Select `main`, enable the **Publish a checked Android update to the Expo preview channel** checkbox, and run the workflow. Add an Expo access token as the `EXPO_TOKEN` secret in the `expo-preview` GitHub environment to enable that job. The job runs after all checks pass.

For a manual run with an existing Expo sign-in, use the mobile directory:

```powershell
$env:EXPO_NO_DOTENV = '1'
$env:EXPO_PUBLIC_BASE_URL = 'https://3.25.132.153'
$env:EXPO_PUBLIC_API_URL = 'https://3.25.132.153/api/v1'
npx.cmd eas-cli@27.2.0 update --channel preview --platform android --environment preview --message "Describe the changes"
```

Use the Expo dashboard to confirm the preview update and preview build have the same Android runtime. After publishing, open the app with an internet connection, wait for the download, then fully close and reopen it. Verify the change and the status in About AIMS.

## Native changes and rollback

The Expo fingerprint limits update delivery to compatible builds. Build and install a new APK when native dependencies, Android permissions, or the Expo SDK change the runtime. Deploy any required backend changes before publishing the mobile change that depends on them.

To recover from a bad preview update, republish a known good group from the same runtime. If the bundled APK is the last known good version, use Expo's rollback to embedded for the affected preview runtime. The production profile has a separate channel and releases there are manual.
