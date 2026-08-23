// app/(auth)/forgot-password.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AppLogo from "../../src/components/common/AppLogo";
import { APP_NAME, APP_VERSION } from "../../src/constants/app";
import { useTheme } from "../../src/context/ThemeContext";

const { height } = Dimensions.get("window");

export default function ForgotPasswordScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const validateForm = (): boolean => {
    if (!studentId.trim()) {
      setError("Student ID is required");
      return false;
    } else if (studentId.trim().length < 8) {
      setError("Please enter a valid student ID");
      return false;
    } else {
      setError("");
      return true;
    }
  };

  const handleSendResetLink = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      console.log({ studentId: studentId.trim() });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSuccess(true);
      setStudentId("");
    } catch (error) {
      console.log(error);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={[
        styles.navySection,
        { backgroundColor: isDark ? "#000066" : "#000080" }
      ]}>
        <View style={styles.circleTopLeft} pointerEvents="none" />
        <View style={styles.circleBottomRight} pointerEvents="none" />
        <View style={styles.dotGridTopRight} pointerEvents="none">
          {Array.from({ length: 16 }).map((_, i) => (
            <View key={`dot-tr-${i}`} style={styles.dot} />
          ))}
        </View>
        <View style={styles.dotGridBottomLeft} pointerEvents="none">
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={`dot-bl-${i}`} style={styles.dot} />
          ))}
        </View>
      </View>

      {/* ✅ Dark Mode Toggle Button - OUTSIDE the navy section */}
      <TouchableOpacity
        style={[
          styles.themeToggle,
          {
            backgroundColor: isDark
              ? "rgba(0,0,0,0.5)"
              : "rgba(255,255,255,0.2)",
          },
        ]}
        onPress={toggleTheme}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isDark ? "sunny-outline" : "moon-outline"}
          size={24}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }]}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerContent}>
              <View style={styles.logoWrapper}>
                <AppLogo size={100} decorative={true} variant="login" />
              </View>
              <Text style={[styles.brandTitle, { color: '#FFFFFF' }]}>
                A<Text style={[styles.brandTitleAccent, { color: "#F5A623" }]}>I</Text>MS
              </Text>
              <Text style={[styles.systemTitle, { color: '#FFFFFF', opacity: 0.9 }]}>
                Academic Internship Management System
              </Text>
            </View>

            <View style={styles.cardWrapper}>
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.welcomeText, { color: colors.textPrimary }]}>Reset Password</Text>
                  <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>
                    Enter your student ID to receive a password reset link
                  </Text>
                </View>

                <View style={styles.formContainer}>
                  {success && (
                    <View style={[styles.successContainer, { backgroundColor: `${colors.success}15`, borderColor: `${colors.success}30` }]}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={24}
                        color={colors.success}
                        style={styles.successIcon}
                      />
                      <Text style={[styles.successText, { color: colors.textPrimary }]}>
                        Reset link sent successfully!{'\n'}
                        Please check your email for instructions.
                      </Text>
                    </View>
                  )}

                  <View style={styles.fieldWrapper}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Student ID</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        { backgroundColor: colors.background, borderColor: colors.border },
                        isFocused && [styles.inputWrapperFocused, { borderColor: colors.primary }],
                        error ? [styles.inputWrapperError, { borderColor: colors.error }] : null,
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={isFocused ? colors.primary : colors.textSecondary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[styles.input, { color: colors.textPrimary }]}
                        placeholder="Enter your student ID"
                        placeholderTextColor={colors.textTertiary}
                        value={studentId}
                        onChangeText={(text) => {
                          setStudentId(text);
                          if (error) setError("");
                          if (success) setSuccess(false);
                        }}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        returnKeyType="done"
                        onSubmitEditing={handleSendResetLink}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        editable={!loading}
                        accessibilityLabel="Student ID"
                      />
                    </View>
                    {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.resetButton, loading && styles.resetButtonDisabled, { backgroundColor: colors.primary }]}
                    onPress={handleSendResetLink}
                    disabled={loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: loading, busy: loading }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={styles.resetButtonContent}>
                        <Ionicons
                          name="send-outline"
                          size={20}
                          color="#FFFFFF"
                          style={styles.resetButtonIcon}
                        />
                        <Text style={[styles.resetButtonText, { color: '#FFFFFF' }]}>Send Reset Link</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.backContainer}
                    onPress={handleBackToLogin}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="arrow-back-outline"
                      size={18}
                      color={colors.primary}
                      style={styles.backIcon}
                    />
                    <Text style={[styles.backText, { color: colors.primary }]}>Back to Login</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={[styles.footer, { backgroundColor: colors.background }]}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                © {new Date().getFullYear()} {APP_NAME}
              </Text>
              <Text style={[styles.versionText, { color: colors.textSecondary }]}>{APP_VERSION}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  navySection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.40,
    overflow: 'hidden',
  },

  themeToggle: {
    position: "absolute",
    top: 55,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    zIndex: 999,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  circleTopLeft: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },

  circleBottomRight: {
    position: 'absolute',
    bottom: -80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },

  dotGridTopRight: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 64,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  dotGridBottomLeft: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    width: 52,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    margin: 4,
  },

  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },

  headerContent: {
    paddingTop: 20,
    paddingBottom: 10,
    paddingHorizontal: 30,
    alignItems: "center",
    minHeight: height * 0.28,
  },

  logoWrapper: {
    marginBottom: 2,
  },

  brandTitle: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 2,
  },

  brandTitleAccent: {
    color: "#F5A623",
  },

  systemTitle: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  cardWrapper: {
    paddingHorizontal: 24,
    marginTop: -30,
  },

  card: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 30,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 12,
  },

  cardHeader: {
    marginBottom: 24,
  },

  welcomeText: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 4,
  },

  subtitleText: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
  },

  formContainer: {
    width: "100%",
  },

  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },

  successIcon: {
    marginRight: 12,
  },

  successText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },

  fieldWrapper: {
    marginBottom: 18,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },

  inputWrapperFocused: {
    borderWidth: 1.5,
  },

  inputWrapperError: {
    borderColor: '#EF4444',
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    fontSize: 15,
  },

  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },

  resetButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 6,
    marginBottom: 16,
  },

  resetButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },

  resetButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  resetButtonIcon: {
    marginRight: 8,
  },

  resetButtonText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  backContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
  },

  backIcon: {
    marginRight: 6,
  },

  backText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 16,
    alignItems: "center",
    gap: 3,
  },

  footerText: {
    fontSize: 11,
    fontWeight: "400",
    letterSpacing: 0.2,
    textAlign: "center",
    opacity: 0.8,
  },

  versionText: {
    fontSize: 10,
    letterSpacing: 0.2,
    opacity: 0.7,
  },
});