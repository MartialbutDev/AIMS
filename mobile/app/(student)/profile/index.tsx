// app/(student)/profile/index.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
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

import Colors from "../../../src/theme/colors";

interface ProfileData {
  firstName: string;
  lastName: string;
  studentId: string;
  email: string;
  phone: string;
  course: string;
  yearLevel: string;
  department: string;
  address: string;
  bio: string;
}

const mockProfile: ProfileData = {
  firstName: "Juan",
  lastName: "Dela Cruz",
  studentId: "2022-00001",
  email: "juan.delacruz@university.edu",
  phone: "+63 912 3456 789",
  course: "BS Computer Science",
  yearLevel: "4th Year",
  department: "College of Information Technology",
  address: "123 University Ave, Manila, Philippines",
  bio: "Passionate software engineering intern with interest in mobile development.",
};

export default function ProfileScreen() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileData>(mockProfile);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: () => {
          console.log("Logging out...");
          router.replace("/(auth)/login");
        }},
      ]
    );
  };

  const handleChangePassword = () => {
    router.push("/(student)/profile/change-password" as any);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      console.log("Selected image:", result.assets[0].uri);
    }
  };

  const renderEditableField = (
    label: string,
    value: string,
    setValue: (text: string) => void,
    keyboardType: "default" | "email-address" | "phone-pad" = "default",
    multiline: boolean = false
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing ? (
        <TextInput
          style={[styles.input, multiline && styles.textArea]}
          value={value}
          onChangeText={setValue}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
        />
      ) : (
        <Text style={styles.fieldValue}>{value || "Not provided"}</Text>
      )}
    </View>
  );

  const renderReadOnlyField = (label: string, value: string) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
              </Text>
            </View>
            <View style={styles.avatarBadge}>
              <Ionicons name="camera-outline" size={16} color={Colors.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.studentName}>{profile.firstName} {profile.lastName}</Text>
          <Text style={styles.studentId}>ID: {profile.studentId}</Text>
        </View>

        {/* Edit/Save Buttons */}
        <View style={styles.actionButtons}>
          {editing ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => setEditing(false)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color={Colors.white} />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => setEditing(true)}
            >
              <Ionicons name="create-outline" size={20} color={Colors.white} />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.sectionCard}>
            {renderEditableField(
              "First Name",
              profile.firstName,
              (text) => setProfile({ ...profile, firstName: text })
            )}
            {renderEditableField(
              "Last Name",
              profile.lastName,
              (text) => setProfile({ ...profile, lastName: text })
            )}
            {renderEditableField(
              "Phone",
              profile.phone,
              (text) => setProfile({ ...profile, phone: text }),
              "phone-pad"
            )}
            {renderEditableField(
              "Bio",
              profile.bio,
              (text) => setProfile({ ...profile, bio: text }),
              "default",
              true
            )}
          </View>
        </View>

        {/* Academic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Academic Information</Text>
          <View style={styles.sectionCard}>
            {renderReadOnlyField("Student ID", profile.studentId)}
            {renderReadOnlyField("Email", profile.email)}
            {renderReadOnlyField("Course", profile.course)}
            {renderReadOnlyField("Year Level", profile.yearLevel)}
            {renderReadOnlyField("Department", profile.department)}
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          <View style={styles.sectionCard}>
            {renderEditableField(
              "Address",
              profile.address,
              (text) => setProfile({ ...profile, address: text }),
              "default",
              true
            )}
          </View>
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="key-outline" size={22} color={Colors.primary} />
                <Text style={styles.menuItemText}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={() => console.log("Privacy Settings")}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="shield-outline" size={22} color={Colors.primary} />
                <Text style={styles.menuItemText}>Privacy Settings</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={() => console.log("Notification Settings")}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
                <Text style={styles.menuItemText}>Notification Settings</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.textPrimary,
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
    marginBottom: 12,
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 36,
    fontWeight: "700",
    color: Colors.white,
  },

  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.white,
  },

  studentName: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  studentId: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
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
    backgroundColor: Colors.primary,
  },

  editButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },

  cancelButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },

  saveButton: {
    backgroundColor: Colors.primary,
  },

  saveButtonText: {
    color: Colors.white,
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
    color: Colors.textPrimary,
    marginBottom: 8,
  },

  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  fieldContainer: {
    marginBottom: 12,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
    marginBottom: 4,
  },

  fieldValue: {
    fontSize: 15,
    color: Colors.textPrimary,
  },

  input: {
    fontSize: 15,
    color: Colors.textPrimary,
    padding: 8,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
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
    color: Colors.textPrimary,
    marginLeft: 12,
  },

  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  logoutButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: `${Colors.error}10`,
    borderWidth: 1,
    borderColor: `${Colors.error}30`,
    marginBottom: 12,
  },

  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
    marginLeft: 10,
  },

  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: Colors.textSecondary,
    opacity: 0.6,
  },
});