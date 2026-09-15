// app/(student)/applications/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Dimensions,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";
import { useAutoHideTab } from "../../../src/hooks/useAutoHideTab";
import { usePaginatedData } from "../../../src/hooks/usePaginatedData";
import api from "../../../src/services/api";
import { SkeletonApplicationList } from "../../../src/components/common/Skeleton";

const { width } = Dimensions.get("window");

interface Application {
  id: string;
  company_id: string;
  company_name: string;
  position: string;
  status: "pending" | "reviewing" | "interview" | "accepted" | "rejected" | "withdrawn";
  applied_date: string;
  cover_letter?: string;
}

const statusColors: Record<string, string> = {
  pending: "#F59E0B",
  reviewing: "#3B82F6",
  interview: "#8B5CF6",
  accepted: "#10B981",
  rejected: "#EF4444",
  withdrawn: "#6B7280",
};

const statusIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending: "time-outline",
  reviewing: "sync-outline",
  interview: "people-outline",
  accepted: "checkmark-circle-outline",
  rejected: "close-circle-outline",
  withdrawn: "ban-outline",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  reviewing: "Reviewing",
  interview: "Interview",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export default function ApplicationsScreen() {
  const { colors, isDark } = useTheme();
  const { handleScroll } = useAutoHideTab();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const filters = [
    "all",
    "pending",
    "reviewing",
    "interview",
    "accepted",
    "rejected",
    "withdrawn",
  ];

  // ✅ Pagination hook — backend now returns { items, total, page, limit, total_pages }
  const {
    data: applications,
    loadNext,
    refresh,
    isLoading,
    isRefreshing,
    hasMore,
  } = usePaginatedData<Application>(
    async (page, limit) => {
      const response = await api.get(
        `/applications/?page=${page}&limit=${limit}`
      );
      return {
        data: response.data.items ?? [],
        total: response.data.total ?? 0,
      };
    },
    {
      initialPage: 1,
      initialLimit: 10,
      autoLoad: true,
      key: "applications",
    }
  );

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.position.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === "all" || app.status === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  };

  const renderApplication = ({ item }: { item: Application }) => (
    <TouchableOpacity
      style={[styles.applicationCard, { backgroundColor: colors.card }]}
      onPress={() =>
        router.push(`/(student)/applications/${item.id}` as any)
      }
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.companyInfo}>
          <View
            style={[
              styles.companyAvatar,
              { backgroundColor: `${colors.primary}10` },
            ]}
          >
            <Text style={[styles.companyInitial, { color: colors.primary }]}>
              {item.company_name?.charAt(0) ?? "?"}
            </Text>
          </View>
          <View style={styles.companyDetails}>
            <Text
              style={[styles.companyName, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {item.company_name}
            </Text>
            <Text
              style={[styles.positionName, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.position}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${statusColors[item.status]}15` },
          ]}
        >
          <Ionicons
            name={statusIcons[item.status]}
            size={14}
            color={statusColors[item.status]}
            style={styles.statusIcon}
          />
          <Text
            style={[styles.statusText, { color: statusColors[item.status] }]}
          >
            {statusLabels[item.status]}
          </Text>
        </View>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <View style={styles.footerItem}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Applied {getDaysAgo(item.applied_date)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFilterChip = (filter: string) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterChip,
        {
          backgroundColor:
            selectedFilter === filter ? colors.primary : colors.card,
          borderColor:
            selectedFilter === filter ? colors.primary : colors.border,
        },
      ]}
      onPress={() => setSelectedFilter(filter)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterChipText,
          {
            color: selectedFilter === filter ? "#FFFFFF" : colors.textSecondary,
          },
        ]}
      >
        {filter.charAt(0).toUpperCase() + filter.slice(1)}
      </Text>
    </TouchableOpacity>
  );

  // ✅ Skeleton Loader — only on very first load
  if (isLoading && applications.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.header}>
          <View style={styles.backButton} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Applications
          </Text>
          <View style={styles.addButton} />
        </View>
        <SkeletonApplicationList count={5} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Applications
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/(student)/applications/new" as any)}
        >
          <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrapper}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color={colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search applications..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filtersContainer}>
            {filters.map(renderFilterChip)}
          </View>
        </ScrollView>
      </View>

      <FlatList
        data={filteredApplications}
        renderItem={renderApplication}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={() => {
          if (hasMore && !isLoading && !isRefreshing) loadNext();
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>
              No Applications
            </Text>
            <Text
              style={[styles.emptyStateDescription, { color: colors.textSecondary }]}
            >
              Start applying to internships to build your career
            </Text>
            <TouchableOpacity
              style={[styles.emptyStateButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(student)/applications/new" as any)}
            >
              <Text style={styles.emptyStateButtonText}>Apply Now</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          isLoading && applications.length > 0 ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
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
    paddingTop: Platform.OS === "ios" ? 12 : 16,
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
  searchWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
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
  applicationCard: {
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
  companyInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  companyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  companyInitial: {
    fontSize: 18,
    fontWeight: "700",
  },
  companyDetails: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "700",
  },
  positionName: {
    fontSize: 14,
    marginTop: 2,
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
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  footerText: {
    fontSize: 12,
    marginLeft: 4,
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