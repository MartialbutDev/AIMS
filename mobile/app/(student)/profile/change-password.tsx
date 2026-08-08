// app/(student)/profile/change-password.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";
import { profileService } from "../../../src/services/profile.service";

export default function ChangePasswordScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [currentError, setCurrentError] = useState("");
  const [newError, setNewError] = useState("");
  const [confirmError, setConfirmError] = useState("");

  const validateForm = (): boolean => {
    let isValid = true;

    if (!currentPassword.trim()) {
      setCurrentError("Current password is required");
      isValid = false;
    } else {
      setCurrentError("");
    }

    if (!newPassword.trim()) {
      setNewError("New password is required");
      isValid = false;
    } else if (newPassword.trim().length < 6) {
      setNewError("Password must be at least 6 characters");
      isValid = false;
    } else {
      setNewError("");
    }

    if (!confirmPassword.trim()) {
      setConfirmError("Please confirm your password");
      isValid = false;
    } else if (newPassword.trim() !== confirmPassword.trim()) {
      setConfirmError("Passwords do not match");
      isValid = false;
    } else {
      setConfirmError("");
    }

    return isValid;
  };

  const handleChangePassword = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await profileService.changePassword(currentPassword.trim(), newPassword.trim());
      
      Alert.alert(
        "Success",
        "Password changed successfully!",
        [
          { text: "OK", onPress: () => router.back() }
        ]
      );
      
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
    } catch (error: any) {
      console.error('Change password error:', error);
      const errorMessage = error.response?.data?.detail || "Failed to change password. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Change Password</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.infoCard, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}>
          <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textPrimary }]}>
            Password must be at least 6 characters long
          </Text>
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Current Password</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }, currentError && styles.inputWrapperError]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder="Enter current password"
              placeholderTextColor={colors.textSecondary}
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                if (currentError) setCurrentError("");
              }}
              secureTextEntry={!showCurrentPassword}
            />
            <TouchableOpacity
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {currentError ? <Text style={[styles.errorText, { color: colors.error }]}>{currentError}</Text> : null}
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>New Password</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }, newError && styles.inputWrapperError]}>
            <Ionicons name="key-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder="Enter new password"
              placeholderTextColor={colors.textSecondary}
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (newError) setNewError("");
              }}
              secureTextEntry={!showNewPassword}
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword(!showNewPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {newError ? <Text style={[styles.errorText, { color: colors.error }]}>{newError}</Text> : null}
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Confirm Password</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }, confirmError && styles.inputWrapperError]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (confirmError) setConfirmError("");
              }}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {confirmError ? <Text style={[styles.errorText, { color: colors.error }]}>{confirmError}</Text> : null}
        </View>

        <TouchableOpacity
          style={[
            styles.changeButton,
            { backgroundColor: colors.primary },
            loading && styles.changeButtonDisabled,
          ]}
          onPress={handleChangePassword}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#FFFFFF" />
              <Text style={styles.changeButtonText}>Change Password</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: 16,
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
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 13,
    marginLeft: 10,
    flex: 1,
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
  changeButton: {
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 8,
  },
  changeButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  changeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});