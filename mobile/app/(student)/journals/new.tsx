// app/(student)/journals/new.tsx
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
import { journalService } from "../../../src/services/journal.service";

export default function NewJournalScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [week, setWeek] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = async () => {
    if (!week.trim() || !title.trim() || !summary.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const weekNumber = parseInt(week.trim());
    if (isNaN(weekNumber) || weekNumber < 1) {
      Alert.alert("Error", "Please enter a valid week number");
      return;
    }

    setLoading(true);
    try {
      await journalService.createJournal({
        week: weekNumber,
        title: title.trim(),
        summary: summary.trim(),
        content: content.trim() || undefined,
      });

      Alert.alert(
        "Success",
        "Journal submitted successfully!",
        [
          { 
            text: "View Journals", 
            onPress: () => router.push("/(student)/journals") 
          },
          { text: "OK", style: "default" }
        ]
      );

      setWeek("");
      setTitle("");
      setSummary("");
      setContent("");

    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage = error.response?.data?.detail || "Failed to submit journal. Please try again.";
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>New Journal</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Week Number <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="e.g., 1, 2, 3..."
            placeholderTextColor={colors.textSecondary}
            value={week}
            onChangeText={setWeek}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Title <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Enter journal title..."
            placeholderTextColor={colors.textSecondary}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Summary <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Brief summary of the week..."
            placeholderTextColor={colors.textSecondary}
            value={summary}
            onChangeText={setSummary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Detailed Report</Text>
          <TextInput
            style={[styles.contentArea, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder={`Write your detailed report here...

Include:
• Technical skills learned
• Tasks completed
• Challenges faced
• Goals for next week`}
            placeholderTextColor={colors.textSecondary}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={10}
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
              <Text style={styles.submitButtonText}>Submit Journal</Text>
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
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  required: {
    color: "#EF4444",
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    borderWidth: 1,
    textAlignVertical: "top",
  },
  contentArea: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 200,
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
  },
});