"# Mobile App" 

## Run on a phone with Expo Go

Use Node.js 20.19 or 22.x. Expo SDK 54's native toolchain does not support Node.js 23.

```sh
npm install
npm start
```

The default start command uses the local network. Connect the phone and computer
to the same Wi-Fi, then open Expo Go and scan the QR code printed by Expo.

If an old bundle is cached, use `npm run start:clear`. If the phone cannot reach
the computer over Wi-Fi, try `npm run start:tunnel`; it requires internet access
and may be blocked by a firewall or network policy.

If the app opens but cannot reach the backend, set `EXPO_PUBLIC_API_URL` to the
backend's address reachable from the phone; `localhost` refers to the phone, not
the development computer."
