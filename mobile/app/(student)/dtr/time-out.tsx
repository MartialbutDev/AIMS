// app/(student)/dtr/time-out.tsx
// UPDATED: Time-Out only - records time-out and submits DTR

import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { useTheme } from "../../../src/context/ThemeContext";
import { dtrService } from "../../../src/services/dtr.service";

export default function TimeOutDTRScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [imageOut, setImageOut] = useState<string | null>(null);
  
  // Location state
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // ✅ Get current location
  const getCurrentLocation = async () => {
    try {
      setIsGettingLocation(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for Time-Out verification.');
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
        addressData.name,
        addressData.street,
        addressData.city,
        addressData.region,
      ].filter(Boolean).join(', ');

      setLocation({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        address: address || 'Unknown location',
      });

    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get location. Please try again.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageOut(result.assets[0].uri);
      // Auto-get location when photo is taken
      if (!location) {
        await getCurrentLocation();
      }
    }
  };

  const handleTimeOut = async () => {
    if (!imageOut) {
      Alert.alert("Error", "Please take a Time-Out photo.");
      return;
    }

    if (!location) {
      Alert.alert("Location Required", "Please allow location access for verification.");
      await getCurrentLocation();
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      
      // Use 24-hour format HH:MM:SS
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      formData.append('time_out', timeStr);
      
      // Location
      formData.append('latitude', String(location.latitude));
      formData.append('longitude', String(location.longitude));
      formData.append('location_address', location.address);
      
      // Time-Out image
      formData.append('image_out', {
        uri: imageOut,
        name: 'timeout.jpg',
        type: 'image/jpeg',
      } as any);

      await dtrService.recordTimeOut(id!, formData);
      
      Alert.alert(
        "✅ Time-Out Recorded!",
        `You clocked out at ${timeStr}.\n\n📍 ${location.address}\n\nYour DTR has been submitted for review.`,
        [
          { 
            text: "View DTR", 
            onPress: () => router.replace(`/(student)/dtr/${id}` as any)
          }
        ]
      );
      
      router.replace(`/(student)/dtr/${id}`);
      
    } catch (error: any) {
      console.error('Time-Out error:', error);
      const errorMessage = error.response?.data?.detail || "Failed to record Time-Out. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Time Out</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Time-Out Photo */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            Time-Out Photo <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity 
            style={[styles.cameraBox, { borderColor: colors.border }]} 
            onPress={pickImage}
            activeOpacity={0.8}
          >
            {imageOut ? (
              <Image source={{ uri: imageOut }} style={styles.photoPreview} />
            ) : (
              <>
                <View style={[styles.cameraIconCircle, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="camera-outline" size={32} color={colors.primary} />
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

        {/* Location Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Location <Text style={styles.required}>*</Text></Text>
          {location ? (
            <View style={[styles.locationCard, { backgroundColor: `${colors.success}10`, borderColor: `${colors.success}30` }]}>
              <Ionicons name="location-outline" size={20} color={colors.success} />
              <View style={styles.locationInfo}>
                <Text style={[styles.locationText, { color: colors.textPrimary }]}>
                  📍 {location.address}
                </Text>
                <Text style={[styles.locationCoords, { color: colors.textSecondary }]}>
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.locationButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={getCurrentLocation}
              disabled={isGettingLocation}
            >
              {isGettingLocation ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="location-outline" size={20} color={colors.primary} />
                  <Text style={[styles.locationButtonText, { color: colors.primary }]}>
                    Get Current Location
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary },
            (loading || !imageOut || !location) && styles.submitButtonDisabled,
          ]}
          onPress={handleTimeOut}
          disabled={loading || !imageOut || !location}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.submitButtonContent}>
              <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Clock Out</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Info Note */}
        <View style={[styles.infoNote, { backgroundColor: `${colors.primary}10` }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Your hours will be automatically calculated based on Time-In and Time-Out.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  content: { 
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  required: {
    color: "#EF4444",
  },
  cameraBox: { 
    height: 200, 
    borderWidth: 2, 
    borderStyle: 'dashed', 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 0,
  },
  cameraIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cameraBoxTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  cameraBoxSub: {
    fontSize: 12,
  },
  photoPreview: { 
    width: '100%', 
    height: '100%', 
    borderRadius: 16,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  locationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  locationText: {
    fontSize: 14,
  },
  locationCoords: {
    fontSize: 12,
    marginTop: 2,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  submitButton: { 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 8,
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
  submitButtonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
  },
});