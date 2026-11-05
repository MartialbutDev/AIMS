import { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../src/context/ThemeContext';
import { authService } from '../../../src/services/auth.service';
import { profileService } from '../../../src/services/profile.service';
import { AccountPage, AccountHero, Panel, ActionButton, ui } from '../../../src/components/account/AccountUI';
export default function ChangePasswordScreen() {
  const { colors } = useTheme();
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
        "Password changed. Sign in again with your new password.",
        [
          { text: "OK", onPress: () => { void authService.logout().finally(() => router.replace("/(auth)/login")); } }
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


  const fields = [
    { label: 'Current password', value: currentPassword, set: setCurrentPassword, visible: showCurrentPassword, toggle: () => setShowCurrentPassword(!showCurrentPassword), error: currentError, clear: () => setCurrentError('') },
    { label: 'New password', value: newPassword, set: setNewPassword, visible: showNewPassword, toggle: () => setShowNewPassword(!showNewPassword), error: newError, clear: () => setNewError('') },
    { label: 'Confirm new password', value: confirmPassword, set: setConfirmPassword, visible: showConfirmPassword, toggle: () => setShowConfirmPassword(!showConfirmPassword), error: confirmError, clear: () => setConfirmError('') },
  ];
  return <AccountPage title="Change password">
    <AccountHero icon="key-outline" title="A fresh layer of protection." description="Choose a password you haven’t used for this account before." label="ACCOUNT SECURITY" />
    <Panel>{fields.map((field, index) => <View key={field.label} style={{ marginBottom: 8 }}>
      <Text style={[ui.label, { color: colors.textPrimary }]}>{field.label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: field.error ? colors.error : colors.border, backgroundColor: colors.inputBackground, paddingLeft: 14 }}>
        <Ionicons name={index === 0 ? 'lock-closed-outline' : 'key-outline'} size={19} color={colors.textSecondary} />
        <TextInput accessibilityLabel={field.label} editable={!loading} value={field.value} onChangeText={value => { field.set(value); field.clear(); }} secureTextEntry={!field.visible} autoCapitalize="none" autoCorrect={false} textContentType={index === 0 ? 'password' : 'newPassword'} autoComplete={index === 0 ? 'current-password' : 'new-password'} placeholder={field.label} placeholderTextColor={colors.textTertiary} style={{ flex: 1, minHeight: 54, paddingHorizontal: 10, color: colors.textPrimary, fontSize: 14 }} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${field.visible ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`} onPress={field.toggle} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={field.visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} /></TouchableOpacity>
      </View>
      {!!field.error && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 12, marginTop: 7 }}>{field.error}</Text>}
    </View>)}</Panel>
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 4 }}><Ionicons name="information-circle-outline" size={18} color={colors.accent} /><Text style={[ui.description, { flex: 1, color: colors.textSecondary }]}>Use at least 6 characters. After changing your password, sign in again with the new one.</Text></View>
    <ActionButton title={loading ? 'Updating password…' : 'Update password'} busy={loading} onPress={() => void handleChangePassword()} />
  </AccountPage>;
}
