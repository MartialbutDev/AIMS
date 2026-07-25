// app/(student)/journals/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
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

import Colors from "../../../src/theme/colors";

type JournalStatus = "draft" | "submitted" | "reviewing" | "approved" | "rejected";

const getJournalDetail = (id: string) => ({
  id,
  week: 3,
  title: "Week 3 - Learning React Native",
  date: "2026-03-15",
  status: "approved" as JournalStatus,
  summary: "This week I focused on learning React Native fundamentals. I built a simple mobile app and integrated it with a REST API. I also learned about navigation, state management, and native components.",
  content: `Detailed weekly report:

1. Technical Skills Learned:
   - React Native core components
   - Navigation with React Navigation
   - State management with React Hooks
   - API integration with Axios

2. Tasks Completed:
   - Set up project structure
   - Implemented login screen
   - Created dashboard layout
   - Added navigation between screens

3. Challenges Faced:
   - Understanding native modules
   - Debugging with React Native tools
   - Performance optimization

4. Next Week Goals:
   - Learn about animations
   - Implement notifications
   - Add offline support`,
  feedback: "Great progress! Your understanding of React Native is improving rapidly. I especially liked how you structured your components. Keep up the good work!",
  createdAt: "2026-03-15T10:30:00",
  updatedAt: "2026-03-16T14:20:00",
});

const statusColors: Record<JournalStatus, string> = {
  draft: "#6B7280",
  submitted: "#3B82F6",
  reviewing: "#8B5CF6",
  approved: "#10B981",
  rejected: "#EF4444",
};

const statusIcons: Record<JournalStatus, keyof typeof Ionicons.glyphMap> = {
  draft: "create-outline",
  submitted: "send-sharp",
  reviewing: "refresh-circle-outline",
  approved: "checkmark-circle-outline",
  rejected: "close-circle-outline",
};

const statusLabels: Record<JournalStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewing: "Reviewing",
  approved: "Approved",
  rejected: "Rejected",
};

export default function JournalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const journal = getJournalDetail(id);

  const getStatusText = (status: JournalStatus) => {
    return statusLabels[status];
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getWeekLabel = (week: number) => {
    return week === 0 ? "Week 0" : `Week ${week}`;
  };

  const handleEdit = () => {
    router.push(`/(student)/journals/${id}/edit` as any);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Journal",
      "Are you sure you want to delete this journal entry?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => console.log("Deleted") },
      ]
    );
  };

  const handleSubmit = () => {
    Alert.alert(
      "Submit Journal",
      "Are you ready to submit this journal for review?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Submit", onPress: () => console.log("Submitted") },
      ]
    );
  };

  const isEditable = journal.status === "draft";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Journal Details</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={styles.weekBadge}>
                <Text style={styles.weekBadgeText}>{getWeekLabel(journal.week)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${statusColors[journal.status]}15` }]}>
                <Ionicons
                  name={statusIcons[journal.status]}
                  size={14}
                  color={statusColors[journal.status]}
                  style={styles.statusIcon}
                />
                <Text style={[styles.statusText, { color: statusColors[journal.status] }]}>
                  {getStatusText(journal.status)}
                </Text>
              </View>
            </View>
            <Text style={styles.journalTitle}>{journal.title}</Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.dateText}>{formatDate(journal.date)}</Text>
            </View>
          </View>

          {/* Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summaryText}>{journal.summary}</Text>
          </View>

          {/* Content */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detailed Report</Text>
            <View style={styles.contentCard}>
              <Text style={styles.contentText}>{journal.content}</Text>
            </View>
          </View>

          {/* Feedback */}
          {journal.feedback && (
            <View style={styles.section}>
              <View style={styles.feedbackHeader}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Feedback</Text>
              </View>
              <View style={styles.feedbackCard}>
                <Text style={styles.feedbackText}>{journal.feedback}</Text>
              </View>
            </View>
          )}

          {/* Metadata */}
          <View style={styles.metadataCard}>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Created</Text>
              <Text style={styles.metadataValue}>{formatDate(journal.createdAt)}</Text>
            </View>
            <View style={styles.metadataDivider} />
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Last Updated</Text>
              <Text style={styles.metadataValue}>{formatDate(journal.updatedAt)}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {isEditable && (
              <>
                <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
                  <Ionicons name="create-outline" size={20} color={Colors.white} />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                  <Ionicons name="send-sharp" size={20} color={Colors.white} />
                  <Text style={styles.submitButtonText}>Submit</Text>
                </TouchableOpacity>
              </>
            )}
            {!isEditable && journal.status !== "approved" && (
              <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
                <Ionicons name="create-outline" size={20} color={Colors.white} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditable && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={styles.deleteButtonText}>Delete Journal</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
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

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  headerCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  weekBadge: {
    backgroundColor: `${Colors.primary}10`,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },

  weekBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },

  statusIcon: {
    marginRight: 4,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },

  journalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 6,
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  dateText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 6,
  },

  section: {
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 8,
  },

  summaryText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  contentCard: {
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  contentText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  feedbackCard: {
    backgroundColor: `${Colors.primary}05`,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Colors.primary}20`,
  },

  feedbackText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
  },

  metadataCard: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  metadataItem: {
    flex: 1,
  },

  metadataDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },

  metadataLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 2,
  },

  metadataValue: {
    fontSize: 12,
    color: Colors.textPrimary,
  },

  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },

  editButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  editButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },

  submitButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  submitButtonText: {
    color: Colors.white,
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