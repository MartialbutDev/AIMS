// app/(student)/notifications/preferences.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Switch,
} from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";
import {
  notificationSettingsService,
  NotificationSettings,
} from "../../../src/services/notification-settings.service";

interface SettingSection {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  settings: {
    key: keyof NotificationSettings;
    label: string;
    description: string;
  }[];
}

const SETTINGS_SECTIONS: SettingSection[] = [
  {
    title: "Applications",
    icon: "briefcase-outline",
    settings: [
      {
        key: "application_updates",
        label: "Application Updates",
        description: "Receive updates when your application is reviewed",
      },
      {
        key: "application_status_changes",
        label: "Status Changes",
        description: "Get notified when your application status changes",
      },
    ],
  },
  {
    title: "DTR",
    icon: "calendar-outline",
    settings: [
      {
        key: "dtr_reminders",
        label: "DTR Reminders",
        description: "Reminders to submit your daily time records",
      },
      {
        key: "dtr_approvals",
        label: "DTR Approvals",
        description: "Get notified when your DTR is approved",
      },
      {
        key: "dtr_rejections",
        label: "DTR Rejections",
        description: "Get notified when your DTR is rejected",
      },
    ],
  },
  {
    title: "Journals",
    icon: "book-outline",
    settings: [
      {
        key: "journal_reminders",
        label: "Journal Reminders",
        description: "Reminders to submit your weekly journals",
      },
      {
        key: "journal_feedback",
        label: "Journal Feedback",
        description: "Get notified when you receive journal feedback",
      },
      {
        key: "journal_approvals",
        label: "Journal Approvals",
        description: "Get notified when your journal is approved",
      },
    ],
  },
  {
    title: "Documents",
    icon: "document-text-outline",
    settings: [
      {
        key: "document_verifications",
        label: "Document Verifications",
        description: "Get notified when your documents are verified",
      },
      {
        key: "document_reminders",
        label: "Document Reminders",
        description: "Reminders to upload required documents",
      },
    ],
  },
  {
    title: "General",
    icon: "settings-outline",
    settings: [
      {
        key: "system_announcements",
        label: "System Announcements",
        description: "Important system announcements and updates",
      },
      {
        key: "weekly_summaries",
        label: "Weekly Summaries",
        description: "Weekly summary of your internship progress",
      },
    ],
  },
];

export default function NotificationPreferencesScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await notificationSettingsService.getSettings();
      setSettings(data);
    } catch (error) {
      console.error("Error loading notification settings:", error);
      Alert.alert("Error", "Failed to load notification settings");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;

    setSaving(true);
    try {
      const updated = await notificationSettingsService.updateSettings({
        [key]: value,
      });
      setSettings(updated);
    } catch (error) {
      console.error("Error updating setting:", error);
      Alert.alert("Error", "Failed to update notification setting");
      await loadSettings();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      "Reset Settings",
      "Are you sure you want to reset all notification settings to defaults?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await notificationSettingsService.resetSettings();
              await loadSettings();
              Alert.alert("Success", "Settings reset to defaults");
            } catch (error) {
              Alert.alert("Error", "Failed to reset settings");
            }
          },
        },
      ]
    );
  };

  const handleToggleAll = (enabled: boolean) => {
    if (!settings) return;

    const updates: any = {};
    SETTINGS_SECTIONS.forEach((section) => {
      section.settings.forEach((setting) => {
        updates[setting.key] = enabled;
      });
    });

    Alert.alert(
      enabled ? "Enable All Notifications" : "Disable All Notifications",
      `Are you sure you want to ${enabled ? "enable" : "disable"} all notifications?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setSaving(true);
            try {
              const updated = await notificationSettingsService.updateSettings(updates);
              setSettings(updated);
              Alert.alert("Success", `All notifications ${enabled ? "enabled" : "disabled"}`);
            } catch (error) {
              Alert.alert("Error", "Failed to update settings");
              await loadSettings();
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const renderSettingItem = (
    key: keyof NotificationSettings,
    label: string,
    description: string,
    value: boolean
  ) => (
    <View key={key} style={[styles.settingItem, { borderBottomColor: colors.border }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={(newValue) => handleToggle(key, newValue)}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? "#FFFFFF" : "#F4F3F4"}
        disabled={saving}
      />
    </View>
  );

  const renderSection = (section: SettingSection) => {
    if (!settings) return null;

    const allEnabled = section.settings.every(
      (s) => settings[s.key as keyof NotificationSettings] === true
    );

    return (
      <View key={section.title} style={[styles.section, { backgroundColor: colors.card }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name={section.icon} size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {section.title}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              section.settings.forEach((s) => {
                handleToggle(s.key as keyof NotificationSettings, !allEnabled);
              });
            }}
            disabled={saving}
          >
            <Text style={[styles.sectionToggleAll, { color: colors.primary }]}>
              {allEnabled ? "Disable All" : "Enable All"}
            </Text>
          </TouchableOpacity>
        </View>
        {section.settings.map((s) =>
          renderSettingItem(
            s.key as keyof NotificationSettings,
            s.label,
            s.description,
            settings[s.key as keyof NotificationSettings] as boolean
          )
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading settings...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Notification Preferences
        </Text>
        <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
          <Ionicons name="refresh-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Push Notifications Toggle */}
        <View style={[styles.pushSection, { backgroundColor: colors.card }]}>
          <View style={styles.pushSectionLeft}>
            <View style={[styles.pushIcon, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="notifications" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.pushLabel, { color: colors.textPrimary }]}>
                Push Notifications
              </Text>
              <Text style={[styles.pushDescription, { color: colors.textSecondary }]}>
                Enable or disable all push notifications
              </Text>
            </View>
          </View>
          <Switch
            value={settings?.push_enabled ?? true}
            onValueChange={(value) => handleToggle("push_enabled", value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={settings?.push_enabled ? "#FFFFFF" : "#F4F3F4"}
            disabled={saving}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleToggleAll(true)}
            disabled={saving}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
            <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>
              Enable All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleToggleAll(false)}
            disabled={saving}
          >
            <Ionicons name="ban-outline" size={20} color="#EF4444" />
            <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>
              Disable All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleReset}
            disabled={saving}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>
              Reset
            </Text>
          </TouchableOpacity>
        </View>

        {/* Settings Sections */}
        {SETTINGS_SECTIONS.map(renderSection)}

        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
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
  resetButton: {
    padding: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  pushSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pushSectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pushIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  pushLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  pushDescription: {
    fontSize: 12,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  quickAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  sectionToggleAll: {
    fontSize: 13,
    fontWeight: "500",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    opacity: 0.7,
  },
  footerSpacer: {
    height: 20,
  },
});