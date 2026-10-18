
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
        <Stack.Screen name="index" />

        {/* Authentication screens */}
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/signup" />
        <Stack.Screen name="(auth)/forgot-password" />

        {/* Protected student screens */}
        <Stack.Screen name="(student)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ScrollProvider>
        <RootLayoutNav />
      </ScrollProvider>
    </ThemeProvider>
  );
}
