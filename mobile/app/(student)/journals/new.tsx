// app/(student)/journals/new.tsx
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
} from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { useTheme } from "../../../src/context/ThemeContext";
import { journalService } from "../../../src/services/journal.service";

interface PickedFile {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}

export default function NewJournalScreen() {
  const { colors, isDark } = useTheme();

  const [loading, setLoading] = useState(false);
  const [week, setWeek] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      const nameLower = (asset.name || "").toLowerCase();
      if (!nameLower.endsWith(".pdf")) {
        Alert.alert("Invalid file", "Please select a PDF file only.");
        return;
      }

      setFile({
        uri: asset.uri,
        name: asset.name || `journal_week_${week || "x"}.pdf`,
        size: asset.size,
        mimeType: asset.mimeType || "application/pdf",
      });
    } catch (error) {
      console.error("Pick file error:", error);
      Alert.alert("Error", "Could not pick file");
    }
  };

  const handleSubmit = async () => {
    if (!week.trim()) return Alert.alert("Error", "Enter the week number");
    if (!title.trim()) return Alert.alert("Error", "Enter the journal title");
    if (!file) return Alert.alert("Error", "Please select a PDF file");

    const weekNumber = parseInt(week.trim(), 10);
    if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 52) {
      return Alert.alert("Error", "Week must be between 1 and 52");
    }

    setLoading(true);
    try {
      await journalService.createJournal({
        week: weekNumber,
        title: title.trim(),
        summary: summary.trim() || undefined,
        fileUri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
        submit: true, // ✅ single-step: submit immediately
      });

      Alert.alert("Success", "Journal submitted for review.", [
        {
          text: "View Journals",
          onPress: () => router.replace("/(student)/journals"),
        },
      ]);

      setWeek("");
      setTitle("");
      setSummary("");
      setFile(null);
    } catch (error: any) {
      console.error("Submit error:", error);
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to submit journal."
      );
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!week.trim() && !!title.trim() && !!file && !loading;

  return (
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
          New Journal
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* PDF picker */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            Journal File <Text style={styles.required}>*</Text>
          </Text>

          {!file ? (
            <TouchableOpacity
              style={[
                styles.uploadBox,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
              onPress={pickFile}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.uploadIcon,
                  { backgroundColor: `${colors.primary}15` },
                ]}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={32}
                  color={colors.accent}
                />
              </View>
              <Text style={[styles.uploadTitle, { color: colors.textPrimary }]}>
                Upload PDF
              </Text>
              <Text style={[styles.uploadSub, { color: colors.textSecondary }]}>
                Only PDF files are accepted
              </Text>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.fileCard,
                { backgroundColor: colors.card, borderColor: colors.success },
              ]}
            >
              <View
                style={[
                  styles.fileIcon,
                  { backgroundColor: `${colors.success}15` },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={colors.success}
                />
              </View>
              <View style={styles.fileInfo}>
                <Text
                  style={[styles.fileName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {file.name}
                </Text>
                <Text
                  style={[styles.fileMeta, { color: colors.textSecondary }]}
                >
                  {file.size
                    ? `${(file.size / 1024).toFixed(0)} KB · PDF`
                    : "PDF"}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.fileRemove, { borderColor: colors.border }]}
                onPress={() => setFile(null)}
              >
                <Ionicons name="close" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Week */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            Week Number <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                color: colors.textPrimary,
                borderColor: colors.border,
              },
            ]}
            placeholder="e.g., 1"
            placeholderTextColor={colors.textSecondary}
            value={week}
            onChangeText={setWeek}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                color: colors.textPrimary,
                borderColor: colors.border,
              },
            ]}
            placeholder="e.g., Week 1 — Onboarding & Setup"
            placeholderTextColor={colors.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={255}
          />
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
            Short Summary{" "}
            <Text style={{ color: colors.textSecondary, fontWeight: "400" }}>
              (optional)
            </Text>
          </Text>
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: colors.card,
                color: colors.textPrimary,
                borderColor: colors.border,
              },
            ]}
            placeholder="One or two lines about this week..."
            placeholderTextColor={colors.textSecondary}
            value={summary}
            onChangeText={setSummary}
            multiline
            numberOfLines={3}
            maxLength={500}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary },
            !canSubmit && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="send-outline"
                size={20}
                color="#FFFFFF"
                style={styles.submitIcon}
              />
              <Text style={styles.submitButtonText}>Submit Journal</Text>
            </>
          )}
        </TouchableOpacity>

        <View
          style={[styles.infoNote, { backgroundColor: `${colors.primary}10` }]}
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.textSecondary}
          />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Upload your journal as a PDF. It will be submitted to your
            coordinator for review.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  required: { color: "#EF4444" },

  uploadBox: {
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
  },
  uploadIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  uploadTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  uploadSub: { fontSize: 12 },

  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    gap: 12,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: "600" },
  fileMeta: { fontSize: 12, marginTop: 2 },
  fileRemove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
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
    minHeight: 90,
    borderWidth: 1,
    textAlignVertical: "top",
  },

  submitButton: {
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.6, shadowOpacity: 0, elevation: 0 },
  submitIcon: { marginRight: 8 },
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