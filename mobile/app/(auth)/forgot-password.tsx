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
import Colors from "../../src/theme/colors";

const { height } = Dimensions.get("window");

export default function ForgotPasswordScreen() {
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
      // API call to send reset link
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
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Navy Blue Background - Top Section (Absolute) */}
      <View style={styles.navySection}>
        {/* Decorative circles */}
        <View style={styles.circleTopLeft} pointerEvents="none" />
        <View style={styles.circleBottomRight} pointerEvents="none" />

        {/* Decorative dot grids */}
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

      {/* Content on top of everything */}
      <SafeAreaView style={styles.safeArea}>
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
            {/* Header Content - on Navy Background */}
            <View style={styles.headerContent}>
              <View style={styles.logoWrapper}>
                <AppLogo size={100} decorative={true} variant="login" />
              </View>
              <Text style={styles.brandTitle}>
                A<Text style={styles.brandTitleAccent}>I</Text>MS
              </Text>
              <Text style={styles.systemTitle}>Academic Internship Management System</Text>
            </View>

            {/* Floating Card - Overlaps the navy section */}
            <View style={styles.cardWrapper}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.welcomeText}>Reset Password</Text>
                  <Text style={styles.subtitleText}>
                    Enter your student ID to receive a password reset link
                  </Text>
                </View>

                <View style={styles.formContainer}>
                  {/* Success Message */}
                  {success && (
                    <View style={styles.successContainer}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={24}
                        color={Colors.success}
                        style={styles.successIcon}
                      />
                      <Text style={styles.successText}>
                        Reset link sent successfully!{'\n'}
                        Please check your email for instructions.
                      </Text>
                    </View>
                  )}

                  <View style={styles.fieldWrapper}>
                    <Text style={styles.fieldLabel}>Student ID</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        isFocused && styles.inputWrapperFocused,
                        error ? styles.inputWrapperError : null,
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={isFocused ? Colors.primary : "#8A8A8A"}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your student ID"
                        placeholderTextColor="#A0A0A0"
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
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.resetButton, loading && styles.resetButtonDisabled]}
                    onPress={handleSendResetLink}
                    disabled={loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: loading, busy: loading }}
                  >
                    {loading ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <View style={styles.resetButtonContent}>
                        <Ionicons
                          name="send-outline"
                          size={20}
                          color={Colors.white}
                          style={styles.resetButtonIcon}
                        />
                        <Text style={styles.resetButtonText}>Send Reset Link</Text>
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
                      color={Colors.primary}
                      style={styles.backIcon}
                    />
                    <Text style={styles.backText}>Back to Login</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                © {new Date().getFullYear()} {APP_NAME}
              </Text>
              <Text style={styles.versionText}>{APP_VERSION}</Text>
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
    backgroundColor: Colors.background,
  },

  navySection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.40,
    backgroundColor: Colors.primary,
    overflow: 'hidden',
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
    color: Colors.white,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 2,
  },

  brandTitleAccent: {
    color: "#F5A623",
  },

  systemTitle: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    letterSpacing: 0.5,
    opacity: 0.9,
    marginBottom: 10,
  },

  cardWrapper: {
    paddingHorizontal: 24,
    marginTop: -30,
  },

  card: {
    backgroundColor: Colors.white,
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
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },

  subtitleText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.2,
  },

  formContainer: {
    width: "100%",
  },

  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${Colors.success}15`,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${Colors.success}30`,
  },

  successIcon: {
    marginRight: 12,
  },

  successText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },

  fieldWrapper: {
    marginBottom: 18,
  },

  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 6,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },

  inputWrapperFocused: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },

  inputWrapperError: {
    borderColor: Colors.error,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },

  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },

  resetButton: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.primary,
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
    color: Colors.white,
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
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  footer: {
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 16,
    alignItems: "center",
    gap: 3,
  },

  footerText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "400",
    letterSpacing: 0.2,
    textAlign: "center",
    opacity: 0.8,
  },

  versionText: {
    fontSize: 10,
    color: "#9CA3AF",
    letterSpacing: 0.2,
    opacity: 0.7,
  },
});