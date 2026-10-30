
import React, { useEffect } from "react";
import { AppState } from "react-native";
import { Stack, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { registerPushDevice, listenForPushNavigation } from "../src/services/push.service";
import { StatusBar } from "expo-status-bar";

import {
  ThemeProvider,
  useTheme,
} from "../src/context/ThemeContext";

import {
  ScrollProvider,
} from "../src/context/ScrollContext";

// ============================================================
// ROOT NAVIGATION
// ============================================================

function RootLayoutNav() {
  const { isDark, colors } = useTheme();
  const area = useSegments()[0];
  useEffect(() => {
    if (area !== '(student)' && area !== 'onboarding') return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    let registering = false;
    const register = async (requestPermission: boolean) => {
      if (cancelled || registering) return;
      registering = true;
      try { await registerPushDevice(requestPermission); }
      catch { /* Registration retries when the app returns to the foreground. */ }
      finally { registering = false; }
    };
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') void register(false);
    });
    void (async () => {
      if (!await SecureStore.getItemAsync('access_token') || cancelled) return;
      const cleanup = await listenForPushNavigation();
      if (cancelled) cleanup(); else stop = cleanup;
      if (!cancelled) await register(true);
    })().catch(() => {});
    return () => { cancelled = true; stop?.(); foreground.remove(); };
  }, [area]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {/* Authentication screens */}
        <Stack.Screen
          name="(auth)/login"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="(auth)/signup"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="(auth)/forgot-password"
          options={{ headerShown: false }}
        />

        {/* Mandatory student onboarding */}
        <Stack.Screen
          name="onboarding/index"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />

        {/* Protected student screens */}
        <Stack.Screen
          name="(student)"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
      </Stack>
    </>
  );
}

// ============================================================
// ROOT LAYOUT
// ============================================================

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ScrollProvider>
        <RootLayoutNav />
      </ScrollProvider>
    </ThemeProvider>
  );
}
