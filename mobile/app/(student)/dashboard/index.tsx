// app/(student)/dashboard/index.tsx
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

// Types
interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color: string;
  onPress?: () => void;
}

interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "application" | "document" | "journal" | "dtr";
  status?: "pending" | "approved" | "rejected" | "submitted";
}

// Mock Data
const stats: StatCardProps[] = [
  {
    icon: "briefcase-outline",
    label: "Active Applications",
    value: 2,
    color: Colors.primary,
    onPress: () => router.push("/(student)/applications" as any),
  },
  {
    icon: "document-text-outline",
    label: "Documents",
    value: 4,
    color: "#0EA5E9",
    onPress: () => router.push("/(student)/documents" as any),
  },
  {
    icon: "calendar-outline",
    label: "DTR Submissions",
    value: 12,
    color: "#10B981",
    onPress: () => router.push("/(student)/dtr" as any),
  },
  {
    icon: "book-outline",
    label: "Journals",
    value: 8,
    color: "#F59E0B",
    onPress: () => router.push("/(student)/journals" as any),
  },
];

const recentActivities: ActivityItem[] = [
  {
    id: "1",
    title: "Internship Application Submitted",
    description: "Software Engineering Intern at TechCorp",
    time: "2 hours ago",
    type: "application",
    status: "pending",
  },
  {
    id: "2",
    title: "Document Uploaded",
    description: "Updated Resume.pdf",
    time: "5 hours ago",
    type: "document",
    status: "submitted",
  },
  {
    id: "3",
    title: "Weekly Journal Submitted",
    description: "Week 3 - Learning React Native",
    time: "1 day ago",
    type: "journal",
    status: "approved",
  },
  {
    id: "4",
    title: "DTR Filed",
    description: "March 2026 - Week 2 Timesheet",
    time: "2 days ago",
    type: "dtr",
    status: "approved",
  },
];

export default function StudentDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const [greeting] = useState(getGreeting());

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  const renderStatCard = ({ item }: { item: StatCardProps }) => (
    <TouchableOpacity
      style={styles.statCard}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.statIconContainer, { backgroundColor: `${item.color}15` }]}>
        <Ionicons name={item.icon} size={24} color={item.color} />
      </View>
      <Text style={styles.statValue}>{item.value}</Text>
      <Text style={styles.statLabel}>{item.label}</Text>
    </TouchableOpacity>
  );

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "application":
        return "briefcase-outline";
      case "document":
        return "document-text-outline";
      case "journal":
        return "book-outline";
      case "dtr":
        return "calendar-outline";
      default:
        return "ellipse-outline";
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "approved":
        return "#10B981";
      case "rejected":
        return "#EF4444";
      case "submitted":
        return "#3B82F6";
      default:
        return "#6B7280";
    }
  };

  const getStatusIcon = (status?: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case "pending":
        return "time-outline";
      case "approved":
        return "checkmark-circle-outline";
      case "rejected":
        return "close-circle-outline";
      case "submitted":
        return "send-sharp";
      default:
        return "ellipse-outline";
    }
  };

  const renderActivityItem = ({ item }: { item: ActivityItem }) => (
    <TouchableOpacity style={styles.activityItem} activeOpacity={0.7}>
      <View style={styles.activityLeft}>
        <View style={styles.activityIconContainer}>
          <Ionicons name={getActivityIcon(item.type)} size={20} color={Colors.primary} />
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityTitle}>{item.title}</Text>
          <Text style={styles.activityDescription}>{item.description}</Text>
          <Text style={styles.activityTime}>{item.time}</Text>
        </View>
      </View>
      {item.status && (
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
          <Ionicons
            name={getStatusIcon(item.status)}
            size={12}
            color={getStatusColor(item.status)}
            style={styles.statusIcon}
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const QuickAction = ({ 
    icon, 
    label, 
    onPress 
  }: { 
    icon: keyof typeof Ionicons.glyphMap; 
    label: string; 
    onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.quickActionIconContainer}>
        <Ionicons name={icon} size={24} color={Colors.primary} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  // Navigation functions for quick actions
  const navigateTo = (route: string) => {
    router.push(route as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, Student!</Text>
            <Text style={styles.subGreeting}>Welcome back to your dashboard</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigateTo("/(student)/notifications")}
            >
              <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>3</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigateTo("/(student)/profile")}
            >
              <Ionicons name="person-circle-outline" size={32} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <FlatList
            data={stats}
            renderItem={renderStatCard}
            keyExtractor={(item) => item.label}
            numColumns={2}
            scrollEnabled={false}
            contentContainerStyle={styles.statsList}
            columnWrapperStyle={styles.statsRow}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickAction
              icon="briefcase-outline"
              label="Apply Internship"
              onPress={() => navigateTo("/(student)/applications/new")}
            />
            <QuickAction
              icon="document-text-outline"
              label="Upload Document"
              onPress={() => navigateTo("/(student)/documents/upload")}
            />
            <QuickAction
              icon="calendar-outline"
              label="Submit DTR"
              onPress={() => navigateTo("/(student)/dtr/new")}
            />
            <QuickAction
              icon="book-outline"
              label="Write Journal"
              onPress={() => navigateTo("/(student)/journals/new")}
            />
            <QuickAction
              icon="stats-chart-outline"
              label="View Reports"
              onPress={() => navigateTo("/(student)/reports")}
            />
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => console.log("View all")}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.activityList}>
            {recentActivities.map((item) => (
              <View key={item.id}>
                {renderActivityItem({ item })}
                {item.id !== recentActivities[recentActivities.length - 1].id && (
                  <View style={styles.activityDivider} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Footer Spacer */}
        <View style={styles.footerSpacer} />
      </ScrollView>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },

  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },

  subGreeting: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },

  notificationButton: {
    position: "relative",
    padding: 8,
    marginRight: 8,
  },

  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  notificationBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 4,
  },

  profileButton: {
    padding: 4,
  },

  statsGrid: {
    paddingHorizontal: 16,
  },

  statsList: {
    paddingVertical: 8,
  },

  statsRow: {
    justifyContent: "space-between",
  },

  statCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    width: (width - 48) / 2,
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

  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },

  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  section: {
    paddingHorizontal: 24,
    marginTop: 16,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },

  seeAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "600",
  },

  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  quickAction: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    width: (width - 56) / 2,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  quickActionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.primary}10`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  quickActionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
    textAlign: "center",
  },

  activityList: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  activityItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },

  activityLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}10`,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  activityContent: {
    flex: 1,
  },

  activityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  activityDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  activityTime: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    opacity: 0.7,
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

  activityDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 52,
  },

  footerSpacer: {
    height: 30,
  },
});