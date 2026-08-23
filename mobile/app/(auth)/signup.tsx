// app/(auth)/signup.tsx
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
import { useTheme } from "../../src/context/ThemeContext";
import { authService } from "../../src/services/auth.service";

const { height } = Dimensions.get("window");

export default function SignUpScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [fullNameError, setFullNameError] = useState("");
  const [studentIdError, setStudentIdError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const [isFullNameFocused, setIsFullNameFocused] = useState(false);
  const [isStudentIdFocused, setIsStudentIdFocused] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);

  const studentIdRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateForm = (): boolean => {
    let isValid = true;

    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    if (!fullName.trim()) {
      setFullNameError("Full name is required");
      isValid = false;
    } else if (fullName.trim().length < 2) {
      setFullNameError("Please enter a valid full name");
      isValid = false;
    } else if (!firstName || !lastName) {
      setFullNameError("Please enter both first and last name");
      isValid = false;
    } else {
      setFullNameError("");
    }

    if (!studentId.trim()) {
      setStudentIdError("Student ID is required");
      isValid = false;
    } else if (studentId.trim().length < 8) {
      setStudentIdError("Please enter a valid student ID");
      isValid = false;
    } else {
      setStudentIdError("");
    }

    if (!email.trim()) {
      setEmailError("Email is required");
      isValid = false;
    } else if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError("Please enter a valid email");
      isValid = false;
    } else {
      setEmailError("");
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

    if (!confirmPassword.trim()) {
      setConfirmPasswordError("Please confirm your password");
      isValid = false;
    } else if (password.trim() !== confirmPassword.trim()) {
      setConfirmPasswordError("Passwords do not match");
      isValid = false;
    } else {
      setConfirmPasswordError("");
    }

    return isValid;
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    setLoading(true);
    setSuccess(false);

    try {
      const response = await authService.register({
        email: email.trim(),
        password: password.trim(),
        first_name: firstName,
        last_name: lastName,
        student_id: studentId.trim(),
      });

      console.log('✅ Registration successful:', response);
      setSuccess(true);

      Alert.alert(
        "Registration Successful!",
        "Your account has been created. Please login to continue.",
        [
          {
            text: "Go to Login",
            onPress: () => {
              setFullName("");
              setStudentId("");
              setEmail("");
              setPassword("");
              setConfirmPassword("");
              setSuccess(false);
              router.push("/(auth)/login");
            }
          }
        ]
      );
    } catch (error: any) {
      console.log('❌ Registration error:', error);
      const errorMessage = error.message || "Registration failed. Please try again.";
      Alert.alert("Registration Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    router.push("/(auth)/login");
  };

  const handleFullNameSubmit = () => {
    studentIdRef.current?.focus();
  };

  const handleStudentIdSubmit = () => {
    emailRef.current?.focus();
  };

  const handleEmailSubmit = () => {
    passwordRef.current?.focus();
  };

  const handlePasswordSubmit = () => {
    confirmPasswordRef.current?.focus();
  };

  const handleConfirmPasswordSubmit = () => {
    handleSignUp();
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
                  <Text style={[styles.welcomeText, { color: colors.textPrimary }]}>Create Account</Text>
                  <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>
                    Sign up to get started with your internship
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
                        Account created successfully!{'\n'}
                        Please login to continue.
                      </Text>
                    </View>
                  )}

                  <View style={styles.fieldWrapper}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Full Name</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        { backgroundColor: colors.background, borderColor: colors.border },
                        isFullNameFocused && [styles.inputWrapperFocused, { borderColor: colors.primary }],
                        fullNameError ? [styles.inputWrapperError, { borderColor: colors.error }] : null,
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={isFullNameFocused ? colors.primary : colors.textSecondary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[styles.input, { color: colors.textPrimary }]}
                        placeholder="Enter your full name"
                        placeholderTextColor={colors.textTertiary}
                        value={fullName}
                        onChangeText={(text) => {
                          setFullName(text);
                          if (fullNameError) setFullNameError("");
                        }}
                        onFocus={() => setIsFullNameFocused(true)}
                        onBlur={() => setIsFullNameFocused(false)}
                        returnKeyType="next"
                        onSubmitEditing={handleFullNameSubmit}
                        autoCorrect={false}
                        editable={!loading}
                        accessibilityLabel="Full Name"
                      />
                    </View>
                    {fullNameError ? <Text style={[styles.errorText, { color: colors.error }]}>{fullNameError}</Text> : null}
                  </View>

                  <View style={styles.fieldWrapper}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Student ID</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        { backgroundColor: colors.background, borderColor: colors.border },
                        isStudentIdFocused && [styles.inputWrapperFocused, { borderColor: colors.primary }],
                        studentIdError ? [styles.inputWrapperError, { borderColor: colors.error }] : null,
                      ]}
                    >
                      <Ionicons
                        name="school-outline"
                        size={20}
                        color={isStudentIdFocused ? colors.primary : colors.textSecondary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        ref={studentIdRef}
                        style={[styles.input, { color: colors.textPrimary }]}
                        placeholder="Enter your student ID"
                        placeholderTextColor={colors.textTertiary}
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
                    {studentIdError ? <Text style={[styles.errorText, { color: colors.error }]}>{studentIdError}</Text> : null}
                  </View>

                  <View style={styles.fieldWrapper}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Email</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        { backgroundColor: colors.background, borderColor: colors.border },
                        isEmailFocused && [styles.inputWrapperFocused, { borderColor: colors.primary }],
                        emailError ? [styles.inputWrapperError, { borderColor: colors.error }] : null,
                      ]}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color={isEmailFocused ? colors.primary : colors.textSecondary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        ref={emailRef}
                        style={[styles.input, { color: colors.textPrimary }]}
                        placeholder="Enter your email"
                        placeholderTextColor={colors.textTertiary}
                        value={email}
                        onChangeText={(text) => {
                          setEmail(text);
                          if (emailError) setEmailError("");
                        }}
                        onFocus={() => setIsEmailFocused(true)}
                        onBlur={() => setIsEmailFocused(false)}
                        returnKeyType="next"
                        onSubmitEditing={handleEmailSubmit}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        editable={!loading}
                        accessibilityLabel="Email"
                      />
                    </View>
                    {emailError ? <Text style={[styles.errorText, { color: colors.error }]}>{emailError}</Text> : null}
                  </View>

                  <View style={styles.fieldWrapper}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Password</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        { backgroundColor: colors.background, borderColor: colors.border },
                        isPasswordFocused && [styles.inputWrapperFocused, { borderColor: colors.primary }],
                        passwordError ? [styles.inputWrapperError, { borderColor: colors.error }] : null,
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={isPasswordFocused ? colors.primary : colors.textSecondary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        ref={passwordRef}
                        style={[styles.input, { color: colors.textPrimary }]}
                        placeholder="Enter your password"
                        placeholderTextColor={colors.textTertiary}
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                          if (passwordError) setPasswordError("");
                          if (confirmPasswordError) setConfirmPasswordError("");
                        }}
                        onFocus={() => setIsPasswordFocused(true)}
                        onBlur={() => setIsPasswordFocused(false)}
                        returnKeyType="next"
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
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                    {passwordError ? <Text style={[styles.errorText, { color: colors.error }]}>{passwordError}</Text> : null}
                  </View>

                  <View style={styles.fieldWrapper}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Confirm Password</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        { backgroundColor: colors.background, borderColor: colors.border },
                        isConfirmPasswordFocused && [styles.inputWrapperFocused, { borderColor: colors.primary }],
                        confirmPasswordError ? [styles.inputWrapperError, { borderColor: colors.error }] : null,
                      ]}
                    >
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={20}
                        color={isConfirmPasswordFocused ? colors.primary : colors.textSecondary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        ref={confirmPasswordRef}
                        style={[styles.input, { color: colors.textPrimary }]}
                        placeholder="Confirm your password"
                        placeholderTextColor={colors.textTertiary}
                        secureTextEntry={!showConfirmPassword}
                        value={confirmPassword}
                        onChangeText={(text) => {
                          setConfirmPassword(text);
                          if (confirmPasswordError) setConfirmPasswordError("");
                        }}
                        onFocus={() => setIsConfirmPasswordFocused(true)}
                        onBlur={() => setIsConfirmPasswordFocused(false)}
                        returnKeyType="done"
                        onSubmitEditing={handleConfirmPasswordSubmit}
                        textContentType="password"
                        autoComplete="password"
                        editable={!loading}
                        accessibilityLabel="Confirm Password"
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword((prev) => !prev)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        <Ionicons
                          name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                    {confirmPasswordError ? <Text style={[styles.errorText, { color: colors.error }]}>{confirmPasswordError}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.signUpButton, loading && styles.signUpButtonDisabled, { backgroundColor: colors.primary }]}
                    onPress={handleSignUp}
                    disabled={loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: loading, busy: loading }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={styles.signUpButtonContent}>
                        <Ionicons
                          name="person-add-outline"
                          size={20}
                          color="#FFFFFF"
                          style={styles.signUpButtonIcon}
                        />
                        <Text style={[styles.signUpButtonText, { color: '#FFFFFF' }]}>Create Account</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.loginContainer}>
                    <Text style={[styles.loginText, { color: colors.textSecondary }]}>
                      Already have an account?
                    </Text>
                    <TouchableOpacity
                      onPress={handleLogin}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.loginLink, { color: colors.primary }]}> Login</Text>
                    </TouchableOpacity>
                  </View>
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
    marginBottom: 20,
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
    marginBottom: 16,
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

  signUpButton: {
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
    marginTop: 4,
  },

  signUpButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },

  signUpButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  signUpButtonIcon: {
    marginRight: 8,
  },

  signUpButtonText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },

  loginText: {
    fontSize: 14,
  },

  loginLink: {
    fontSize: 14,
    fontWeight: "700",
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