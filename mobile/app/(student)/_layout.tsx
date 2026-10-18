
import React, { useEffect, useState } from "react";

import {
  Stack,
  Redirect,
  useSegments,
} from "expo-router";

import { StatusBar } from "expo-status-bar";

import {
  View,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import * as SecureStore from "expo-secure-store";

import FloatingBottomTabBar from "../../src/components/navigation/FloatingBottomTabBar";

import { useTheme } from "../../src/context/ThemeContext";
import { useScrollContext } from "../../src/context/ScrollContext";

// Hide floating navigation on these screens.
const HIDE_TAB_BAR_PREFIXES = [
  "/profile",
  "/settings",
  "/about",
  "/notifications/preferences",
  "/dtr/",
  "/journals/",
  "/applications/",
  "/documents/",
];

export default function StudentLayout() {
  const { colors, isDark } = useTheme();
  const { translateY } = useScrollContext();

  const insets = useSafeAreaInsets();
  const segments = useSegments();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAuthentication() {
      try {
        const token = await SecureStore.getItemAsync(
          "access_token"
        );

        if (mounted) {
          setIsAuthenticated(Boolean(token));
        }
      } catch (error) {
        console.error(
          "Student authentication check failed:",
          error
        );

        if (mounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (mounted) {
          setCheckingAuth(false);
        }
      }
    }

    checkAuthentication();

    return () => {
      mounted = false;
    };
  }, []);

  // Wait for SecureStore before mounting student screens.
  if (checkingAuth) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />
      </View>
    );
  }

  // Prevent student screens from mounting without a token.
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Example: ["(student)", "dtr", "new"] -> "/dtr/new"
  const pathname = "/" + segments.slice(1).join("/");

  const shouldHideTabBar = HIDE_TAB_BAR_PREFIXES.some(
    (prefix) => pathname.startsWith(prefix)
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={colors.background}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
      </View>

      {!shouldHideTabBar && (
        <FloatingBottomTabBar
          translateY={translateY}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
