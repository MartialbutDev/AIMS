// app/(student)/settings/privacy-security.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";
import { authService } from "../../../src/services/auth.service";

interface SettingItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  type: "toggle" | "action" | "danger";
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

export default function PrivacySecurityScreen() {
  const { colors, isDark } = useTheme();

  // State for toggles
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [showProfilePhoto, setShowProfilePhoto] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);

  const handleLogoutAllDevices = () => {
    Alert.alert(
      "Logout All Devices",
      "This will log you out from all devices except this one. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout All",
          style: "destructive",
          onPress: () => {
            Alert.alert("Success", "Logged out from all other devices");
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirm Delete",
              "Please type 'DELETE' to confirm account deletion",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Confirm",
                  style: "destructive",
                  onPress: () => {
                    Alert.alert("Account Deleted", "Your account has been deleted");
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      "Clear App Data",
      "This will clear all locally stored app data. Your account and server data will not be affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Data",
          style: "destructive",
          onPress: () => {
            Alert.alert("Success", "App data cleared successfully");
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      "Export Data",
      "Your data export is being prepared. You will receive a download link via email.",
      [{ text: "OK", style: "default" }]
    );
  };

  const handleChangePassword = () => {
    router.push("/(student)/profile/change-password");
  };

  const sections = [
    {
      title: "Privacy",
      icon: "shield-outline" as keyof typeof Ionicons.glyphMap,
      items: [
        {
          icon: "eye-outline" as keyof typeof Ionicons.glyphMap,
          label: "Show Online Status",
          description: "Allow others to see when you're online",
          type: "toggle" as const,
          value: showOnlineStatus,
          onToggle: setShowOnlineStatus,
        },
        {
          icon: "image-outline" as keyof typeof Ionicons.glyphMap,
          label: "Show Profile Photo",
          description: "Allow others to view your profile photo",
          type: "toggle" as const,
          value: showProfilePhoto,
          onToggle: setShowProfilePhoto,
        },
        {
          icon: "download-outline" as keyof typeof Ionicons.glyphMap,
          label: "Export My Data",
          description: "Download a copy of your personal data",
          type: "action" as const,
          onPress: handleExportData,
        },
      ],
    },
    {
      title: "Security",
      icon: "lock-closed-outline" as keyof typeof Ionicons.glyphMap,
      items: [
        {
          icon: "key-outline" as keyof typeof Ionicons.glyphMap,
          label: "Change Password",
          description: "Update your account password",
          type: "action" as const,
          onPress: handleChangePassword,
        },
        {
          icon: "shield-checkmark-outline" as keyof typeof Ionicons.glyphMap,
          label: "Two-Factor Authentication",
          description: "Add an extra layer of security to your account",
          type: "toggle" as const,
          value: twoFactorAuth,
          onToggle: setTwoFactorAuth,
        },
        {
          icon: "device-phone-outline" as keyof typeof Ionicons.glyphMap,
          label: "Remember This Device",
          description: "Stay logged in on this device",
          type: "toggle" as const,
          value: rememberDevice,
          onToggle: setRememberDevice,
        },
      ],
    },
    {
      title: "Data Management",
      icon: "folder-outline" as keyof typeof Ionicons.glyphMap,
      items: [
        {
          icon: "trash-outline" as keyof typeof Ionicons.glyphMap,
          label: "Clear App Data",
          description: "Remove all locally stored app data",
          type: "action" as const,
          onPress: handleClearData,
        },
        {
          icon: "log-out-outline" as keyof typeof Ionicons.glyphMap,
          label: "Logout All Devices",
          description: "Logout from all active sessions",
          type: "action" as const,
          onPress: handleLogoutAllDevices,
        },
        {
          icon: "person-remove-outline" as keyof typeof Ionicons.glyphMap,
          label: "Delete Account",
          description: "Permanently delete your account and all data",
          type: "danger" as const,
          onPress: handleDeleteAccount,
        },
      ],
    },
  ];

  const renderItem = (item: SettingItem, index: number) => {
    const isLast = index === 0;

    if (item.type === "toggle") {
      return (
        <View
          key={item.label}
          style={[
            styles.itemContainer,
            { borderBottomColor: colors.border },
            !isLast && styles.itemWithBorder,
          ]}
        >
          <View style={styles.itemLeft}>
            <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}10` }]}>
              <Ionicons name={item.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>
                {item.label}
              </Text>
              <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
                {item.description}
              </Text>
            </View>
          </View>
          <Switch
            value={item.value}
            onValueChange={item.onToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={item.value ? "#FFFFFF" : "#F4F3F4"}
          />
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={item.label}
        style={[
          styles.itemContainer,
          { borderBottomColor: colors.border },
          !isLast && styles.itemWithBorder,
        ]}
        onPress={item.onPress}
        activeOpacity={0.7}
      >
        <View style={styles.itemLeft}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  item.type === "danger"
                    ? `${colors.error}15`
                    : `${colors.primary}10`,
              },
            ]}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={item.type === "danger" ? colors.error : colors.primary}
            />
          </View>
          <View style={styles.itemTextContainer}>
            <Text
              style={[
                styles.itemLabel,
                {
                  color:
                    item.type === "danger" ? colors.error : colors.textPrimary,
                },
              ]}
            >
              {item.label}
            </Text>
            <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
              {item.description}
            </Text>
          </View>
        </View>
        <Ionicons
          name={
            item.type === "danger" ? "warning-outline" : "chevron-forward-outline"
          }
          size={20}
          color={item.type === "danger" ? colors.error : colors.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Privacy & Security
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Security Status Card */}
        <View style={[styles.statusCard, { backgroundColor: colors.card }]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIcon, { backgroundColor: `${colors.success}15` }]}>
              <Ionicons name="shield-checkmark" size={24} color={colors.success} />
            </View>
            <View>
              <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
                Account Security
              </Text>
              <Text style={[styles.statusDescription, { color: colors.textSecondary }]}>
                Your account is secure
              </Text>
            </View>
          </View>
          <View style={[styles.statusDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statusStats}>
            <View style={styles.statusStat}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>1</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Active Sessions
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statusStat}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>30d</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Password Age
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statusStat}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>2FA</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Status
              </Text>
            </View>
          </View>
        </View>

        {/* Settings Sections */}
        {sections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon} size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {section.title}
              </Text>
            </View>
            <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
              {section.items.map((item, index) => renderItem(item, index))}
            </View>
          </View>
        ))}

        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerRight: {
    width: 32,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  statusCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusDescription: {
    fontSize: 13,
  },
  statusDivider: {
    height: 1,
    marginVertical: 12,
  },
  statusStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusStat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  sectionCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    paddingHorizontal: 16,
  },
  itemWithBorder: {
    borderBottomWidth: 1,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  itemTextContainer: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  itemDescription: {
    fontSize: 12,
    marginTop: 1,
    opacity: 0.7,
  },
  footerSpacer: {
    height: 20,
  },
});