// app/(student)/journals/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
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
  ActivityIndicator,
} from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";
import { journalService, Journal, JournalSummary } from "../../../src/services/journal.service";

const { width } = Dimensions.get("window");

const statusColors: Record<string, string> = {
  draft: "#6B7280",
  submitted: "#3B82F6",
  reviewing: "#8B5CF6",
  approved: "#10B981",
  rejected: "#EF4444",
};

const statusIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  draft: "create-outline",
  submitted: "send-sharp",
  reviewing: "refresh-circle-outline",
  approved: "checkmark-circle-outline",
  rejected: "close-circle-outline",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewing: "Reviewing",
  approved: "Approved",
  rejected: "Rejected",
};

export default function JournalsScreen() {
  const { colors, isDark } = useTheme();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [summary, setSummary] = useState<JournalSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<number | "all">("all");

  const filters = ["all", "draft", "submitted", "reviewing", "approved", "rejected"];
  const weeks: (number | "all")[] = ["all", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [journalsData, summaryData] = await Promise.all([
        journalService.getMyJournals(),
        journalService.getJournalSummary(),
      ]);
      setJournals(journalsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching journals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const filteredJournals = journals.filter((journal) => {
    const matchesFilter = selectedFilter === "all" || journal.status === selectedFilter;
    const matchesWeek = selectedWeek === "all" || journal.week === selectedWeek;
    return matchesFilter && matchesWeek;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getWeekLabel = (week: number) => {
    return `Week ${week}`;
  };

  const renderJournalCard = ({ item }: { item: Journal }) => (
    <TouchableOpacity
      style={[styles.journalCard, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/(student)/journals/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={[styles.weekBadge, { backgroundColor: `${colors.primary}10` }]}>
            <Text style={[styles.weekBadgeText, { color: colors.primary }]}>{getWeekLabel(item.week)}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.journalTitle, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.journalDate, { color: colors.textSecondary }]}>{formatDate(item.created_at)}</Text>
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
            {statusLabels[item.status]}
          </Text>
        </View>
      </View>

      <Text style={[styles.journalSummary, { color: colors.textSecondary }]} numberOfLines={2}>
        {item.summary}
      </Text>

      {item.feedback && (
        <View style={[styles.feedbackPreview, { borderTopColor: colors.border }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.feedbackPreviewText, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.feedback}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderFilterChip = (filter: string) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterChip,
        { 
          backgroundColor: selectedFilter === filter ? colors.primary : colors.card,
          borderColor: selectedFilter === filter ? colors.primary : colors.border,
        }
      ]}
      onPress={() => setSelectedFilter(filter)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterChipText,
          { 
            color: selectedFilter === filter ? '#FFFFFF' : colors.textSecondary 
          }
        ]}
      >
        {filter.charAt(0).toUpperCase() + filter.slice(1)}
      </Text>
    </TouchableOpacity>
  );

  const renderWeekChip = (week: number | "all") => {
    const label = week === "all" ? "All Weeks" : getWeekLabel(week as number);
    return (
      <TouchableOpacity
        key={String(week)}
        style={[
          styles.weekChip,
          { 
            backgroundColor: selectedWeek === week ? colors.primary : colors.card,
            borderColor: selectedWeek === week ? colors.primary : colors.border,
          }
        ]}
        onPress={() => setSelectedWeek(week)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.weekChipText,
            { 
              color: selectedWeek === week ? '#FFFFFF' : colors.textSecondary 
            }
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading journals...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Weekly Journals</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/(student)/journals/new" as any)}
        >
          <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {summary && (
        <View style={[styles.statsContainer, { backgroundColor: colors.card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{summary.total}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#10B981" }]}>{summary.approved}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Approved</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#3B82F6" }]}>{summary.submitted}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Submitted</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#6B7280" }]}>{summary.draft}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Draft</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#EF4444" }]}>{summary.rejected}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rejected</Text>
          </View>
        </View>
      )}

      <View style={styles.filtersWrapper}>
        <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Week</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filtersContainer}>
            {weeks.map(renderWeekChip)}
          </View>
        </ScrollView>
      </View>

      <View style={styles.filtersWrapper}>
        <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filtersContainer}>
            {filters.map(renderFilterChip)}
          </View>
        </ScrollView>
      </View>

      <FlatList
        data={filteredJournals}
        renderItem={renderJournalCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>No Journals</Text>
            <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
              Start writing your weekly internship journals
            </Text>
            <TouchableOpacity
              style={[styles.emptyStateButton, { backgroundColor: colors.primary }]}
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
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
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
  addButton: {
    padding: 4,
  },
  statsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
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
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  filtersWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
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
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  weekChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  weekChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  journalCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  weekBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardContent: {
    flex: 1,
  },
  journalTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  journalDate: {
    fontSize: 12,
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
    lineHeight: 18,
    marginTop: 4,
  },
  feedbackPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  feedbackPreviewText: {
    fontSize: 12,
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
    marginTop: 16,
  },
  emptyStateDescription: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },
  emptyStateButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  emptyStateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});