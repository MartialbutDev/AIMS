// app/(student)/_layout.tsx
import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FloatingBottomTabBar from "../../src/components/navigation/FloatingBottomTabBar";
import { useTheme } from "../../src/context/ThemeContext";
import { useScrollContext } from "../../src/context/ScrollContext";

/**
 * Prefix-based hide list.
 *
 * Any route whose normalized path starts with one of these strings will
 * hide the floating tab bar.
 *
 * IMPORTANT: A trailing "/" means "children only".
 *   "/dtr"   → matches /dtr (list)          → tab bar visible
 *   "/dtr/"  → matches /dtr/new, /dtr/abc   → tab bar hidden
 *
 * Order does not matter.
 */
const HIDE_TAB_BAR_PREFIXES = [
  // ----- Account / profile -----
  "/profile",                    // /profile, /profile/change-password

  // ----- Settings & informational -----
  "/settings",                   // /settings and every child route
  "/about",
  "/notifications/preferences",

  // ----- Full-screen forms (own bottom button) -----
  "/dtr/",                       // covers /dtr/new, /dtr/time-out, /dtr/[id]
  "/journals/",                  // covers /journals/new, /journals/[id]
  "/applications/",              // covers /applications/new, /applications/[id]
  "/documents/",                 // covers /documents/upload, /documents/[id]
];

export default function StudentLayout() {
  const { colors, isDark } = useTheme();
  const { translateY } = useScrollContext();
  const insets = useSafeAreaInsets();
  const segments = useSegments();

  // ["(student)", "dtr", "new"] → "/dtr/new"
  const pathname = "/" + segments.slice(1).join("/");

  const shouldHideTabBar = HIDE_TAB_BAR_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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

      {!shouldHideTabBar && <FloatingBottomTabBar translateY={translateY} />}
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
});