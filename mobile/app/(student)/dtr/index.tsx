// app/(student)/dtr/index.tsx
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

// Define the status type
type DTRStatus = "pending" | "approved" | "rejected" | "submitted";

interface DTRRecord {
  id: string;
  date: string;
  day: string;
  timeIn: string;
  timeOut: string;
  totalHours: string;
  status: DTRStatus;
  overtime?: string;
  notes?: string;
}

const mockDTRRecords: DTRRecord[] = [
  {
    id: "1",
    date: "2026-03-15",
    day: "Monday",
    timeIn: "08:00 AM",
    timeOut: "05:00 PM",
    totalHours: "8h 0m",
    status: "approved",
    notes: "Regular work day",
  },
  {
    id: "2",
    date: "2026-03-14",
    day: "Friday",
    timeIn: "08:15 AM",
    timeOut: "06:30 PM",
    totalHours: "9h 15m",
    status: "approved",
    overtime: "1h 15m",
    notes: "Project deadline",
  },
  {
    id: "3",
    date: "2026-03-13",
    day: "Thursday",
    timeIn: "08:00 AM",
    timeOut: "05:00 PM",
    totalHours: "8h 0m",
    status: "pending",
  },
  {
    id: "4",
    date: "2026-03-12",
    day: "Wednesday",
    timeIn: "09:00 AM",
    timeOut: "05:00 PM",
    totalHours: "7h 0m",
    status: "rejected",
    notes: "Late arrival - need explanation",
  },
  {
    id: "5",
    date: "2026-03-11",
    day: "Tuesday",
    timeIn: "08:00 AM",
    timeOut: "04:30 PM",
    totalHours: "7h 30m",
    status: "submitted",
  },
];

const statusColors: Record<DTRStatus, string> = {
  pending: "#F59E0B",
  approved: "#10B981",
  rejected: "#EF4444",
  submitted: "#3B82F6",
};

// Fixed: Properly typed status icons
const statusIcons: Record<DTRStatus, keyof typeof Ionicons.glyphMap> = {
  pending: "time-outline",
  approved: "checkmark-circle-outline",
  rejected: "close-circle-outline",
  submitted: "send-sharp",
};

export default function DTRScreen() {
  const [records, setRecords] = useState(mockDTRRecords);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const filters = ["all", "pending", "submitted", "approved", "rejected"];

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  const filteredRecords = records.filter((record) => {
    const matchesFilter = selectedFilter === "all" || record.status === selectedFilter;
    return matchesFilter;
  });

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
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

  const renderDTRCard = ({ item }: { item: DTRRecord }) => (
    <TouchableOpacity
      style={styles.dtrCard}
      onPress={() => router.push(`/(student)/dtr/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View>
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>{item.date}</Text>
            <Text style={styles.dayText}>{item.day}</Text>
          </View>
          <View style={styles.timeRow}>
            <View style={styles.timeItem}>
              <Ionicons name="log-in-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.timeText}>{item.timeIn}</Text>
            </View>
            <Ionicons name="arrow-forward-outline" size={14} color={Colors.textSecondary} />
            <View style={styles.timeItem}>
              <Ionicons name="log-out-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.timeText}>{item.timeOut}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColors[item.status]}15` }]}>
          <Ionicons
            name={statusIcons[item.status]}
            size={14}
            color={statusColors[item.status]}
            style={styles.statusIcon}
          />
          <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.footerText}>Total: {item.totalHours}</Text>
        </View>
        {item.overtime && (
          <View style={styles.footerItem}>
            <Ionicons name="flame-outline" size={16} color="#F59E0B" />
            <Text style={[styles.footerText, { color: "#F59E0B" }]}>
              OT: {item.overtime}
            </Text>
          </View>
        )}
        {item.notes && (
          <View style={styles.footerItem}>
            <Ionicons name="document-text-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.footerText} numberOfLines={1}>
              {item.notes}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const getSummaryStats = () => {
    const total = records.length;
    const approved = records.filter(r => r.status === "approved").length;
    const pending = records.filter(r => r.status === "pending").length;
    const submitted = records.filter(r => r.status === "submitted").length;
    return { total, approved, pending, submitted };
  };

  const stats = getSummaryStats();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DTR Records</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/(student)/dtr/new" as any)}
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
          <Text style={[styles.statValue, { color: "#10B981" }]}>{stats.approved}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#F59E0B" }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#3B82F6" }]}>{stats.submitted}</Text>
          <Text style={styles.statLabel}>Submitted</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filtersContainer}>
            {filters.map(renderFilterChip)}
          </View>
        </ScrollView>
      </View>

      {/* DTR List */}
      <FlatList
        data={filteredRecords}
        renderItem={renderDTRCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyStateTitle}>No DTR Records</Text>
            <Text style={styles.emptyStateDescription}>
              Start submitting your daily time records
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => router.push("/(student)/dtr/new" as any)}
            >
              <Text style={styles.emptyStateButtonText}>Submit DTR</Text>
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
    fontSize: 20,
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
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textSecondary,
  },

  filterChipTextActive: {
    color: Colors.white,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  dtrCard: {
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
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  dateText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  dayText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 10,
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
    color: Colors.textSecondary,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
    borderTopColor: Colors.border,
    gap: 12,
  },

  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  footerText: {
    fontSize: 12,
    color: Colors.textSecondary,
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