# AIMS Android phone notifications

The mobile app is linked to Expo project `39788b8c-8550-496e-a907-08afba0d90fc` and Android package `com.aims.mobile`.

## Firebase and Expo credentials

1. Open https://console.firebase.google.com/ and select the project's Firebase project, or create one if none exists.
2. Add an Android app with package name `com.aims.mobile`. Download its **google-services.json** file and save it as `C:/Users/Administrator/AIMS/mobile/google-services.json`.
3. In Firebase Project settings > Service accounts, generate a private service-account key. Store that private file outside the AIMS repository; do not paste it into chat.
4. In https://expo.dev/, sign in to the account that owns the existing AIMS project. Open that project's Credentials > Android > com.aims.mobile > FCM V1 service account key and upload the private service-account JSON. Use the same Firebase project as the Android client configuration.
5. The private service-account JSON belongs in Expo credentials. It is different from the Android client file named google-services.json.

Official instructions: https://docs.expo.dev/push-notifications/fcm-credentials/

## Build and install

In PowerShell:

```powershell
cd C:\Users\Administrator\AIMS\mobile
npx eas-cli@latest login
npx eas-cli@latest project:info
npx eas-cli@latest build --platform android --profile preview
```

Confirm project:info shows the existing project ID above. Install the resulting APK on the Android phone. Android remote push requires an AIMS build; Expo Go does not support this flow for SDK 54.

The new app.config.js accepts mobile/google-services.json or an EAS **file** environment variable named GOOGLE_SERVICES_JSON. An Android EAS build stops with a clear error if the Firebase client file is missing or its package name does not match.

## Verify

1. Sign in to the student account in the new APK and allow notification permission.
2. Open Settings > Notification preferences, enable Push Notifications and tap **Connect / reconnect this phone**. Confirm the registration message and updated device count.
3. Put the app in the background. From a separate coordinator account, send that student's normal document reminder.
4. Check for the generic AIMS phone alert. Tap it and confirm that it opens the matching section after verifying account ownership.
5. Turn Push Notifications off and send another reminder. The reminder remains in the in-app inbox, with phone delivery disabled.

Registration retries when the app returns to the foreground, and native push-token changes trigger registration again. Signing out unregisters the device. Delivery also respects the category preferences and the phone's operating-system notification controls.

No real-device delivery is verified until the Firebase credentials are installed, the APK is rebuilt and this test passes.
