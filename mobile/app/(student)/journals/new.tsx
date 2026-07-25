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

import Colors from "../../../src/theme/colors";

export default function NewJournalScreen() {
  const [loading, setLoading] = useState(false);
  const [week, setWeek] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = async () => {
    if (!week.trim() || !title.trim() || !summary.trim() || !content.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
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

  const handleSaveDraft = async () => {
    if (!week.trim() || !title.trim()) {
      Alert.alert("Error", "Please fill in week and title");
      return;
    }

    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
        <Text style={styles.headerTitle}>New Journal</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Week */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Week Number <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 3"
            placeholderTextColor={Colors.textSecondary}
            value={week}
            onChangeText={setWeek}
            keyboardType="number-pad"
          />
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Title <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Enter journal title..."
            placeholderTextColor={Colors.textSecondary}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Summary <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.textArea}
            placeholder="Brief summary of the week..."
            placeholderTextColor={Colors.textSecondary}
            value={summary}
            onChangeText={setSummary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Content */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Detailed Report <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.contentArea}
            placeholder={`Write your detailed report here...

Include:
• Technical skills learned
• Tasks completed
• Challenges faced
• Goals for next week`}
            placeholderTextColor={Colors.textSecondary}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={12}
            textAlignVertical="top"
          />
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.draftButton, loading && styles.buttonDisabled]}
            onPress={handleSaveDraft}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.draftButtonText}>Save Draft</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <View style={styles.submitButtonContent}>
                <Ionicons name="send-sharp" size={20} color={Colors.white} style={styles.submitButtonIcon} />
                <Text style={styles.submitButtonText}>Submit</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
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
    marginBottom: 18,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 6,
  },

  required: {
    color: "#EF4444",
  },

  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  textArea: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 80,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlignVertical: "top",
  },

  contentArea: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 250,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlignVertical: "top",
  },

  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },

  draftButton: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.primary,
  },

  draftButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "600",
  },

  submitButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
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
    fontSize: 15,
    fontWeight: "600",
  },

  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
});