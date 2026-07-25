// app/(auth)/login.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { authService } from "../../src/services/auth.service";

const { height } = Dimensions.get("window");

export default function LoginScreen() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [studentIdError, setStudentIdError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isStudentIdFocused, setIsStudentIdFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const passwordInputRef = useRef<TextInput>(null);

  const validateForm = (): boolean => {
    let isValid = true;

    if (!studentId.trim()) {
      setStudentIdError("Student ID is required");
      isValid = false;
    } else if (studentId.trim().length < 8) {
      setStudentIdError("Please enter a valid student ID");
      isValid = false;
    } else {
      setStudentIdError("");
    }

    if (!password.trim()) {
      setPasswordError("Password is required");
      isValid = false;
    } else if (password.trim().length < 6) {
      setPasswordError("Password must be at least 6 characters");
      isValid = false;
    } else {
      setPasswordError("");
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // 🔥 REAL BACKEND API CALL - NOT MOCK!
      const response = await authService.login(studentId.trim(), password);
      
      console.log('Login successful:', response);
      
      // Navigate to dashboard
      router.replace("/(student)/dashboard");
    } catch (error: any) {
      console.log('Login error:', error);
      
      // Show error message from backend
      const errorMessage = error.response?.data?.detail || "Invalid credentials. Please try again.";
      Alert.alert("Login Failed", errorMessage);
      
      // Clear password field on error
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push("/(auth)/forgot-password");
  };

  const handleSignUp = () => {
    router.push("/(auth)/signup");
  };

  const handleStudentIdSubmit = () => {
    passwordInputRef.current?.focus();
  };

  const handlePasswordSubmit = () => {
    handleLogin();
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
                  <Text style={styles.welcomeText}>Welcome Back!</Text>
                  <Text style={styles.subtitleText}>
                    Sign in to continue to your account
                  </Text>
                </View>

                <View style={styles.formContainer}>
                  <View style={styles.fieldWrapper}>
                    <Text style={styles.fieldLabel}>Student ID</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        isStudentIdFocused && styles.inputWrapperFocused,
                        studentIdError ? styles.inputWrapperError : null,
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={isStudentIdFocused ? Colors.primary : "#8A8A8A"}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your student ID"
                        placeholderTextColor="#A0A0A0"
                        value={studentId}
                        onChangeText={(text) => {
                          setStudentId(text);
                          if (studentIdError) setStudentIdError("");
                        }}
                        onFocus={() => setIsStudentIdFocused(true)}
                        onBlur={() => setIsStudentIdFocused(false)}
                        returnKeyType="next"
                        onSubmitEditing={handleStudentIdSubmit}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        editable={!loading}
                        accessibilityLabel="Student ID"
                      />
                    </View>
                    {studentIdError ? <Text style={styles.errorText}>{studentIdError}</Text> : null}
                  </View>

                  <View style={styles.fieldWrapper}>
                    <Text style={styles.fieldLabel}>Password</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        isPasswordFocused && styles.inputWrapperFocused,
                        passwordError ? styles.inputWrapperError : null,
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={isPasswordFocused ? Colors.primary : "#8A8A8A"}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        ref={passwordInputRef}
                        style={styles.input}
                        placeholder="Enter your password"
                        placeholderTextColor="#A0A0A0"
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                          if (passwordError) setPasswordError("");
                        }}
                        onFocus={() => setIsPasswordFocused(true)}
                        onBlur={() => setIsPasswordFocused(false)}
                        returnKeyType="done"
                        onSubmitEditing={handlePasswordSubmit}
                        textContentType="password"
                        autoComplete="password"
                        editable={!loading}
                        accessibilityLabel="Password"
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword((prev) => !prev)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      >
                        <Ionicons
                          name={showPassword ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color="#8A8A8A"
                        />
                      </TouchableOpacity>
                    </View>
                    {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={styles.forgotContainer}
                    onPress={handleForgotPassword}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: loading, busy: loading }}
                  >
                    {loading ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <View style={styles.loginButtonContent}>
                        <Ionicons
                          name="log-in-outline"
                          size={20}
                          color={Colors.white}
                          style={styles.loginButtonIcon}
                        />
                        <Text style={styles.loginButtonText}>Login</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.dividerContainer}>
                  </View>

                  <View style={styles.securityContainer}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color={Colors.primary}
                      style={styles.securityIcon}
                    />
                    <View style={styles.securityTextContainer}>
                      <Text style={styles.securityText}>Secure & Trusted</Text>
                      <Text style={styles.securitySubtext}>
                        Your data is encrypted and protected with industry-standard security
                      </Text>
                    </View>
                  </View>

                  <View style={styles.signUpContainer}>
                    <Text style={styles.signUpText}>
                      Don't have an account?
                    </Text>
                    <TouchableOpacity
                      onPress={handleSignUp}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.signUpLink}> Sign Up</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.signUpSubtext}>
                    Create an account to get started.
                  </Text>
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

  // Decorative circles
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

  // Decorative dot grids
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

  forgotContainer: {
    alignSelf: "flex-end",
    marginTop: -6,
    marginBottom: 20,
    paddingVertical: 4,
  },

  forgotText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  loginButton: {
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
  },

  loginButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },

  loginButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  loginButtonIcon: {
    marginRight: 8,
  },

  loginButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 16,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },

  dividerText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.5,
  },

  securityContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  securityIcon: {
    marginRight: 12,
    marginTop: 1,
  },

  securityTextContainer: {
    flex: 1,
  },

  securityText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 2,
  },

  securitySubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    opacity: 0.8,
  },

  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },

  signUpText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  signUpLink: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },

  signUpSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    opacity: 0.7,
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