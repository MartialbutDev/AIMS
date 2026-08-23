// app/(student)/_layout.tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import FloatingBottomTabBar from "../../src/components/navigation/FloatingBottomTabBar";  // ✅ ../../src
import { useTheme } from "../../src/context/ThemeContext";  // ✅ FIXED: ../../src
import { useScrollContext } from "../../src/context/ScrollContext";  // ✅ FIXED: ../../src

export default function StudentLayout() {
  const { colors, isDark } = useTheme();
  const { translateY } = useScrollContext();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <FloatingBottomTabBar translateY={translateY} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});