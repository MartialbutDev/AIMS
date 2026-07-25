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
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import Colors from "../../../src/theme/colors";

const { width } = Dimensions.get("window");

interface Application {
  id: string;
  company: string;
  position: string;
  location: string;
  dateApplied: string;
  status: "pending" | "reviewing" | "interview" | "accepted" | "rejected";
}

const mockApplications: Application[] = [
  {
    id: "1",
    company: "TechCorp Inc.",
    position: "Software Engineering Intern",
    location: "Makati, Philippines",
    dateApplied: "2026-03-15",
    status: "reviewing",
  },
  {
    id: "2",
    company: "Digital Solutions Co.",
    position: "Frontend Developer Intern",
    location: "Taguig, Philippines",
    dateApplied: "2026-03-10",
    status: "interview",
  },
  {
    id: "3",
    company: "Cloud Systems Ltd.",
    position: "DevOps Intern",
    location: "Quezon City, Philippines",
    dateApplied: "2026-03-05",
    status: "pending",
  },
  {
    id: "4",
    company: "Data Analytics Corp.",
    position: "Data Science Intern",
    location: "Pasig, Philippines",
    dateApplied: "2026-02-28",
    status: "accepted",
  },
  {
    id: "5",
    company: "StartUp Innovations",
    position: "Mobile Developer Intern",
    location: "BGC, Taguig",
    dateApplied: "2026-02-20",
    status: "rejected",
  },
];

const statusColors = {
  pending: "#F59E0B",
  reviewing: "#3B82F6",
  interview: "#8B5CF6",
  accepted: "#10B981",
  rejected: "#EF4444",
};

const statusIcons = {
  pending: "time-outline",
  reviewing: "sync-outline",
  interview: "people-outline",
  accepted: "checkmark-circle-outline",
  rejected: "close-circle-outline",
};

export default function ApplicationsScreen() {
  const [applications, setApplications] = useState(mockApplications);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const filters = ["all", "pending", "reviewing", "interview", "accepted", "rejected"];

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch = app.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.position.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === "all" || app.status === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getDaysAgo = (date: string) => {
    const now = new Date();
    const applied = new Date(date);
    const diffTime = Math.abs(now.getTime() - applied.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  };

  const renderApplication = ({ item }: { item: Application }) => (
    <TouchableOpacity
      style={styles.applicationCard}
      onPress={() => router.push(`/(student)/applications/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.companyInfo}>
          <View style={styles.companyAvatar}>
            <Text style={styles.companyInitial}>
              {item.company.charAt(0)}
            </Text>
          </View>
          <View style={styles.companyDetails}>
            <Text style={styles.companyName}>{item.company}</Text>
            <Text style={styles.positionName}>{item.position}</Text>
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
          <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.footerText}>{item.location}</Text>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.footerText}>Applied {getDaysAgo(item.dateApplied)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Applications</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/(student)/applications/new" as any)}
        >
          <Ionicons name="add-circle-outline" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search applications..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyStateTitle}>No Applications</Text>
            <Text style={styles.emptyStateDescription}>
              Start applying to internships to build your career
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => router.push("/(student)/applications/new" as any)}
            >
              <Text style={styles.emptyStateButtonText}>Apply Now</Text>
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

  searchWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  searchIcon: {
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
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

  applicationCard: {
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

  companyInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  companyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}10`,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  companyInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
  },

  companyDetails: {
    flex: 1,
  },

  companyName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  positionName: {
    fontSize: 14,
    color: Colors.textSecondary,
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
    borderTopColor: Colors.border,
  },

  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },

  footerText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 4,
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