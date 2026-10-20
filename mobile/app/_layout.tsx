
import React from "react";
import { Stack } from "expo-router";
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
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
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
