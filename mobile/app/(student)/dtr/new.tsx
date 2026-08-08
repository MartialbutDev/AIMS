// app/(student)/dtr/new.tsx
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
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useTheme } from "../../../src/context/ThemeContext";
import { dtrService } from "../../../src/services/dtr.service";

export default function NewDTRScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date());
  const [timeIn, setTimeIn] = useState(new Date());
  const [timeOut, setTimeOut] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeInPicker, setShowTimeInPicker] = useState(false);
  const [showTimeOutPicker, setShowTimeOutPicker] = useState(false);
  const [tasks, setTasks] = useState("");
  const [notes, setNotes] = useState("");

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

  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatTimeForAPI = (date: Date) => {
    return date.toTimeString().split(' ')[0];
  };

  const calculateTotalHours = () => {
    const diff = timeOut.getTime() - timeIn.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const setCurrentTime = (setter: (date: Date) => void) => {
    const now = new Date();
    setter(now);
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
      const dtrData = {
        date: formatDateForAPI(date),
        time_in: formatTimeForAPI(timeIn),
        time_out: formatTimeForAPI(timeOut),
        tasks_completed: tasks.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      await dtrService.createDTR(dtrData);
      
      Alert.alert(
        "Success",
        "DTR submitted successfully!",
        [
          { 
            text: "View DTR", 
            onPress: () => router.push("/(student)/dtr") 
          },
          { text: "OK", style: "default" }
        ]
      );
      
      setDate(new Date());
      setTimeIn(new Date());
      setTimeOut(new Date());
      setTasks("");
      setNotes("");
      
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage = error.response?.data?.detail || "Failed to submit DTR. Please try again.";
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Submit DTR</Text>
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
              onPress={() => setCurrentTime(setTimeIn)}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={[styles.timeNowText, { color: colors.primary }]}>Time Now</Text>
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
          <View style={styles.labelRow}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Time Out <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity
              style={[styles.timeNowButton, { backgroundColor: `${colors.primary}10` }]}
              onPress={() => setCurrentTime(setTimeOut)}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={[styles.timeNowText, { color: colors.primary }]}>Time Now</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowTimeOutPicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={[styles.pickerText, { color: colors.textPrimary }]}>{formatTime(timeOut)}</Text>
            <Ionicons name="chevron-down-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          {showTimeOutPicker && (
            <DateTimePicker
              value={timeOut}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedTime) => {
                setShowTimeOutPicker(false);
                if (selectedTime) setTimeOut(selectedTime);
              }}
            />
          )}
        </View>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              const now = new Date();
              setTimeIn(now);
              const defaultOut = new Date(now);
              defaultOut.setHours(now.getHours() + 8);
              setTimeOut(defaultOut);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.primary }]}>8-Hour Day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              const now = new Date();
              const morning = new Date(now);
              morning.setHours(8, 0, 0, 0);
              setTimeIn(morning);
              const afternoon = new Date(now);
              afternoon.setHours(17, 0, 0, 0);
              setTimeOut(afternoon);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="sunny-outline" size={18} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.primary }]}>9-5</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.clearButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              setTimeIn(new Date());
              setTimeOut(new Date());
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.quickActionText, styles.clearText, { color: colors.textSecondary }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.totalHoursContainer, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}>
          <Text style={[styles.totalHoursLabel, { color: colors.textPrimary }]}>Total Hours</Text>
          <Text style={[styles.totalHoursValue, { color: colors.primary }]}>{calculateTotalHours()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Tasks Completed</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="List the tasks you completed today..."
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
            loading && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.submitButtonContent}>
              <Ionicons name="send-outline" size={20} color="#FFFFFF" style={styles.submitButtonIcon} />
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
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 8,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  clearButton: {
    borderColor: "#D1D5DB",
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  clearText: {
    color: "#6B7280",
  },
  totalHoursContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  totalHoursLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  totalHoursValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  textArea: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
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
});