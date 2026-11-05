import { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';
import { communicationService, type DeliveryStatus } from '../../../src/services/communication.service';
import { notificationSettingsService, type NotificationSettings, type UpdateNotificationSettingsData } from '../../../src/services/notification-settings.service';
import { registerPushDevice, unregisterPushDevice } from '../../../src/services/push.service';
import { AccountPage, AccountHero, Panel, SectionLabel, ActionButton, ui } from '../../../src/components/account/AccountUI';
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
    ],
  },
];

function phoneRegistrationError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return message || 'Check notification permission and your internet connection, then reconnect this phone.';
}

export default function NotificationPreferencesScreen() {
  const { colors } = useTheme();
  const [delivery, setDelivery] = useState<DeliveryStatus | null>(null);
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
      setDelivery(await communicationService.delivery());
    } catch (error) {
      console.error("Error loading notification settings:", error);
      Alert.alert("Error", "Failed to load notification settings");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;

    let preferenceSaved = false;
    setSaving(true);
    try {
      const updated = await notificationSettingsService.updateSettings({
        [key]: value,
      });
      setSettings(updated);
      preferenceSaved = true;
      if (key === "push_enabled") {
        if (value) Alert.alert("Phone notifications", await registerPushDevice());
        else await unregisterPushDevice();
        setDelivery(await communicationService.delivery());
      }
    } catch (error) {
      console.error("Error updating setting:", error);
      Alert.alert(preferenceSaved ? "Preference saved — phone not connected" : "Unable to save preference",
        preferenceSaved ? phoneRegistrationError(error) : "Please check your connection and try again.");
      await loadSettings();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAll = (enabled: boolean) => {
    if (!settings) return;

    const updates: UpdateNotificationSettingsData = {};
    SETTINGS_SECTIONS.forEach((section) => {
      section.settings.forEach((setting) => {
        updates[setting.key as keyof UpdateNotificationSettingsData] = enabled;
      });
    });

    Alert.alert(
      enabled ? "Enable alert categories" : "Mute alert categories",
      `Apply this to all alert categories? Your in-app inbox, phone registration and email delivery choice are unchanged.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setSaving(true);
            try {
              const updated = await notificationSettingsService.updateSettings(updates);
              setSettings(updated);
              Alert.alert("Success", `Alert categories ${enabled ? "enabled" : "muted"}`);
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


  const toggle = (key: keyof NotificationSettings, label: string, description: string, value: boolean) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 66, paddingVertical: 8 }}>
    <View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14, lineHeight: 21 }}>{label}</Text><Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{description}</Text></View>
    <Switch accessibilityLabel={label} disabled={saving} value={value} onValueChange={v => void handleToggle(key, v)} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#FFFFFF" />
  </View>;
  return <AccountPage title="Notification preferences">
    <AccountHero icon="notifications-outline" title="Updates that matter to you." description="Choose your alerts. Your in-app inbox stays available whenever you need it." label="KEEP IN THE LOOP" />
    {loading ? <Panel><ActivityIndicator color={colors.accent} /><Text style={[ui.description, { color: colors.textSecondary }]}>Loading your preferences…</Text></Panel> : !settings ? <Panel><Text style={[ui.description, { color: colors.textSecondary }]}>Your preferences could not be loaded.</Text><ActionButton title="Try again" secondary onPress={() => void loadSettings()} /></Panel> : <>
      <SectionLabel title="Delivery channels" />
      <Panel>{toggle('push_enabled', 'Phone notifications', 'Receive alerts on your registered phone.', settings.push_enabled)}
        <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, gap: 5 }}><Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 12 }}>{delivery?.push_delivery_enabled ? 'Phone delivery available' : 'Phone delivery unavailable'}</Text><Text style={[ui.description, { color: colors.textSecondary }]}>{delivery?.registered_devices ?? 0} registered devices. Connect this phone after allowing notifications in Android settings.</Text></View>
        <ActionButton title="Connect / reconnect this phone" secondary disabled={!settings.push_enabled || saving} onPress={async () => { setSaving(true); try { Alert.alert('Phone notifications', await registerPushDevice()); setDelivery(await communicationService.delivery()); } catch (error) { Alert.alert('Unable to connect phone', phoneRegistrationError(error)); } finally { setSaving(false); } }} />
      </Panel>
      <Panel><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14 }}>Email updates</Text><Text style={[ui.description, { color: colors.textSecondary, marginTop: 4 }]}>{delivery?.email_configured && delivery.email_delivery_enabled ? (delivery.email_verified ? 'Send optional alerts to your account email.' : 'Email verification is required before email alerts can be enabled.') : 'Email alerts are currently unavailable. Phone alerts and your inbox are separate.'}</Text></View><Switch accessibilityLabel="Email updates" disabled={saving || !delivery || (!delivery.email_enabled && !(delivery.email_configured && delivery.email_delivery_enabled && delivery.email_verified))} value={delivery?.email_enabled ?? false} onValueChange={async value => { setSaving(true); try { await communicationService.email(value); setDelivery(await communicationService.delivery()); } catch { Alert.alert('Unable to save', 'Please retry your email preference.'); } finally { setSaving(false); } }} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#FFFFFF" /></View></Panel>
      <SectionLabel title="Alert categories" hint="Choose the internship activities you want updates about." />
      <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><ActionButton title="Enable all" secondary disabled={saving} onPress={() => handleToggleAll(true)} /></View><View style={{ flex: 1 }}><ActionButton title="Mute all" secondary disabled={saving} onPress={() => handleToggleAll(false)} /></View></View>
      {SETTINGS_SECTIONS.map(section => <View key={section.title} style={{ gap: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name={section.icon} size={18} color={colors.accent} /><Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{section.title}</Text></View><Panel>{section.settings.map((setting, index) => <View key={setting.key} style={index ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>{toggle(setting.key, setting.label, setting.description, settings[setting.key] === true)}</View>)}</Panel></View>)}
      {saving && <Text accessibilityLiveRegion="polite" style={[ui.description, { color: colors.textSecondary }]}>Saving your preferences…</Text>}
    </>}
  </AccountPage>;
}
