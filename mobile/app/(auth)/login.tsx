
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AppLogo from "../../src/components/common/AppLogo";
import AuthLegalLinks from "../../src/components/auth/AuthLegalLinks";

import {
  APP_NAME,
  APP_VERSION,
} from "../../src/constants/app";

import { useTheme } from "../../src/context/ThemeContext";

import { authService } from "../../src/services/auth.service";



export default function LoginScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const contentWidth = Math.min(width, 520);
  const compact = width < 360 || fontScale > 1.2;
  const submittingRef = useRef(false);

  // ============================================================
  // FORM STATES
  // ============================================================

  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ============================================================
  // VALIDATION STATES
  // ============================================================

  const [studentIdError, setStudentIdError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // ============================================================
  // INPUT FOCUS STATES
  // ============================================================

  const [isStudentIdFocused, setIsStudentIdFocused] =
    useState(false);

  const [isPasswordFocused, setIsPasswordFocused] =
    useState(false);

  const passwordInputRef = useRef<TextInput>(null);

  // ============================================================
  // FORM VALIDATION
  // ============================================================

  const validateForm = (): boolean => {
    let isValid = true;

    const trimmedStudentId = studentId.trim();

    if (!trimmedStudentId) {
      setStudentIdError("Student ID is required");
      isValid = false;
    } else if (trimmedStudentId.length < 8) {
      setStudentIdError("Please enter a valid student ID");
      isValid = false;
    } else {
      setStudentIdError("");
    }

    if (!password.trim()) {
      setPasswordError("Password is required");
      isValid = false;
    } else if (password.trim().length < 6) {
      setPasswordError(
        "Password must be at least 6 characters"
      );
      isValid = false;
    } else {
      setPasswordError("");
    }

    return isValid;
  };

  // ============================================================
  // STUDENT LOGIN
  // ============================================================

  const handleLogin = async () => {
    if (submittingRef.current) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    let signedIn = false;

    try {
      // Authenticate student using existing AIMS backend.
      // authService.login must save the access token
      // to SecureStore before this promise resolves.

      await authService.login(
        studentId.trim(),
        password
      );

      // ========================================================
      // MANDATORY STUDENT ONBOARDING
      // ========================================================
      //
      // Do not redirect directly to the dashboard.
      //
      // The onboarding screen calls:
      //
      // GET /api/v1/onboarding/me
      //
      // If eligible = false:
      //   Student remains in onboarding.
      //
      // If eligible = true:
      //   Student is redirected to the dashboard.
      //
      // This also works for returning students whose
      // documents have already been approved.
      // ========================================================

      router.replace("/onboarding");
      signedIn = true;
    } catch (error: any) {

      let errorMessage =
        "Invalid credentials. Please try again.";

      const detail = error?.response?.data?.detail;

      if (typeof detail === "string") {
        errorMessage = detail;
      } else if (
        typeof error?.message === "string" &&
        !error?.response
      ) {
        errorMessage = error.message;
      }

      Alert.alert(
        "Login Failed",
        errorMessage
      );

      setPassword("");
    } finally {
      if (!signedIn) { submittingRef.current = false; setLoading(false); }
    }
  };

  // ============================================================
  // AUTHENTICATION NAVIGATION
  // ============================================================

  const handleForgotPassword = () => {
    router.push("/(auth)/forgot-password");
  };

  const handleSignUp = () => {
    router.push("/(auth)/signup");
  };

  // ============================================================
  // KEYBOARD ACTIONS
  // ============================================================

  const handleStudentIdSubmit = () => {
    passwordInputRef.current?.focus();
  };

  const handlePasswordSubmit = () => {
    void handleLogin();
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <StatusBar
        style={isDark ? "light" : "dark"}
      />

      {/* ===================================================== */}
      {/* NAVY HEADER BACKGROUND                                */}
      {/* ===================================================== */}

      <View
        style={[
          styles.navySection,
          { height: Math.max(300, Math.min(contentWidth * 0.9, 420)) },
          {
            backgroundColor: "#0B0B2F",
          },
        ]}
      >
        <View
          style={styles.circleTopLeft}
          pointerEvents="none"
        />

        <View
          style={styles.circleBottomRight}
          pointerEvents="none"
        />

        <View
          style={styles.dotGridTopRight}
          pointerEvents="none"
        >
          {Array.from(
            { length: 16 },
            (_, i) => (
              <View
                key={`dot-tr-${i}`}
                style={styles.dot}
              />
            )
          )}
        </View>

        <View
          style={styles.dotGridBottomLeft}
          pointerEvents="none"
        >
          {Array.from(
            { length: 12 },
            (_, i) => (
              <View
                key={`dot-bl-${i}`}
                style={styles.dot}
              />
            )
          )}
        </View>
      </View>

      {/* ===================================================== */}
      {/* DARK MODE TOGGLE                                      */}
      {/* ===================================================== */}

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
        accessibilityRole="button"
        accessibilityLabel={
          isDark
            ? "Switch to light mode"
            : "Switch to dark mode"
        }
      >
        <Ionicons
          name={
            isDark
              ? "sunny-outline"
              : "moon-outline"
          }
          size={24}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      {/* ===================================================== */}
      {/* SAFE AREA                                             */}
      {/* ===================================================== */}

      <SafeAreaView
        style={[
          styles.safeArea,
          {
            backgroundColor: "transparent",
          },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              styles.scrollContent
            }
            bounces={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* ================================================= */}
            {/* APP BRANDING                                      */}
            {/* ================================================= */}

            <View style={[styles.headerContent, { minHeight: Math.max(220, Math.min(contentWidth * 0.58, 280)), paddingHorizontal: compact ? 20 : 30 }]}>
              <View style={styles.logoWrapper}>
                <AppLogo
                  size={100}
                  decorative={true}
                  variant="login"
                />
              </View>

              <Text
                style={[
                  styles.brandTitle,
                  {
                    color: "#FFFFFF",
                  },
                ]}
              >
                A
                <Text
                  style={[
                    styles.brandTitleAccent,
                    {
                      color: "#F5A623",
                    },
                  ]}
                >
                  I
                </Text>
                MS
              </Text>

              <Text
                style={[
                  styles.systemTitle,
                  {
                    color: "#FFFFFF",
                    opacity: 0.9,
                  },
                ]}
              >
                Academic Internship Management System
              </Text>
            </View>

            {/* ================================================= */}
            {/* LOGIN CARD                                        */}
            {/* ================================================= */}

            <View style={[styles.cardWrapper, { paddingHorizontal: compact ? 16 : 24 }]}>
              <View
                style={[
                  styles.card,
                  { paddingHorizontal: compact ? 16 : 24 },
                  {
                    backgroundColor: colors.card,
                  },
                ]}
              >
                {/* ============================================= */}
                {/* CARD HEADER                                   */}
                {/* ============================================= */}

                <View style={styles.cardHeader}>
                  <Text
                    style={[
                      styles.welcomeText,
                      {
                        color: colors.textPrimary,
                      },
                    ]}
                  >
                    Welcome Back!
                  </Text>

                  <Text
                    style={[
                      styles.subtitleText,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    Sign in to continue to your account
                  </Text>
                </View>

                {/* ============================================= */}
                {/* LOGIN FORM                                    */}
                {/* ============================================= */}

                <View style={styles.formContainer}>
                  {/* =========================================== */}
                  {/* STUDENT ID                                  */}
                  {/* =========================================== */}

                  <View style={styles.fieldWrapper}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        {
                          color: colors.textPrimary,
                        },
                      ]}
                    >
                      Student ID
                    </Text>

                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor:
                            colors.background,
                          borderColor:
                            colors.border,
                        },

                        isStudentIdFocused && [
                          styles.inputWrapperFocused,
                          {
                            borderColor:
                              colors.primary,
                          },
                        ],

                        studentIdError
                          ? [
                              styles.inputWrapperError,
                              {
                                borderColor:
                                  colors.error,
                              },
                            ]
                          : null,
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={
                          isStudentIdFocused
                            ? colors.primary
                            : colors.textSecondary
                        }
                        style={styles.inputIcon}
                      />

                      <TextInput
                        style={[
                          styles.input,
                          {
                            color:
                              colors.textPrimary,
                          },
                        ]}
                        placeholder="Enter your student ID"
                        placeholderTextColor={
                          colors.textTertiary
                        }
                        value={studentId}
                        onChangeText={(text) => {
                          setStudentId(text);

                          if (studentIdError) {
                            setStudentIdError("");
                          }
                        }}
                        onFocus={() =>
                          setIsStudentIdFocused(true)
                        }
                        onBlur={() =>
                          setIsStudentIdFocused(false)
                        }
                        returnKeyType="next"
                        onSubmitEditing={
                          handleStudentIdSubmit
                        }
                        autoCapitalize="none"
                        textContentType="username"
                        autoComplete="username"
                        autoCorrect={false}
                        editable={!loading}
                        accessibilityLabel="Student ID"
                      />
                    </View>

                    {studentIdError ? (
                      <Text
                        style={[
                          styles.errorText,
                          {
                            color: colors.error,
                          },
                        ]}
                      >
                        {studentIdError}
                      </Text>
                    ) : null}
                  </View>

                  {/* =========================================== */}
                  {/* PASSWORD                                    */}
                  {/* =========================================== */}

                  <View style={styles.fieldWrapper}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        {
                          color: colors.textPrimary,
                        },
                      ]}
                    >
                      Password
                    </Text>

                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor:
                            colors.background,
                          borderColor:
                            colors.border,
                        },

                        isPasswordFocused && [
                          styles.inputWrapperFocused,
                          {
                            borderColor:
                              colors.primary,
                          },
                        ],

                        passwordError
                          ? [
                              styles.inputWrapperError,
                              {
                                borderColor:
                                  colors.error,
                              },
                            ]
                          : null,
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={
                          isPasswordFocused
                            ? colors.primary
                            : colors.textSecondary
                        }
                        style={styles.inputIcon}
                      />

                      <TextInput
                        ref={passwordInputRef}
                        style={[
                          styles.input,
                          {
                            color:
                              colors.textPrimary,
                          },
                        ]}
                        placeholder="Enter your password"
                        placeholderTextColor={
                          colors.textTertiary
                        }
                        secureTextEntry={
                          !showPassword
                        }
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);

                          if (passwordError) {
                            setPasswordError("");
                          }
                        }}
                        onFocus={() =>
                          setIsPasswordFocused(true)
                        }
                        onBlur={() =>
                          setIsPasswordFocused(false)
                        }
                        returnKeyType="done"
                        onSubmitEditing={
                          handlePasswordSubmit
                        }
                        textContentType="password"
                        autoComplete="current-password"
                        editable={!loading}
                        accessibilityLabel="Password"
                      />

                      {/* ======================================= */}
                      {/* SHOW / HIDE PASSWORD                    */}
                      {/* ======================================= */}

                      <TouchableOpacity
                        onPress={() =>
                          setShowPassword(
                            (prev) => !prev
                          )
                        }
                        hitSlop={{
                          top: 10,
                          bottom: 10,
                          left: 10,
                          right: 10,
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        <Ionicons
                          name={
                            showPassword
                              ? "eye-off-outline"
                              : "eye-outline"
                          }
                          size={20}
                          color={
                            colors.textSecondary
                          }
                        />
                      </TouchableOpacity>
                    </View>

                    {passwordError ? (
                      <Text
                        style={[
                          styles.errorText,
                          {
                            color: colors.error,
                          },
                        ]}
                      >
                        {passwordError}
                      </Text>
                    ) : null}
                  </View>

                  {/* =========================================== */}
                  {/* FORGOT PASSWORD                             */}
                  {/* =========================================== */}

                  <TouchableOpacity
                    style={
                      styles.forgotContainer
                    }
                    onPress={
                      handleForgotPassword
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.forgotText,
                        {
                          color: colors.accent,
                        },
                      ]}
                    >
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>

                  {/* =========================================== */}
                  {/* LOGIN BUTTON                                */}
                  {/* =========================================== */}

                  <TouchableOpacity
                    style={[
                      styles.loginButton,

                      loading &&
                        styles.loginButtonDisabled,

                      {
                        backgroundColor:
                          colors.primary,
                      },
                    ]}
                    onPress={() =>
                      void handleLogin()
                    }
                    disabled={loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: loading,
                      busy: loading,
                    }}
                  >
                    {loading ? (
                      <ActivityIndicator
                        color="#FFFFFF"
                      />
                    ) : (
                      <View
                        style={
                          styles.loginButtonContent
                        }
                      >
                        <Ionicons
                          name="log-in-outline"
                          size={20}
                          color="#FFFFFF"
                          style={
                            styles.loginButtonIcon
                          }
                        />

                        <Text
                          style={[
                            styles.loginButtonText,
                            {
                              color:
                                "#FFFFFF",
                            },
                          ]}
                        >
                          Login
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* =========================================== */}
                  {/* SIGN UP                                     */}
                  {/* =========================================== */}

                  <View
                    style={
                      styles.signUpContainer
                    }
                  >
                    <Text
                      style={[
                        styles.signUpText,
                        {
                          color:
                            colors.textSecondary,
                        },
                      ]}
                    >
                      Don&apos;t have an account?
                    </Text>

                    <TouchableOpacity
                      onPress={
                        handleSignUp
                      }
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.signUpLink,
                          {
                            color: colors.accent,
                          },
                        ]}
                      >
                        {" "}
                        Sign Up
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text
                    style={[
                      styles.signUpSubtext,
                      {
                        color:
                          colors.textSecondary,
                      },
                    ]}
                  >
                    Create an account to get started.
                  </Text>
                </View>
              </View>
            </View>

            {/* ================================================= */}
            {/* FOOTER                                            */}
            {/* ================================================= */}

            <View
              style={[
                styles.footer,
                {
                  backgroundColor:
                    colors.background,
                },
              ]}
            >
              <Text
                style={[
                  styles.footerText,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                © {new Date().getFullYear()} {APP_NAME}
              </Text>
              <AuthLegalLinks disabled={loading} />

              <Text
                style={[
                  styles.versionText,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                {APP_VERSION}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  navySection: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 360,
    overflow: "hidden",
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 8,
  },

  circleTopLeft: {
    position: "absolute",
    top: -60,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor:
      "rgba(255, 255, 255, 0.05)",
  },

  circleBottomRight: {
    position: "absolute",
    bottom: -80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor:
      "rgba(255, 255, 255, 0.05)",
  },

  dotGridTopRight: {
    position: "absolute",
    top: 16,
    right: 20,
    width: 64,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  dotGridBottomLeft: {
    position: "absolute",
    bottom: 16,
    left: 20,
    width: 52,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor:
      "rgba(255, 255, 255, 0.18)",
    margin: 4,
  },

  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingBottom: 20,
  },

  headerContent: {
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 30,
    alignItems: "center",
    minHeight: 220,
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
    minHeight: 50,
  },

  inputWrapperFocused: {
    borderWidth: 1.5,
  },

  inputWrapperError: {
    borderColor: "#EF4444",
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

  forgotContainer: {
    alignSelf: "flex-end",
    marginTop: -6,
    marginBottom: 20,
    paddingVertical: 4,
  },

  forgotText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  loginButton: {
    minHeight: 52,
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
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },

  signUpText: {
    fontSize: 14,
  },

  signUpLink: {
    fontSize: 14,
    fontWeight: "700",
  },

  signUpSubtext: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    opacity: 0.7,
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
