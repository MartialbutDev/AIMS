// app/(student)/journals/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    Dimensions,
    FlatList,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import Colors from "../../../src/theme/colors";

const { width } = Dimensions.get("window");

type JournalStatus = "draft" | "submitted" | "reviewing" | "approved" | "rejected";

interface Journal {
  id: string;
  week: number;
  title: string;
  date: string;
  status: JournalStatus;
  summary: string;
  feedback?: string;
  createdAt: string;
}

const mockJournals: Journal[] = [
  {
    id: "1",
    week: 3,
    title: "Week 3 - Learning React Native",
    date: "2026-03-15",
    status: "approved",
    summary: "This week I focused on learning React Native fundamentals...",
    feedback: "Great progress! Keep up the good work.",
    createdAt: "2026-03-15T10:30:00",
  },
  {
    id: "2",
    week: 2,
    title: "Week 2 - UI/UX Design Principles",
    date: "2026-03-08",
    status: "reviewing",
    summary: "I explored UI/UX design principles and applied them...",
    createdAt: "2026-03-08T14:20:00",
  },
  {
    id: "3",
    week: 1,
    title: "Week 1 - Getting Started with React",
    date: "2026-03-01",
    status: "submitted",
    summary: "My first week at the internship...",
    createdAt: "2026-03-01T09:15:00",
  },
  {
    id: "4",
    week: 0,
    title: "Week 0 - Orientation and Setup",
    date: "2026-02-22",
    status: "rejected",
    summary: "Orientation week - got to know the team...",
    feedback: "Please provide more details about your tasks.",
    createdAt: "2026-02-22T11:00:00",
  },
  {
    id: "5",
    week: 0,
    title: "Week 0 - Revised Orientation Report",
    date: "2026-02-23",
    status: "draft",
    summary: "Revised version after feedback...",
    createdAt: "2026-02-23T16:45:00",
  },
];

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

export default function JournalsScreen() {
  const [journals, setJournals] = useState(mockJournals);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<number | "all">("all");

  const filters = ["all", "draft", "submitted", "reviewing", "approved", "rejected"];
  const weeks: (number | "all")[] = ["all", 0, 1, 2, 3, 4, 5, 6, 7, 8];

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  const filteredJournals = journals.filter((journal) => {
    const matchesFilter = selectedFilter === "all" || journal.status === selectedFilter;
    const matchesWeek = selectedWeek === "all" || journal.week === selectedWeek;
    return matchesFilter && matchesWeek;
  });

  const getStatusText = (status: JournalStatus) => {
    return statusLabels[status];
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getWeekLabel = (week: number) => {
    return week === 0 ? "Week 0" : `Week ${week}`;
  };

  const renderFilterChip = (filter: string) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterChip,
        selectedFilter === filter && styles.filterChipActive,
      ]}
      onPress={() => setSelectedFilter(filter)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterChipText,
          selectedFilter === filter && styles.filterChipTextActive,
        ]}
      >
        {filter.charAt(0).toUpperCase() + filter.slice(1)}
      </Text>
    </TouchableOpacity>
  );

  // Fixed: Properly typed renderWeekChip function
  const renderWeekChip = (week: number | "all") => {
    const label = week === "all" ? "All Weeks" : getWeekLabel(week as number);
    return (
      <TouchableOpacity
        key={String(week)}
        style={[
          styles.weekChip,
          selectedWeek === week && styles.weekChipActive,
        ]}
        onPress={() => setSelectedWeek(week)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.weekChipText,
            selectedWeek === week && styles.weekChipTextActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderJournalCard = ({ item }: { item: Journal }) => (
    <TouchableOpacity
      style={styles.journalCard}
      onPress={() => router.push(`/(student)/journals/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={styles.weekBadge}>
            <Text style={styles.weekBadgeText}>{getWeekLabel(item.week)}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.journalTitle}>{item.title}</Text>
            <Text style={styles.journalDate}>{formatDate(item.date)}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColors[item.status]}15` }]}>
          <Ionicons
            name={statusIcons[item.status]}
            size={12}
            color={statusColors[item.status]}
            style={styles.statusIcon}
          />
          <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>

      <Text style={styles.journalSummary} numberOfLines={2}>
        {item.summary}
      </Text>

      {item.feedback && (
        <View style={styles.feedbackPreview}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.feedbackPreviewText} numberOfLines={1}>
            {item.feedback}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const getSummaryStats = () => {
    const total = journals.length;
    const submitted = journals.filter(j => j.status === "submitted").length;
    const approved = journals.filter(j => j.status === "approved").length;
    const rejected = journals.filter(j => j.status === "rejected").length;
    return { total, submitted, approved, rejected };
  };

  const stats = getSummaryStats();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weekly Journals</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/(student)/journals/new" as any)}
        >
          <Ionicons name="add-circle-outline" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.primary }]}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#3B82F6" }]}>{stats.submitted}</Text>
          <Text style={styles.statLabel}>Submitted</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#10B981" }]}>{stats.approved}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#EF4444" }]}>{stats.rejected}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      {/* Week Filter */}
      <View style={styles.filtersWrapper}>
        <Text style={styles.filterLabel}>Week</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filtersContainer}>
            {weeks.map((week) => renderWeekChip(week))}
          </View>
        </ScrollView>
      </View>

      {/* Status Filter */}
      <View style={styles.filtersWrapper}>
        <Text style={styles.filterLabel}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filtersContainer}>
            {filters.map(renderFilterChip)}
          </View>
        </ScrollView>
      </View>

      {/* Journals List */}
      <FlatList
        data={filteredJournals}
        renderItem={renderJournalCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyStateTitle}>No Journals</Text>
            <Text style={styles.emptyStateDescription}>
              Start writing your weekly internship journals
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => router.push("/(student)/journals/new" as any)}
            >
              <Text style={styles.emptyStateButtonText}>Write Journal</Text>
            </TouchableOpacity>
          </View>
        }
      />
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

  addButton: {
    padding: 4,
  },

  statsContainer: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 2,
  },

  statItem: {
    flex: 1,
    alignItems: "center",
  },

  statValue: {
    fontSize: 18,
    fontWeight: "700",
  },

  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },

  filtersWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
  },

  filtersContainer: {
    flexDirection: "row",
    gap: 8,
  },

  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },

  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  filterChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
  },

  filterChipTextActive: {
    color: Colors.white,
  },

  weekChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },

  weekChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  weekChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
  },

  weekChipTextActive: {
    color: Colors.white,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  journalCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  weekBadge: {
    backgroundColor: `${Colors.primary}10`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },

  weekBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
  },

  cardContent: {
    flex: 1,
  },

  journalTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  journalDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },

  statusIcon: {
    marginRight: 3,
  },

  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },

  journalSummary: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },

  feedbackPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  feedbackPreviewText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 6,
    flex: 1,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },

  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 16,
  },

  emptyStateDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },

  emptyStateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },

  emptyStateButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});