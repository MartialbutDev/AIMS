// app/(student)/journals/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [journal, setJournal] = useState<Journal | null>(null);

  useEffect(() => {
    fetchJournalDetail();
  }, [id]);

  const fetchJournalDetail = async () => {
    try {
      setLoading(true);
      const data = await journalService.getJournalById(id);
      setJournal(data);
    } catch (error) {
      console.error("Error fetching journal detail:", error);
      Alert.alert("Error", "Failed to load journal");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSubmit = async () => {
    if (!journal) return;
    
    Alert.alert(
      "Submit Journal",
      "Are you ready to submit this journal for review?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            try {
              await journalService.updateJournal(journal.id, { status: "submitted" });
              Alert.alert("Success", "Journal submitted for review");
              fetchJournalDetail();
            } catch (error) {
              Alert.alert("Error", "Failed to submit journal");
            }
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (!journal) return;
    
    Alert.alert(
      "Delete Journal",
      "Are you sure you want to delete this journal entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await journalService.deleteJournal(journal.id);
              Alert.alert("Success", "Journal deleted");
              router.back();
            } catch (error) {
              Alert.alert("Error", "Failed to delete journal");
            }
          },
        },
      ]
    );
  };

  const getWeekLabel = (week: number) => {
    return week === 0 ? "Week 0" : `Week ${week}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading journal...</Text>
      </SafeAreaView>
    );
  }

  if (!journal) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }, styles.centerContent]}>
        <Ionicons name="book-outline" size={64} color={colors.border} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Journal not found</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={fetchJournalDetail}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isEditable = journal.status === "draft";
  const statusColor = statusColors[journal.status] || "#6B7280";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Journal Details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.headerCard, { backgroundColor: colors.card }]}>
          <View style={styles.headerRow}>
            <View style={[styles.weekBadge, { backgroundColor: `${colors.primary}10` }]}>
              <Text style={[styles.weekBadgeText, { color: colors.primary }]}>{getWeekLabel(journal.week)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabels[journal.status] || journal.status}
              </Text>
            </View>
          </View>
          <Text style={[styles.journalTitle, { color: colors.textPrimary }]}>{journal.title}</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formatDate(journal.created_at)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Summary</Text>
          <Text style={[styles.summaryText, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textSecondary }]}>
            {journal.summary}
          </Text>
        </View>

        {journal.content && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Detailed Report</Text>
            <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.contentText, { color: colors.textSecondary }]}>{journal.content}</Text>
            </View>
          </View>
        )}

        {journal.feedback && (
          <View style={styles.section}>
            <View style={styles.feedbackHeader}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Feedback</Text>
            </View>
            <View style={[styles.feedbackCard, { backgroundColor: `${colors.primary}05`, borderColor: `${colors.primary}20` }]}>
              <Text style={[styles.feedbackText, { color: colors.textPrimary }]}>{journal.feedback}</Text>
            </View>
          </View>
        )}

        <View style={[styles.metadataCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.metadataItem}>
            <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>Created</Text>
            <Text style={[styles.metadataValue, { color: colors.textPrimary }]}>{formatDate(journal.created_at)}</Text>
          </View>
          <View style={[styles.metadataDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metadataItem}>
            <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>Status</Text>
            <Text style={[styles.metadataValue, { color: colors.textPrimary }]}>{statusLabels[journal.status] || journal.status}</Text>
          </View>
        </View>

        {isEditable && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={[styles.editButton, { backgroundColor: colors.primary }]} onPress={() => router.push(`/(student)/journals/${id}/edit` as any)}>
              <Ionicons name="create-outline" size={20} color="#FFFFFF" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitButton, { backgroundColor: "#10B981" }]} onPress={handleSubmit}>
              <Ionicons name="send-sharp" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        )}

        {isEditable && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={styles.deleteButtonText}>Delete Journal</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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
  weekBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  journalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateText: {
    fontSize: 13,
    marginLeft: 6,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  contentCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 22,
  },
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  feedbackCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 22,
  },
  metadataCard: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  metadataItem: {
    flex: 1,
  },
  metadataDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 12,
  },
  metadataLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  metadataValue: {
    fontSize: 12,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  submitButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  deleteButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
  },
  deleteButtonText: {
    fontSize: 14,
    color: "#EF4444",
    fontWeight: "500",
    marginLeft: 8,
  },
});