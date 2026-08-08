// app/(student)/settings/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, ScrollView, Text, TouchableOpacity, View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../../src/context/ThemeContext";
import ThemeToggle from "../../../src/components/settings/ThemeToggle";
import { authService } from "../../../src/services/auth.service";

interface SettingItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}

export default function SettingsScreen() {
  const { colors, isDark } = useTheme();

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await authService.logout();
              router.replace("/(auth)/login");
            } catch (error) {
              console.error("Logout error:", error);
              router.replace("/(auth)/login");
            }
          },
        },
      ]
    );
  };

  const settings: SettingItem[] = [
    {
      icon: "person-outline",
      label: "Edit Profile",
      onPress: () => router.push("/(student)/profile"),
    },
    {
      icon: "key-outline",
      label: "Change Password",
      onPress: () => router.push("/(student)/profile/change-password"),
    },
    {
      icon: "notifications-outline",
      label: "Notification Preferences",
      onPress: () => console.log("Notification settings"),
    },
    {
      icon: "shield-outline",
      label: "Privacy & Security",
      onPress: () => console.log("Privacy settings"),
    },
    {
      icon: "help-circle-outline",
      label: "Help & Support",
      onPress: () => console.log("Help"),
    },
    {
      icon: "information-circle-outline",
      label: "About AIMS",
      onPress: () => console.log("About"),
    },
  ];

  const renderSetting = (item: SettingItem, index: number) => (
    <TouchableOpacity
      key={index}
      style={[styles.settingItem, { borderBottomColor: colors.border }]}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingLeft}>
        <Ionicons name={item.icon} size={22} color={item.color || colors.primary} />
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {item.label}
        </Text>
      </View>
      <Ionicons name="chevron-forward-outline" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            {/* ✅ FIXED: ThemeToggle now takes full width without extra padding */}
            <ThemeToggle />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Settings</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            {settings.map((item, index) => renderSetting(item, index))}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.logoutButton,
            { 
              backgroundColor: `${colors.error}10`,
              borderColor: `${colors.error}30`,
            }
          ]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={[styles.logoutButtonText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>

        <Text style={[styles.versionText, { color: colors.textSecondary }]}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerRight: {
    width: 32,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    // ✅ REMOVED: padding from here - ThemeToggle handles its own padding
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 15,
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.6,
  },
});