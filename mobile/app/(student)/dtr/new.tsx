// app/(student)/dtr/new.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
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
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { useTheme } from "../../../src/context/ThemeContext";
import { dtrService } from "../../../src/services/dtr.service";

export default function NewDTRScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date());
  const [timeIn, setTimeIn] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeInPicker, setShowTimeInPicker] = useState(false);
  const [tasks, setTasks] = useState("");
  const [notes, setNotes] = useState("");
  const [imageIn, setImageIn] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

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
    try {
      setIsGettingLocation(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for DTR verification.');
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
      Alert.alert('Permission Denied', 'Camera permission is required for Time-In verification.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageIn(result.assets[0].uri);
      if (!location) {
        await getCurrentLocation();
      }
    }
  };

  const setCurrentTime = () => {
    const now = new Date();
    setTimeIn(now);
  };

  const handleTimeIn = async () => {
    if (!imageIn) {
      Alert.alert("Time-In Photo Required", "Please take your Time-In verification photo first.");
      return;
    }

    if (!location) {
      Alert.alert("Location Required", "Please allow location access for verification.");
      await getCurrentLocation();
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('date', formatDateForAPI(date));
      formData.append('time_in', formatTimeForAPI(timeIn));
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
        `You clocked in at ${formatTime(timeIn)}.\n\n📍 ${location.address}\n\nYou can now Time-Out when your shift is done.`,
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
      
      setDate(new Date());
      setTimeIn(new Date());
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
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Date <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={[styles.pickerText, { color: colors.textPrimary }]}>{formatDate(date)}</Text>
            <Ionicons name="chevron-down-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Time In <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity
              style={[styles.timeNowButton, { backgroundColor: `${colors.primary}10` }]}
              onPress={setCurrentTime}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={[styles.timeNowText, { color: colors.primary }]}>Now</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowTimeInPicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="log-in-outline" size={20} color="#10B981" />
            <Text style={[styles.pickerText, { color: colors.textPrimary }]}>{formatTime(timeIn)}</Text>
            <Ionicons name="chevron-down-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          {showTimeInPicker && (
            <DateTimePicker
              value={timeIn}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedTime) => {
                setShowTimeInPicker(false);
                if (selectedTime) setTimeIn(selectedTime);
              }}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Time-In Photo <Text style={styles.required}>*</Text></Text>
          {!imageIn ? (
            <TouchableOpacity
              style={[styles.cameraBox, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={pickImage}
              activeOpacity={0.8}
            >
              <View style={[styles.cameraIconCircle, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="camera-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.cameraBoxTitle, { color: colors.textPrimary }]}>Take Time-In Photo</Text>
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
                  onPress={pickImage}
                >
                  <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                  <Text style={[styles.retakeText, { color: colors.primary }]}>Retake</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Location <Text style={styles.required}>*</Text></Text>
          {location ? (
            <View style={[styles.locationCard, { backgroundColor: `${colors.success}10`, borderColor: `${colors.success}30` }]}>
              <Ionicons name="location-outline" size={20} color={colors.success} />
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
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="location-outline" size={20} color={colors.primary} />
                  <Text style={[styles.locationButtonText, { color: colors.primary }]}>Get Current Location</Text>
                </>
              )}
            </TouchableOpacity>
          )}
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
            (!imageIn || !location || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleTimeIn}
          disabled={!imageIn || !location || isSubmitting}
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