// src/components/navigation/BottomTabBar.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { MotiView } from "moti";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  { name: "applications", icon: "briefcase-outline", route: "/(student)/applications", label: "Applications", badge: 3 },
  { name: "documents", icon: "document-text-outline", route: "/(student)/documents", label: "Documents" },
  { name: "dtr", icon: "calendar-outline", route: "/(student)/dtr", label: "DTR" },
  { name: "more", icon: "menu-outline", route: "/(student)/settings", label: "More" },
];

export default function BottomTabBar({ activeTab }: { activeTab?: string }) {
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.card }]} edges={["bottom"]}>
      <View style={[styles.container, { backgroundColor: colors.card }]}>
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
              <View style={styles.tabContent}>
                <MotiView
                  animate={{
                    scale: isActive ? 1.1 : 1,
                    translateY: isActive ? -4 : 0,
                  }}
                  transition={{ type: "spring", damping: 12, stiffness: 100 }}
                >
                  <Ionicons
                    name={isActive ? tab.icon.replace("-outline", "") as any : tab.icon}
                    size={24}
                    color={isActive ? colors.primary : colors.textSecondary}
                  />
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
                {isActive && (
                  <MotiView
                    from={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    style={[styles.activeIndicator, { backgroundColor: colors.primary }]}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    borderTopWidth: 1,
    borderTopColor: '#E8EDF5',
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  container: {
    flexDirection: 'row',
    height: 70,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
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
});