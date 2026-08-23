// src/components/navigation/FloatingBottomTabBar.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { MotiView } from "moti";
import { StyleSheet, Text, TouchableOpacity, View, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../context/ThemeContext";

interface TabItem {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  label: string;
  badge?: number;
}

const tabs: TabItem[] = [
  { name: "home", icon: "home-outline", route: "/(student)/dashboard", label: "Home" },
  { name: "applications", icon: "briefcase-outline", route: "/(student)/applications", label: "Applications", badge: 0 },
  { name: "documents", icon: "document-text-outline", route: "/(student)/documents", label: "Documents" },
  { name: "dtr", icon: "calendar-outline", route: "/(student)/dtr", label: "DTR" },
  { name: "more", icon: "menu-outline", route: "/(student)/settings", label: "More" },
];

interface FloatingBottomTabBarProps {
  activeTab?: string;
  translateY?: Animated.Value;
}

export default function FloatingBottomTabBar({ 
  activeTab, 
  translateY = new Animated.Value(0) 
}: FloatingBottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const pathname = usePathname();

  const getActiveTab = () => {
    if (pathname.includes("/dashboard")) return "home";
    if (pathname.includes("/applications")) return "applications";
    if (pathname.includes("/documents")) return "documents";
    if (pathname.includes("/dtr")) return "dtr";
    if (pathname.includes("/settings") || pathname.includes("/profile")) return "more";
    return "home";
  };

  const currentTab = activeTab || getActiveTab();

  const handleTabPress = (tab: TabItem) => {
    if (tab.route === pathname) return;
    router.push(tab.route as any);
  };

  const animatedStyle = {
    transform: [
      {
        translateY: translateY,
      },
    ],
    opacity: translateY.interpolate({
      inputRange: [0, 100],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? 'rgba(30,41,59,0.92)' : 'rgba(255,255,255,0.92)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.3)',
          },
          animatedStyle,
        ]}
      >
        <View style={styles.tabContainer}>
          {tabs.map((tab) => {
            const isActive = currentTab === tab.name;
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tabItem}
                onPress={() => handleTabPress(tab)}
                activeOpacity={0.7}
                accessibilityLabel={tab.label}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <MotiView
                  animate={{
                    scale: isActive ? 1.1 : 1,
                    translateY: isActive ? -4 : 0,
                  }}
                  transition={{ type: "spring", damping: 12, stiffness: 100 }}
                  style={styles.iconWrapper}
                >
                  <Ionicons
                    name={isActive ? tab.icon.replace("-outline", "") as any : tab.icon}
                    size={24}
                    color={isActive ? colors.primary : colors.textSecondary}
                  />
                  {tab.badge && tab.badge > 0 ? (
                    <View style={[styles.badge, { backgroundColor: colors.error }]}>
                      <Text style={styles.badgeText}>{tab.badge}</Text>
                    </View>
                  ) : null}
                </MotiView>
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isActive ? colors.primary : colors.textSecondary },
                    isActive && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
                {isActive ? (
                  <MotiView
                    from={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    style={[styles.activeIndicator, { backgroundColor: colors.primary }]}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'transparent',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none',
  },
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    borderWidth: 1,
    overflow: 'hidden',
    pointerEvents: 'auto',
  },
  tabContainer: {
    flexDirection: 'row',
    height: 70,
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  iconWrapper: {
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});