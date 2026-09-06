// app/(student)/_layout.tsx
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FloatingBottomTabBar from "../../src/components/navigation/FloatingBottomTabBar";
import { useTheme } from "../../src/context/ThemeContext";
import { useScrollContext } from "../../src/context/ScrollContext";

export default function StudentLayout() {
  const { colors, isDark } = useTheme();
  const { translateY } = useScrollContext();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // ✅ Screens where the tab bar should be hidden
  const hideTabBarScreens = [
    "/profile",
    "/profile/change-password",
    "/notifications/preferences",
    "/settings/privacy-security",
    "/settings/help-support", // ✅ ADDED - Help & Support
    "/about",
    "/settings/app-settings",
    "/settings/terms",
    "/settings/privacy-policy",
    "/settings",
  ];

  // ✅ Check if current path should hide tab bar
  const shouldHideTabBar = hideTabBarScreens.some((screen) => 
    pathname.includes(screen)
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
      
      <View 
        style={[
          styles.content, 
          { 
            paddingTop: insets.top,
            backgroundColor: colors.background 
          }
        ]}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
      </View>
      
      {/* ✅ Only show tab bar if not on hidden screens */}
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