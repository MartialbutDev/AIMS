// app/(student)/journals/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";

import { useTheme } from "../../../src/context/ThemeContext";
import { journalService, Journal } from "../../../src/services/journal.service";

const statusColors: Record<string, string> = {
  draft: "#6B7280",
  submitted: "#3B82F6",
  reviewing: "#8B5CF6",
  approved: "#10B981",
  rejected: "#EF4444",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewing: "Reviewing",
  approved: "Approved",
  rejected: "Rejected",
};

export default function JournalDetailScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (showSpinner = true) => {
      if (!id) return;
      try {
        if (showSpinner) setLoading(true);
        const data = await journalService.getJournalById(id);
        setJournal(data);
      } catch (error) {
        console.error("Error fetching journal detail:", error);
        Alert.alert("Error", "Failed to load journal");
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      load(!journal);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])
  );

  const handleOpenPDF = async () => {
    if (!journal) return;
    try {
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) {
        Alert.alert("Error", "Session expired. Please log in again.");
        return;
      }

      const url = journalService.getFileUrl(journal.id, token);
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert("Error", "Cannot open PDF on this device");
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error("Open PDF error:", error);
      Alert.alert("Error", "Failed to open PDF");
    }
  };

  const handleSubmit = () => {
    if (!journal) return;
    Alert.alert(
      "Submit Journal",
      "Submit this journal for coordinator review? You won't be able to edit it after this.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            try {
              setSubmitting(true);
              await journalService.updateJournal(journal.id, {
                status: "submitted",
              });
              Alert.alert("Success", "Journal submitted for review");
              await load(false);
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.response?.data?.detail || "Failed to submit journal"
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!journal) return;
    Alert.alert("Delete Journal", "Delete this journal? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await journalService.deleteJournal(journal.id);
            Alert.alert("Success", "Journal deleted");
            router.back();
          } catch (error: any) {
            Alert.alert(
              "Error",
              error.response?.data?.detail || "Failed to delete journal"
            );
          }
        },
      },
    ]);
  };

  const handleReplaceFile = async () => {
    if (!journal) return;
    try {
      const DocumentPicker = await import("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      if (!asset.name.toLowerCase().endsWith(".pdf")) {
        Alert.alert("Invalid file", "Please select a PDF file only.");
        return;
      }

      setSubmitting(true);
      await journalService.replaceFile(
        journal.id,
        asset.uri,
        asset.name,
        asset.mimeType
      );
      Alert.alert("Success", "Journal file replaced");
      await load(false);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to replace file"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading journal...
          </Text>
        </View>
      </View>
    );
  }

  if (!journal) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <Ionicons name="book-outline" size={64} color={colors.border} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Journal not found
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => load(true)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isEditable = journal.status === "draft";
  const statusColor = statusColors[journal.status] || "#6B7280";

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
          Journal Details
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 30 + insets.bottom },
        ]}
      >
        {/* Header card */}
        <View style={[styles.headerCard, { backgroundColor: colors.card }]}>
          <View style={styles.headerRow}>
            <View
              style={[
                styles.weekBadge,
                { backgroundColor: `${colors.primary}10` },
              ]}
            >
              <Text style={[styles.weekBadgeText, { color: colors.primary }]}>
                Week {journal.week}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${statusColor}15` },
              ]}
            >
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabels[journal.status] || journal.status}
              </Text>
            </View>
          </View>
          <Text style={[styles.journalTitle, { color: colors.textPrimary }]}>
            {journal.title}
          </Text>
          <View style={styles.dateRow}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>
              {formatDate(journal.created_at)}
            </Text>
          </View>
        </View>

        {/* Summary */}
        {journal.summary && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Summary
            </Text>
            <Text
              style={[
                styles.summaryText,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.textSecondary,
                },
              ]}
            >
              {journal.summary}
            </Text>
          </View>
        )}

        {/* PDF file section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Journal File
          </Text>
          <View
            style={[
              styles.fileCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.fileIconContainer,
                { backgroundColor: `${colors.primary}15` },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={36}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.fileLabel, { color: colors.textSecondary }]}>
              PDF Document
            </Text>
            <TouchableOpacity
              style={[styles.openPdfButton, { backgroundColor: colors.primary }]}
              onPress={handleOpenPDF}
              activeOpacity={0.85}
            >
              <Ionicons name="open-outline" size={20} color="#FFFFFF" />
              <Text style={styles.openPdfButtonText}>Open PDF</Text>
            </TouchableOpacity>
          </View>

          {isEditable && (
            <TouchableOpacity
              style={[styles.replaceButton, { borderColor: colors.border }]}
              onPress={handleReplaceFile}
              disabled={submitting}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={18}
                color={colors.primary}
              />
              <Text
                style={[styles.replaceButtonText, { color: colors.primary }]}
              >
                Replace PDF
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Feedback */}
        {journal.feedback && (
          <View style={styles.section}>
            <View style={styles.feedbackHeader}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Feedback
              </Text>
            </View>
            <View
              style={[
                styles.feedbackCard,
                {
                  backgroundColor: `${colors.primary}05`,
                  borderColor: `${colors.primary}20`,
                },
              ]}
            >
              <Text style={[styles.feedbackText, { color: colors.textPrimary }]}>
                {journal.feedback}
              </Text>
            </View>
          </View>
        )}

        {/* Metadata */}
        <View
          style={[
            styles.metadataCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.metadataItem}>
            <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>
              Created
            </Text>
            <Text style={[styles.metadataValue, { color: colors.textPrimary }]}>
              {formatDate(journal.created_at)}
            </Text>
          </View>
          <View
            style={[styles.metadataDivider, { backgroundColor: colors.border }]}
          />
          <View style={styles.metadataItem}>
            <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>
              Status
            </Text>
            <Text style={[styles.metadataValue, { color: colors.textPrimary }]}>
              {statusLabels[journal.status] || journal.status}
            </Text>
          </View>
        </View>

        {/* Actions for drafts */}
        {isEditable && (
          <>
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="send-sharp"
                    size={20}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.submitButtonText}>
                    Submit for Review
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={styles.deleteButtonText}>Delete Journal</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { marginTop: 12, fontSize: 16 },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  retryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
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
  content: { paddingHorizontal: 20 },
  headerCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  weekBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  weekBadgeText: { fontSize: 12, fontWeight: "600" },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  journalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  dateRow: { flexDirection: "row", alignItems: "center" },
  dateText: { fontSize: 13, marginLeft: 6 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },

  // PDF file card
  fileCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  fileIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  fileLabel: { fontSize: 13, marginBottom: 16 },
  openPdfButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  openPdfButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  replaceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  replaceButtonText: { fontSize: 14, fontWeight: "600" },

  // Summary
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },

  // Feedback
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  feedbackCard: { padding: 14, borderRadius: 12, borderWidth: 1 },
  feedbackText: { fontSize: 14, lineHeight: 22 },

  // Metadata
  metadataCard: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  metadataItem: { flex: 1 },
  metadataDivider: { width: 1, height: 40, marginHorizontal: 12 },
  metadataLabel: { fontSize: 11, marginBottom: 2 },
  metadataValue: { fontSize: 12 },

  // Submit / delete
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
  },
  submitButtonDisabled: { opacity: 0.6, shadowOpacity: 0, elevation: 0 },
  submitButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  deleteButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  deleteButtonText: {
    fontSize: 14,
    color: "#EF4444",
    fontWeight: "500",
    marginLeft: 8,
  },
});