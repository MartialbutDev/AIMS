
import React, {
  useEffect,
  useCallback,
  useRef,
  useState,
} from "react";

import {
  Stack,
  Redirect,
  useSegments,
  useFocusEffect,
} from "expo-router";

import { StatusBar } from "expo-status-bar";

import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from "react-native";

import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import * as SecureStore from "expo-secure-store";

import FloatingBottomTabBar from "../../src/components/navigation/FloatingBottomTabBar";

import { useTheme } from "../../src/context/ThemeContext";
import { useScrollContext } from "../../src/context/ScrollContext";

import {
  onboardingService,
  OnboardingApiError,
} from "../../src/services/onboarding.service";



const HIDE_TAB_BAR_PREFIXES = [
  "/pre-deployment",
  "/profile",
  "/settings",
  "/about",
  "/notifications/preferences",
  "/dtr/",
  "/journals/",
  "/applications/",
  "/documents/",
];

type AccessState =
  | "checking"
  | "unauthenticated"
  | "onboarding"
  | "allowed"
  | "error";

export default function StudentLayout() {
  const { colors, isDark } = useTheme();
  const { translateY } = useScrollContext();

  const insets = useSafeAreaInsets();
  const segments = useSegments();

  const [accessState, setAccessState] =
    useState<AccessState>("checking");

  const [errorMessage, setErrorMessage] =
    useState("");

  const requestIdRef = useRef(0);
  const focusedRef = useRef(false);

  // ============================================================
  // VERIFY STUDENT ACCESS
  // ============================================================

  const checkAccess = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setAccessState("checking");
    setErrorMessage("");

    try {
      // Step 1: Check saved authentication token.
      const token = await SecureStore.getItemAsync(
        "access_token"
      );

      if (
        !focusedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      if (!token) {
        setAccessState("unauthenticated");
        return;
      }

      // Step 2: Check onboarding status on the backend.
      const status =
        await onboardingService.getStatus();

      if (
        !focusedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      // Step 3: Allow access only if eligible.
      if (status.eligible === true) {
        setAccessState("allowed");
      } else {
        setAccessState("onboarding");
      }
    } catch (error: unknown) {
      if (
        !focusedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      // Expired or invalid authentication token.
      if (
        error instanceof OnboardingApiError &&
        error.status === 401
      ) {
        setAccessState("unauthenticated");
        return;
      }

      // Network errors must never grant access.
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to verify your access."
      );

      setAccessState("error");
    }
  }, []);

  // ============================================================
  // CHECK ACCESS WHEN STUDENT ROUTES ARE FOCUSED
  // ============================================================

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;

      void checkAccess();

      return () => {
        focusedRef.current = false;

        // Invalidate requests that have not completed.
        requestIdRef.current += 1;
      };
    }, [checkAccess])
  );

  // ============================================================
  // RETRY VERIFICATION
  // ============================================================

  const retryAccess = () => {
    void checkAccess();
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (accessState === "checking") {
    return (
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={colors.accent}
        />

        <Text
          style={[
            styles.loadingText,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          Verifying student access...
        </Text>
      </View>
    );
  }

  // ============================================================
  // UNAUTHENTICATED
  // ============================================================

  if (accessState === "unauthenticated") {
    return (
      <Redirect href="/(auth)/login" />
    );
  }

  // ============================================================
  // ONBOARDING INCOMPLETE
  // ============================================================

  if (accessState === "onboarding") {
  return <Redirect href="/onboarding" />;
}

  // ============================================================
  // NETWORK OR SERVER ERROR
  // ============================================================

  if (accessState === "error") {
    return (
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor: colors.background,
            paddingHorizontal: 24,
          },
        ]}
      >
        <Text
          style={[
            styles.errorTitle,
            {
              color: colors.textPrimary,
            },
          ]}
        >
          Access Verification Failed
        </Text>

        <Text
          style={[
            styles.errorMessage,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          {errorMessage ||
            "Unable to verify your access."}
        </Text>

        <TouchableOpacity
          onPress={retryAccess}
          style={[
            styles.retryButton,
            {
              backgroundColor: colors.primary,
            },
          ]}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ============================================================
  // AUTHENTICATED AND VERIFIED STUDENT
  // ============================================================

  const pathname =
    "/" + segments.slice(1).join("/");

  const shouldHideTabBar =
    HIDE_TAB_BAR_PREFIXES.some(
      (prefix) => pathname.startsWith(prefix)
    );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
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

// ============================================================
// STYLES
// ============================================================

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

  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },

  errorTitle: {
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },

  errorMessage: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 22,
  },

  retryButton: {
    minWidth: 140,
    paddingVertical: 13,
    paddingHorizontal: 26,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
