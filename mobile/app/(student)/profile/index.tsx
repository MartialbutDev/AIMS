// app/(student)/profile/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";

import { useTheme } from "../../../src/context/ThemeContext";
import { authService } from "../../../src/services/auth.service";
import { SkeletonProfile } from "../../../src/components/common/Skeleton";

interface UserProfile {
  id: string;
  email: string;
  student_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string | null;
}

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      const data = await authService.getCurrentUser();
      setProfile(data);
      setEditFirstName(data.first_name);
      setEditLastName(data.last_name);
      setEditPhone(data.phone || "");
      
      const avatar = await authService.getAvatar();
      console.log('📸 Profile - Avatar URL:', avatar);
      if (avatar) {
        setAvatarUri(avatar);
      }
      
    } catch (error) {
      console.error("Error loading profile:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  const refreshAvatar = async () => {
    const avatar = await authService.getAvatar();
    if (avatar) {
      setAvatarUri(avatar);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const updated = await authService.updateProfile({
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        phone: editPhone.trim() || undefined,
      });
      
      setProfile(updated);
      setEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
      
      await loadProfile();
      
    } catch (error) {
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Please allow access to your photo library");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        
        setUploadingAvatar(true);
        setAvatarUri(uri);
        
        const updatedUser = await authService.uploadAvatar(uri);
        setProfile(updatedUser);
        
        await refreshAvatar();
        
        Alert.alert("Success", "Profile picture updated!");
      }
      
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      Alert.alert("Error", error.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    Alert.alert(
      "Remove Profile Picture",
      "Are you sure you want to remove your profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await authService.deleteAvatar();
              setAvatarUri(null);
              setProfile(prev => prev ? { ...prev, avatar_url: null } : null);
              Alert.alert("Success", "Profile picture removed");
              await loadProfile();
            } catch (error) {
              Alert.alert("Error", "Failed to remove profile picture");
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: async () => {
          await authService.logout();
          router.replace("/(auth)/login");
        }},
      ]
    );
  };

  const handleChangePassword = () => {
    router.push("/(student)/profile/change-password" as any);
  };

  const renderReadOnlyField = (label: string, value: string | null) => (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{value || "Not provided"}</Text>
    </View>
  );

  // ✅ Skeleton Loader
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
        <View style={styles.header}>
          <View style={styles.backButton} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Profile</Text>
          <View style={styles.headerRight} />
        </View>
        <SkeletonProfile />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
        <View style={styles.centerContent}>
          <Ionicons name="person-outline" size={64} color={colors.border} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>Failed to load profile</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={loadProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const fullName = `${profile.first_name} ${profile.last_name}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Profile</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.avatarSection}>
          <TouchableOpacity 
            style={styles.avatarContainer} 
            onPress={handlePickImage}
            disabled={uploadingAvatar}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              {uploadingAvatar ? (
                <ActivityIndicator size="large" color="#FFFFFF" />
              ) : avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
                </Text>
              )}
            </View>
            <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          
          {avatarUri && (
            <TouchableOpacity
              style={[styles.deleteAvatarButton, { backgroundColor: `${colors.error}10` }]}
              onPress={handleDeleteAvatar}
            >
              <Ionicons name="trash-outline" size={14} color={colors.error} />
              <Text style={[styles.deleteAvatarText, { color: colors.error }]}>Remove</Text>
            </TouchableOpacity>
          )}
          
          <Text style={[styles.studentName, { color: colors.textPrimary }]}>{fullName}</Text>
          <Text style={[styles.studentId, { color: colors.textSecondary }]}>ID: {profile.student_id}</Text>
          <Text style={[styles.userRole, { color: colors.primary, backgroundColor: `${colors.primary}10` }]}>
            {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          {editing ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  setEditing(false);
                  setEditFirstName(profile.first_name);
                  setEditLastName(profile.last_name);
                  setEditPhone(profile.phone || "");
                }}
                disabled={saving}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton, { backgroundColor: colors.primary }]}
              onPress={() => setEditing(true)}
            >
              <Ionicons name="create-outline" size={20} color="#FFFFFF" />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Personal Information</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            {editing ? (
              <>
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>First Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                    value={editFirstName}
                    onChangeText={setEditFirstName}
                    placeholder="First name"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Last Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                    value={editLastName}
                    onChangeText={setEditLastName}
                    placeholder="Last name"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Phone</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="Phone number"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                  />
                </View>
              </>
            ) : (
              <>
                {renderReadOnlyField("First Name", profile.first_name)}
                {renderReadOnlyField("Last Name", profile.last_name)}
                {renderReadOnlyField("Phone", profile.phone)}
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account Information</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            {renderReadOnlyField("Student ID", profile.student_id)}
            {renderReadOnlyField("Email", profile.email)}
            {renderReadOnlyField(
              "Role",
              profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
            )}
            {renderReadOnlyField("Verified", profile.is_verified ? "Yes" : "No")}
            {renderReadOnlyField(
              "Joined",
              new Date(profile.created_at).toLocaleDateString()
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account Settings</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="key-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.menuItem} onPress={() => console.log("Privacy Settings")}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="shield-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Privacy Settings</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.menuItem} onPress={() => console.log("Notification Settings")}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="notifications-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Notification Settings</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: `${colors.error}10`, borderColor: `${colors.error}30` }]} 
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={[styles.logoutButtonText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>

        <Text style={[styles.versionText, { color: colors.textSecondary }]}>Version 1.0.0</Text>
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
  errorText: {
    marginTop: 12,
    fontSize: 16,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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
  avatarSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 8,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  deleteAvatarButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    gap: 4,
  },
  deleteAvatarText: {
    fontSize: 12,
    fontWeight: "500",
  },
  studentName: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },
  studentId: {
    fontSize: 14,
    marginTop: 2,
  },
  userRole: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#2563EB",
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#2563EB",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 15,
  },
  input: {
    fontSize: 15,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuItemText: {
    fontSize: 15,
    marginLeft: 12,
  },
  menuDivider: {
    height: 1,
  },
  logoutButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    opacity: 0.6,
  },
});