// app/(student)/settings/app-settings.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
// ✅ Use legacy import for FileSystem
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../../../src/context/ThemeContext";

interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "fil", name: "Filipino", flag: "🇵🇭" },
  { code: "ceb", name: "Cebuano", flag: "🇵🇭" },
  { code: "hil", name: "Hiligaynon", flag: "🇵🇭" },
  { code: "war", name: "Waray", flag: "🇵🇭" },
];

export default function AppSettingsScreen() {
  const { colors, isDark } = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheSize, setCacheSize] = useState("0 MB");

  useEffect(() => {
    loadLanguagePreference();
    getCacheSize();
  }, []);

  const loadLanguagePreference = async () => {
    try {
      const saved = await AsyncStorage.getItem("app_language");
      if (saved) {
        setSelectedLanguage(saved);
      }
    } catch (error) {
      console.error("Error loading language:", error);
    }
  };

  const getCacheSize = async () => {
    try {
      // ✅ Use FileSystem.cacheDirectory from legacy import
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const files = await FileSystem.readDirectoryAsync(cacheDir);
        let totalSize = 0;
        for (const file of files) {
          const info = await FileSystem.getInfoAsync(cacheDir + file);
          if (info.exists && info.size) {
            totalSize += info.size;
          }
        }
        const sizeMB = totalSize / (1024 * 1024);
        setCacheSize(sizeMB > 0 ? `${sizeMB.toFixed(2)} MB` : "0 MB");
      }
    } catch (error) {
      console.error("Error getting cache size:", error);
      setCacheSize("0 MB");
    }
  };

  const handleLanguageSelect = async (language: LanguageOption) => {
    try {
      await AsyncStorage.setItem("app_language", language.code);
      setSelectedLanguage(language.code);
      setShowLanguageModal(false);
      Alert.alert(
        "Language Updated",
        `App language has been set to ${language.name}. Restart the app for full effect.`
      );
    } catch (error) {
      console.error("Error saving language:", error);
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      "Clear Cache",
      "This will clear all temporary files and cached data. Your account and settings will not be affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Cache",
          style: "destructive",
          onPress: async () => {
            setClearingCache(true);
            try {
              const cacheDir = FileSystem.cacheDirectory;
              if (cacheDir) {
                const files = await FileSystem.readDirectoryAsync(cacheDir);
                for (const file of files) {
                  const filePath = cacheDir + file;
                  const info = await FileSystem.getInfoAsync(filePath);
                  if (info.exists) {
                    await FileSystem.deleteAsync(filePath);
                  }
                }
              }
              setCacheSize("0 MB");
              Alert.alert("Success", "Cache cleared successfully!");
            } catch (error) {
              console.error("Error clearing cache:", error);
              Alert.alert("Error", "Failed to clear cache. Please try again.");
            } finally {
              setClearingCache(false);
            }
          },
        },
      ]
    );
  };

  // ✅ Updated: Navigate to full Terms page
  const handleTermsPress = () => {
    router.push("/(student)/settings/terms" as any);
  };

  // ✅ Updated: Navigate to full Privacy Policy page
  const handlePrivacyPress = () => {
    router.push("/(student)/settings/privacy-policy" as any);
  };

  const getSelectedLanguageName = () => {
    const lang = LANGUAGES.find(l => l.code === selectedLanguage);
    return lang ? `${lang.flag} ${lang.name}` : "🇺🇸 English";
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          App Settings
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        {/* Language Selection */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Language
          </Text>
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={() => setShowLanguageModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="language-outline" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                  Language
                </Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Choose your preferred language
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: colors.textPrimary }]}>
                {getSelectedLanguageName()}
              </Text>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Storage */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Storage
          </Text>
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={handleClearCache}
            disabled={clearingCache}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: `${colors.warning}15` }]}>
                <Ionicons name="trash-outline" size={22} color={colors.warning} />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                  Clear Cache
                </Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  {clearingCache ? "Clearing..." : `${cacheSize} cached`}
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              {clearingCache ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward-outline" size={20} color={colors.textSecondary} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Legal - Updated with navigation to full pages */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Legal
          </Text>
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={handleTermsPress}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="document-text-outline" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                  Terms & Conditions
                </Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Read our terms of service
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={handlePrivacyPress}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="shield-outline" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                  Privacy Policy
                </Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Read our privacy policy
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            About
          </Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                  Version
                </Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  AIMS v1.0.0
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="build-outline" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                  Build
                </Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  #1.0.0 (2026.08.28)
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Select Language
              </Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close-outline" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  {
                    backgroundColor:
                      selectedLanguage === lang.code
                        ? `${colors.primary}15`
                        : "transparent",
                    borderColor:
                      selectedLanguage === lang.code
                        ? colors.primary
                        : colors.border,
                  },
                ]}
                onPress={() => handleLanguageSelect(lang)}
                activeOpacity={0.7}
              >
                <Text style={styles.languageFlag}>{lang.flag}</Text>
                <Text style={[styles.languageName, { color: colors.textPrimary }]}>
                  {lang.name}
                </Text>
                {selectedLanguage === lang.code && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  settingDescription: {
    fontSize: 12,
    opacity: 0.7,
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  languageOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageName: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  footerSpacer: {
    height: 20,
  },
});