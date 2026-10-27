// app/(student)/dtr/time-out.tsx
// Records Time-Out for a PENDING DTR entry, uploads photo + location, submits for review.

import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { useTheme } from "../../../src/context/ThemeContext";
import { dtrService } from "../../../src/services/dtr.service";

export default function TimeOutDTRScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(false);
  const [imageOut, setImageOut] = useState<string | null>(null);

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // ----- location -----

  const getCurrentLocation = async () => {
    try {
      setIsGettingLocation(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required for Time-Out verification."
        );
        return;
      }

      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const [addressData] = await Location.reverseGeocodeAsync({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
      });

      const address = [
        addressData?.name,
        addressData?.street,
        addressData?.city,
        addressData?.region,
      ]
        .filter(Boolean)
        .join(", ");

      setLocation({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        address: address || "Unknown location",
      });
    } catch (error) {
      console.error("Location error:", error);
      Alert.alert("Error", "Failed to get location. Please try again.");
    } finally {
      setIsGettingLocation(false);
    }
  };

  // ----- camera -----

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera permission is required!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageOut(result.assets[0].uri);
      if (!location) {
        await getCurrentLocation();
      }
    }
  };

  // ----- submit -----

  const handleTimeOut = async () => {
    if (!imageOut) {
      Alert.alert("Error", "Please take a Time-Out photo.");
      return;
    }
    if (!location) {
      Alert.alert(
        "Location Required",
        "Please allow location access for verification."
      );
      await getCurrentLocation();
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

      formData.append("time_out", timeStr);
      formData.append("latitude", String(location.latitude));
      formData.append("longitude", String(location.longitude));
      formData.append("location_address", location.address);

      const fileName = `timeout_${Date.now()}.jpg`;
      const uri =
        Platform.OS === "ios" ? imageOut.replace("file://", "") : imageOut;

      formData.append("image_out", {
        uri,
        name: fileName,
        type: "image/jpeg",
      } as any);

      await dtrService.recordTimeOut(id!, formData);

      Alert.alert(
        "✅ Time-Out Recorded!",
        `You clocked out at ${timeStr}.\n\n📍 ${location.address}\n\nYour DTR has been submitted for review.`,
        [
          {
            text: "View DTR",
            onPress: () => router.replace(`/(student)/dtr/${id}` as any),
          },
        ],
        { cancelable: false }
      );
    } catch (error: any) {
      console.error("Time-Out error:", error);
      const errorMessage =
        error.response?.data?.detail ||
        "Failed to record Time-Out. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && !!imageOut && !!location;

  return (
    // ✅ Plain View — the parent layout handles the top inset.
    //    Same pattern as dtr/[id].tsx, dtr/new.tsx, applications/[id].tsx.
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={colors.background}
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back-outline"
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Time Out
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          // Only pad the BOTTOM so the button clears the home indicator.
          { paddingBottom: 30 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ----- Time-Out Photo ----- */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            Time-Out Photo <Text style={styles.required}>*</Text>
          </Text>

          <TouchableOpacity
            style={[
              styles.cameraBox,
              {
                borderColor: imageOut ? colors.success : colors.border,
                borderStyle: imageOut ? "solid" : "dashed",
                backgroundColor: imageOut ? colors.card : "transparent",
              },
            ]}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            {imageOut ? (
              <>
                <Image source={{ uri: imageOut }} style={styles.photoPreview} />
                <TouchableOpacity
                  style={[
                    styles.retakeButton,
                    { backgroundColor: "rgba(0,0,0,0.6)" },
                  ]}
                  onPress={pickImage}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.retakeText}>Retake</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View
                  style={[
                    styles.cameraIconCircle,
                    { backgroundColor: `${colors.primary}15` },
                  ]}
                >
                  <Ionicons name="camera-outline" size={32} color={colors.accent} />
                </View>
                <Text style={[styles.cameraBoxTitle, { color: colors.textPrimary }]}>
                  Take Time-Out Photo
                </Text>
                <Text style={[styles.cameraBoxSub, { color: colors.textSecondary }]}>
                  Take a photo to verify your time-out
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ----- Location ----- */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            Location <Text style={styles.required}>*</Text>
          </Text>

          {location ? (
            <View
              style={[
                styles.locationCard,
                {
                  backgroundColor: `${colors.success}10`,
                  borderColor: `${colors.success}30`,
                },
              ]}
            >
              <Ionicons name="location-outline" size={20} color={colors.success} />
              <View style={styles.locationInfo}>
                <Text
                  style={[styles.locationText, { color: colors.textPrimary }]}
                  numberOfLines={2}
                >
                  📍 {location.address}
                </Text>
                <Text
                  style={[styles.locationCoords, { color: colors.textSecondary }]}
                >
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </Text>
              </View>
              <TouchableOpacity onPress={getCurrentLocation} hitSlop={8}>
                <Ionicons name="refresh-outline" size={18} color={colors.success} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.locationButton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={getCurrentLocation}
              disabled={isGettingLocation}
              activeOpacity={0.8}
            >
              {isGettingLocation ? (
                <>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text
                    style={[styles.locationButtonText, { color: colors.accent }]}
                  >
                    Getting location…
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color={colors.accent}
                  />
                  <Text
                    style={[styles.locationButtonText, { color: colors.accent }]}
                  >
                    Get Current Location
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ----- Submit ----- */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary },
            !canSubmit && styles.submitButtonDisabled,
          ]}
          onPress={handleTimeOut}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={[styles.submitButtonText, { marginLeft: 8 }]}>
                Clocking out…
              </Text>
            </>
          ) : (
            <View style={styles.submitButtonContent}>
              <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Clock Out</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ----- Info ----- */}
        <View style={[styles.infoNote, { backgroundColor: `${colors.primary}10` }]}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.textSecondary}
          />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Your hours will be automatically calculated based on Time-In and
            Time-Out. Make sure your photo and location match your worksite.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header matches every other detail screen — no extra top padding,
  // the parent layout owns the top inset.
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 12,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  headerRight: { width: 32 },

  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  required: { color: "#EF4444" },

  cameraBox: {
    height: 220,
    borderWidth: 2,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  cameraIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cameraBoxTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  cameraBoxSub: { fontSize: 12 },
  photoPreview: { width: "100%", height: "100%" },
  retakeButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  retakeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },

  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  locationInfo: { flex: 1 },
  locationText: { fontSize: 14 },
  locationCoords: { fontSize: 12, marginTop: 2 },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  locationButtonText: { fontSize: 14, fontWeight: "500" },

  submitButton: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 8,
    minHeight: 54,
  },
  submitButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },

  infoNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  infoText: { fontSize: 12, flex: 1 },
});