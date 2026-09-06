// app/(student)/dtr/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import {
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";
import { useAutoHideTab } from "../../../src/hooks/useAutoHideTab";
import { dtrService, DTR, DTRSummary } from "../../../src/services/dtr.service";
import { usePaginatedData } from "../../../src/hooks/usePaginatedData";
import api from "../../../src/services/api";
import { SkeletonDTRList } from "../../../src/components/common/Skeleton";

const { width } = Dimensions.get("window");

const statusColors: Record<string, string> = {
  pending: "#F59E0B",
  submitted: "#3B82F6",
  approved: "#10B981",
  rejected: "#EF4444",
};

const statusIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending: "time-outline",
  submitted: "send-sharp",
  approved: "checkmark-circle-outline",
  rejected: "close-circle-outline",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export default function DTRScreen() {
  const { colors, isDark } = useTheme();
  const { handleScroll } = useAutoHideTab();
  const [summary, setSummary] = useState<DTRSummary | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [exporting, setExporting] = useState(false);

  const filters = ["all", "pending", "submitted", "approved", "rejected"];

  // ✅ Pagination hook
  const {
    data: dtrs,
    loadNext,
    refresh,
    isLoading,
    isRefreshing,
    hasMore,
  } = usePaginatedData<DTR>(
    async (page, limit) => {
      const response = await api.get(`/dtr/?page=${page}&limit=${limit}`);
      return {
        data: response.data.items || response.data,
        total: response.data.total || response.data.length || 0,
      };
    },
    {
      initialPage: 1,
      initialLimit: 10,
      autoLoad: true,
    }
  );

  // ✅ Fetch summary separately
  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const summaryData = await dtrService.getDTRSummary();
      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const handleExport = async () => {
    if (dtrs.length === 0) {
      Alert.alert(
        "No Records",
        "You don't have any DTR records to export yet. Please submit your Time-In first."
      );
      return;
    }

    Alert.alert(
      "Export DTR Report",
      `This will export all ${dtrs.length} DTR records to an Excel file (.xlsx).\n\nFile will include:\n• Student Information\n• Summary Statistics\n• All DTR Records\n• Color-coded Statuses`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export",
          onPress: async () => {
            setExporting(true);
            try {
              await dtrService.exportDTRToExcel();
            } catch (error) {
              // Error handled in service
            } finally {
              setExporting(false);
            }
          },
        },
      ]
    );
  };

  const filteredDTRs = dtrs.filter((dtr) => {
    const matchesFilter = selectedFilter === "all" || dtr.status === selectedFilter;
    return matchesFilter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return "—";
    try {
      const time = new Date(`2000-01-01T${timeString}`);
      return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeString;
    }
  };

  const renderDTRCard = ({ item }: { item: DTR }) => (
    <TouchableOpacity
      style={[styles.dtrCard, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/(student)/dtr/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={styles.dateRow}>
            <Text style={[styles.dateText, { color: colors.textPrimary }]}>{formatDate(item.date)}</Text>
          </View>
          <View style={styles.timeRow}>
            <View style={styles.timeItem}>
              <Ionicons name="log-in-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                {item.time_in ? formatTime(item.time_in) : "—"}
              </Text>
            </View>
            <Ionicons name="arrow-forward-outline" size={14} color={colors.textSecondary} />
            <View style={styles.timeItem}>
              <Ionicons name="log-out-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                {item.time_out ? formatTime(item.time_out) : "—"}
              </Text>
            </View>
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

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <View style={styles.footerItem}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Total: {item.total_hours ? `${item.total_hours}h` : "—"}
          </Text>
        </View>
        {item.tasks_completed && (
          <View style={styles.footerItem}>
            <Ionicons name="checkbox-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.footerText, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.tasks_completed}
            </Text>
          </View>
        )}
      </View>
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

  // ✅ Skeleton Loader
  if (isLoading && dtrs.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
        <View style={styles.header}>
          <View style={styles.backButton} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>DTR Records</Text>
          <View style={styles.headerRight}>
            <View style={styles.exportButton} />
            <View style={styles.addButton} />
          </View>
        </View>
        <SkeletonDTRList count={5} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>DTR Records</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
            disabled={exporting || dtrs.length === 0}
            activeOpacity={0.7}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons 
                name="download-outline" 
                size={24} 
                color={dtrs.length === 0 ? colors.textSecondary : colors.primary} 
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push("/(student)/dtr/new" as any)}
          >
            <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {summary && (
        <View style={[styles.statsContainer, { backgroundColor: colors.card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{summary.total_entries}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#10B981" }]}>{summary.approved}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Approved</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#F59E0B" }]}>{summary.pending}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pending</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#3B82F6" }]}>{summary.submitted}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Submitted</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={[styles.statItem]}>
            <Text style={[styles.statValue, { color: "#EF4444" }]}>{summary.rejected}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rejected</Text>
          </View>
        </View>
      )}

      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filtersContainer}>
            {filters.map(renderFilterChip)}
          </View>
        </ScrollView>
      </View>

      <FlatList
        data={filteredDTRs}
        renderItem={renderDTRCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={loadNext}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>No DTR Records</Text>
            <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
              Start submitting your daily time records
            </Text>
            <TouchableOpacity
              style={[styles.emptyStateButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(student)/dtr/new" as any)}
            >
              <Text style={styles.emptyStateButtonText}>Submit DTR</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          isLoading && !isRefreshing ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
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
    paddingTop: 0,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addButton: {
    padding: 4,
  },
  exportButton: {
    padding: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
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
    paddingBottom: 12,
  },
  filtersContainer: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexGrow: 1,
  },
  loaderContainer: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dtrCard: {
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
  },
  cardLeft: {
    flex: 1,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 12,
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