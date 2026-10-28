# Build the AIMS Android APK

From PowerShell in `C:\Users\PC\AIMS\mobile`:

```powershell
npx.cmd eas-cli login
npx.cmd eas-cli build --platform android --profile preview
```

On the first build, allow EAS to create/link the AIMS project and generate the
Android signing keystore. Keep access to that Expo account and keystore for
future updates. After a successful build, open the artifact link printed by EAS
and download the `.apk` to the Android phone. This is a standalone app and does
not require Expo Go or a running Metro terminal.

The `preview` profile in `eas.json` builds an APK, with app name `AIMS`, package
`com.aims.mobile`, and the AIMS launcher icon and splash logo. It connects to:

- Base URL: `http://3.25.132.153`
- API URL: `http://3.25.132.153/api/v1`

The Android config plugin permits HTTP only for this configured backend host.
When moving the backend, update both URLs in `eas.json` and the host in
`plugins/with-aims-network.js`, then build a new APK.

For a local JavaScript bundling check:

```powershell
npx.cmd expo export --platform android --output-dir dist-apk-check
```

This check produces a JavaScript bundle, not an installable APK.
