// app/(student)/applications/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Platform,
} from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";
import api from "../../../src/services/api";

interface ApplicationDetail {
  id: string;
  company_id: string;
  company_name: string;
  position: string;
  status: "pending" | "reviewing" | "interview" | "accepted" | "rejected" | "withdrawn";
  applied_date: string;
  cover_letter?: string;
  feedback?: string;
}

export default function ApplicationDetailScreen() {
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<ApplicationDetail | null>(null);

  useEffect(() => {
    fetchApplicationDetail();
  }, [id]);

  const fetchApplicationDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/applications/${id}`);
      setApplication(response.data);
    } catch (error) {
      console.error("Error fetching application detail:", error);
      Alert.alert("Error", "Failed to load application details");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      pending: "#F59E0B",
      reviewing: "#3B82F6",
      interview: "#8B5CF6",
      accepted: "#10B981",
      rejected: "#EF4444",
      withdrawn: "#6B7280",
    };
    return statusColors[status] || "#6B7280";
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      pending: "time-outline",
      reviewing: "sync-outline",
      interview: "people-outline",
      accepted: "checkmark-circle-outline",
      rejected: "close-circle-outline",
      withdrawn: "ban-outline",
    };
    return icons[status] || "ellipse-outline";
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleWithdraw = async () => {
    Alert.alert(
      "Withdraw Application",
      "Are you sure you want to withdraw this application?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            try {
              await api.post(`/applications/${id}/withdraw`);
              Alert.alert("Success", "Application withdrawn successfully");
              router.back();
            } catch (error) {
              Alert.alert("Error", "Failed to withdraw application");
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading application...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <Ionicons name="document-text-outline" size={64} color={colors.border} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>Application not found</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={fetchApplicationDetail}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = getStatusColor(application.status);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Application Details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.statusHeader, { backgroundColor: colors.card }]}>
          <View style={styles.companySection}>
            <View style={[styles.companyAvatar, { backgroundColor: `${colors.primary}10` }]}>
              <Text style={[styles.companyInitial, { color: colors.primary }]}>{application.company_name.charAt(0)}</Text>
            </View>
            <View>
              <Text style={[styles.companyName, { color: colors.textPrimary }]}>{application.company_name}</Text>
              <Text style={[styles.positionName, { color: colors.textSecondary }]}>{application.position}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
            <Ionicons
              name={getStatusIcon(application.status)}
              size={16}
              color={statusColor}
              style={styles.statusIcon}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(application.status)}
            </Text>
          </View>
        </View>

        <View style={[styles.infoRow, { backgroundColor: colors.card }]}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Applied on {formatDate(application.applied_date)}</Text>
          </View>
        </View>

        {application.cover_letter && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Cover Letter</Text>
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{application.cover_letter}</Text>
          </View>
        )}

        {application.feedback && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Feedback</Text>
            <View style={[styles.feedbackCard, { backgroundColor: `${colors.primary}05`, borderColor: `${colors.primary}20` }]}>
              <Text style={[styles.feedbackText, { color: colors.textPrimary }]}>{application.feedback}</Text>
            </View>
          </View>
        )}

        {application.status !== "withdrawn" && application.status !== "accepted" && application.status !== "rejected" && (
          <TouchableOpacity style={styles.withdrawButton} onPress={handleWithdraw}>
            <Text style={styles.withdrawButtonText}>Withdraw Application</Text>
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
    flex: 1,
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
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
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
  statusHeader: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  companySection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  companyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  companyInitial: {
    fontSize: 20,
    fontWeight: "700",
  },
  companyName: {
    fontSize: 18,
    fontWeight: "700",
  },
  positionName: {
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  infoText: {
    fontSize: 13,
    marginLeft: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
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
  withdrawButton: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  withdrawButtonText: {
    fontSize: 14,
    color: "#EF4444",
    fontWeight: "500",
  },
});