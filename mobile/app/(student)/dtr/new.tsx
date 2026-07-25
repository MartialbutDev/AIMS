// app/(student)/dtr/new.tsx
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import Colors from "../../../src/theme/colors";

export default function NewDTRScreen() {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date());
  const [timeIn, setTimeIn] = useState(new Date());
  const [timeOut, setTimeOut] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeInPicker, setShowTimeInPicker] = useState(false);
  const [showTimeOutPicker, setShowTimeOutPicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [tasks, setTasks] = useState("");

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

  const calculateTotalHours = () => {
    const diff = timeOut.getTime() - timeIn.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleSubmit = async () => {
    if (!date || !timeIn || !timeOut) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (timeIn >= timeOut) {
      Alert.alert("Error", "Time out must be after time in");
      return;
    }

    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      router.back();
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Submit DTR</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Date Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Date</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
            <Text style={styles.pickerText}>{formatDate(date)}</Text>
            <Ionicons name="chevron-down-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
        </View>

        {/* Time In Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Time In</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowTimeInPicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="log-in-outline" size={20} color="#10B981" />
            <Text style={styles.pickerText}>{formatTime(timeIn)}</Text>
            <Ionicons name="chevron-down-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          {showTimeInPicker && (
            <DateTimePicker
              value={timeIn}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event: DateTimePickerEvent, selectedTime?: Date) => {
                setShowTimeInPicker(false);
                if (selectedTime) setTimeIn(selectedTime);
              }}
            />
          )}
        </View>

        {/* Time Out Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Time Out</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowTimeOutPicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.pickerText}>{formatTime(timeOut)}</Text>
            <Ionicons name="chevron-down-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          {showTimeOutPicker && (
            <DateTimePicker
              value={timeOut}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event: DateTimePickerEvent, selectedTime?: Date) => {
                setShowTimeOutPicker(false);
                if (selectedTime) setTimeOut(selectedTime);
              }}
            />
          )}
        </View>

        {/* Total Hours Preview */}
        <View style={styles.totalHoursContainer}>
          <Text style={styles.totalHoursLabel}>Total Hours</Text>
          <Text style={styles.totalHoursValue}>{calculateTotalHours()}</Text>
        </View>

        {/* Tasks */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tasks Completed</Text>
          <TextInput
            style={styles.textArea}
            placeholder="List the tasks you completed today..."
            placeholderTextColor={Colors.textSecondary}
            value={tasks}
            onChangeText={setTasks}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notes (Optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Any additional notes..."
            placeholderTextColor={Colors.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <View style={styles.submitButtonContent}>
              <Ionicons name="send-outline" size={20} color={Colors.white} style={styles.submitButtonIcon} />
              <Text style={styles.submitButtonText}>Submit DTR</Text>
            </View>
          )}
        </TouchableOpacity>
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

  section: {
    marginBottom: 20,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 8,
  },

  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  pickerText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    marginHorizontal: 12,
  },

  totalHoursContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: `${Colors.primary}10`,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${Colors.primary}20`,
  },

  totalHoursLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.textPrimary,
  },

  totalHoursValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
  },

  textArea: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  submitButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});