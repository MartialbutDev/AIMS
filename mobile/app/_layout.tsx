
import React, { useEffect } from "react";
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
    void (async () => {
      if (!await SecureStore.getItemAsync('access_token') || cancelled) return;
      try { await registerPushDevice(); } catch { /* Inbox remains available while registration is offline. */ }
      if (cancelled) return;
      const cleanup = await listenForPushNavigation();
      if (cancelled) cleanup(); else stop = cleanup;
    })().catch(() => {});
    return () => { cancelled = true; stop?.(); };
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
