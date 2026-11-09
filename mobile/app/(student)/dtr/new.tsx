import { assessLocationAccuracy } from '../../../src/utils/locationAccuracy';
import { LocationAccuracyNotice, confirmAttendanceLocation } from '../../../src/components/LocationAccuracyNotice';
// app/(student)/dtr/new.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { useTheme } from "../../../src/context/ThemeContext";
import { dtrService } from "../../../src/services/dtr.service";

export default function NewDTRScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);


  const [tasks, setTasks] = useState("");
  const [notes, setNotes] = useState("");
  const [imageIn, setImageIn] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
    accuracy: number | null;
    capturedAt: string;
  } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const submissionInFlight = useRef(false);
  const captureInFlight = useRef(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureToken, setCaptureToken] = useState<string | null>(null);
  const locationNeedsCaution = Boolean(location && assessLocationAccuracy(location.accuracy).caution);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDateForAPI = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeForAPI = (d: Date) => {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const getCurrentLocation = async () => {
    if (isGettingLocation || submissionInFlight.current) return;
    try {
      setIsGettingLocation(true);
      setLocation(null);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for DTR verification.');
        return;
      }

      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      let address = 'Address unavailable';
      try {
        const [addressData] = await Location.reverseGeocodeAsync({ latitude: locationData.coords.latitude, longitude: locationData.coords.longitude });
        address = [addressData?.name, addressData?.street, addressData?.city, addressData?.region].filter(Boolean).join(', ') || address;
      } catch {
        // Coordinates remain useful when a street-address lookup is unavailable.
      }

      setLocation({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        address,
        accuracy: locationData.coords.accuracy,
        capturedAt: new Date(locationData.timestamp ?? Date.now()).toISOString(),
      });

    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get location. Please try again.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const pickImage = async () => {
    if (captureInFlight.current || submissionInFlight.current) return;
    captureInFlight.current = true;
    setIsCapturing(true);
    try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required for Time-In verification.');
      return;
    }

    setCaptureToken(null);
    setImageIn(null);
    setLocation(null);
    let ticket: { capture_token: string };
    try { ticket = await dtrService.beginCapture('in'); }
    catch { Alert.alert('Capture unavailable', 'Check your connection and active deployment, then try again.'); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      cameraType: ImagePicker.CameraType.front,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setCaptureToken(ticket.capture_token);
      setImageIn(result.assets[0].uri);
      await getCurrentLocation();
    }
    } catch { Alert.alert('Camera unavailable', 'Allow camera access and try taking your selfie again.'); }
    finally { captureInFlight.current = false; setIsCapturing(false); }
  };

  const handleTimeIn = async () => {
    if (submissionInFlight.current || captureInFlight.current || isGettingLocation) return;
    if (!imageIn) {
      Alert.alert("Time-In Selfie Required", "Please take your Time-In verification photo first.");
      return;
    }

    if (!location) {
      Alert.alert("Location Required", "Please allow location access for verification.");
      await getCurrentLocation();
      return;
    }

    if (!captureToken || Date.now() - new Date(location.capturedAt).getTime() > 5 * 60 * 1000) {
      Alert.alert('Capture expired', 'Take a new selfie and capture your current location before submitting.'); return;
    }
    submissionInFlight.current = true;
    setIsSubmitting(true);
    try {
      if (!await confirmAttendanceLocation(location.accuracy)) return;
      const clockInTime = new Date();
      const formData = new FormData();
      formData.append('capture_token', captureToken);
      formData.append('location_captured_at', location.capturedAt);
      if (location.accuracy != null) formData.append('accuracy', String(location.accuracy));
      formData.append('date', formatDateForAPI(clockInTime));
      formData.append('time_in', formatTimeForAPI(clockInTime));
      if (tasks.trim()) formData.append('tasks_completed', tasks.trim());
      if (notes.trim()) formData.append('notes', notes.trim());
      
      formData.append('latitude', String(location.latitude));
      formData.append('longitude', String(location.longitude));
      formData.append('location_address', location.address);

      const imageInName = imageIn.split('/').pop() || 'image_in.jpg';
      // @ts-ignore
      formData.append('image_in', {
        uri: Platform.OS === 'ios' ? imageIn.replace('file://', '') : imageIn,
        type: 'image/jpeg',
        name: imageInName,
      });

      const response = await dtrService.createDTR(formData);
      
      Alert.alert(
        "✅ Time-In Recorded!",
        `You clocked in at ${formatTime(clockInTime)}.\n\n📍 ${location.address}\n\nYou can now Time-Out when your shift is done.`,
        [
          { 
            text: "View DTR", 
            onPress: () => router.push(`/(student)/dtr/${response.id}` as any)
          },
          { 
            text: "OK", 
            style: "default" 
          }
        ]
      );
      
      setTasks("");
      setNotes("");
      setImageIn(null);
      setLocation(null);
      
      router.push("/(student)/dtr");
      
    } catch (error: any) {
      console.error('Time-In error:', error);
      const errorMessage = error.response?.data?.detail || "Failed to record Time-In. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Time In</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Clock-in time</Text>
          <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>The server records your current date and time when submitted. Use a time-correction request for mistakes; past dates cannot be clocked in here.</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Time-In Selfie <Text style={styles.required}>*</Text></Text>
          {!imageIn ? (
            <TouchableOpacity
              style={[styles.cameraBox, { borderColor: colors.border, backgroundColor: colors.card }]}
              disabled={isCapturing}
              onPress={pickImage}
              activeOpacity={0.8}
            >
              <View style={[styles.cameraIconCircle, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="camera-outline" size={32} color={colors.accent} />
              </View>
              <Text style={[styles.cameraBoxTitle, { color: colors.textPrimary }]}>Take Time-In Selfie</Text>
              <Text style={[styles.cameraBoxSub, { color: colors.textSecondary }]}>Take a photo to verify your time-in</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.photoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Image source={{ uri: imageIn }} style={styles.photoPreview} />
              <View style={styles.photoInfo}>
                <View style={styles.photoStatusBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.photoStatusText}>Photo captured</Text>
                </View>
                <TouchableOpacity
                  style={[styles.retakeButton, { borderColor: colors.border }]}
                  disabled={isCapturing}
              onPress={pickImage}
                >
                  <Ionicons name="refresh-outline" size={14} color={colors.accent} />
                  <Text style={[styles.retakeText, { color: colors.accent }]}>Retake</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Location <Text style={styles.required}>*</Text></Text>
          {location ? (
            <View style={[styles.locationCard, { backgroundColor: `${(locationNeedsCaution ? colors.warning : colors.success)}10`, borderColor: `${(locationNeedsCaution ? colors.warning : colors.success)}30` }]}>
              <Ionicons name="location-outline" size={20} color={(locationNeedsCaution ? colors.warning : colors.success)} />
              <View style={styles.locationInfo}>
                <Text style={[styles.locationText, { color: colors.textPrimary }]}>📍 {location.address}</Text>
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
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <Ionicons name="location-outline" size={20} color={colors.accent} />
                  <Text style={[styles.locationButtonText, { color: colors.accent }]}>Get Current Location</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {location && <LocationAccuracyNotice accuracy={location.accuracy} />}
          {location && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Capture location again" onPress={getCurrentLocation} disabled={isGettingLocation || isSubmitting} style={{ paddingVertical: 12 }}><Text style={{ color: colors.accent, fontWeight: '600' }}>Capture location again</Text></TouchableOpacity>}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Tasks Completed</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="List the tasks you plan to complete today..."
            placeholderTextColor={colors.textSecondary}
            value={tasks}
            onChangeText={setTasks}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Notes (Optional)</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Any additional notes..."
            placeholderTextColor={colors.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary },
            (!imageIn || !location || isSubmitting || isGettingLocation) && styles.submitButtonDisabled,
          ]}
          onPress={handleTimeIn}
          disabled={!imageIn || !location || isSubmitting || isGettingLocation}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.submitButtonContent}>
              <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={styles.submitButtonIcon} />
              <Text style={styles.submitButtonText}>Clock In</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={[styles.infoNote, { backgroundColor: `${colors.primary}10` }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>After clocking in, you can record your Time-Out later.</Text>
        </View>
      </ScrollView>
    </View>
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
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  timeNowButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeNowText: {
    fontSize: 12,
    fontWeight: "500",
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  pickerText: {
    flex: 1,
    fontSize: 15,
    marginHorizontal: 12,
  },
  cameraBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
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
  photoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  photoInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  photoStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  photoStatusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
    marginLeft: 6,
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  retakeText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
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
  textArea: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 90,
    borderWidth: 1,
    textAlignVertical: "top",
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
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
  },
  submitButtonIcon: {
    marginRight: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
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