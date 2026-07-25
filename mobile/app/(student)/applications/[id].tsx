// app/(student)/applications/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import Colors from "../../../src/theme/colors";

const getApplicationDetail = (id: string) => ({
  id,
  company: "TechCorp Inc.",
  position: "Software Engineering Intern",
  location: "Makati, Philippines",
  dateApplied: "2026-03-15",
  status: "reviewing" as const,
  description: "We are looking for a passionate software engineering intern to join our team. You will work on real-world projects and learn from experienced engineers.",
  requirements: [
    "Currently pursuing BS in Computer Science or related field",
    "Knowledge of JavaScript/TypeScript",
    "Familiarity with React or React Native",
    "Good problem-solving skills",
    "Ability to work in a team environment",
  ],
  contact: {
    name: "Maria Santos",
    email: "maria@techcorp.com",
    phone: "+63 912 3456 789",
  },
  timeline: [
    { event: "Application Submitted", date: "2026-03-15", completed: true },
    { event: "Application Reviewed", date: "2026-03-18", completed: true },
    { event: "Interview Scheduled", date: "2026-03-22", completed: false },
    { event: "Decision", date: "2026-03-29", completed: false },
  ],
});

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const application = getApplicationDetail(id);

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

  const handleWithdraw = () => {
    console.log("Withdraw application");
  };

  const handleContact = () => {
    console.log("Contact employer");
  };

  const handleTrackStatus = () => {
    console.log("Track status");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Application Details</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.statusHeader}>
            <View style={styles.companySection}>
              <View style={styles.companyAvatar}>
                <Text style={styles.companyInitial}>{application.company.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.companyName}>{application.company}</Text>
                <Text style={styles.positionName}>{application.position}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColors[application.status]}15` }]}>
              <Ionicons
                name={statusIcons[application.status]}
                size={16}
                color={statusColors[application.status]}
                style={styles.statusIcon}
              />
              <Text style={[styles.statusText, { color: statusColors[application.status] }]}>
                {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.infoText}>{application.location}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.infoText}>Applied on {application.dateApplied}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{application.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            {application.requirements.map((req, index) => (
              <View key={index} style={styles.requirementItem}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.primary} style={styles.requirementIcon} />
                <Text style={styles.requirementText}>{req}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Application Timeline</Text>
            {application.timeline.map((item, index) => (
              <View key={index} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, item.completed && styles.timelineDotCompleted]} />
                  {index < application.timeline.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineEvent, item.completed && styles.timelineEventCompleted]}>
                    {item.event}
                  </Text>
                  <Text style={styles.timelineDate}>{item.date}</Text>
                </View>
                {item.completed && (
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                )}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Person</Text>
            <View style={styles.contactCard}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactInitial}>
                  {application.contact.name.charAt(0)}
                </Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{application.contact.name}</Text>
                <View style={styles.contactDetail}>
                  <Ionicons name="mail-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.contactDetailText}>{application.contact.email}</Text>
                </View>
                <View style={styles.contactDetail}>
                  <Ionicons name="call-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.contactDetailText}>{application.contact.phone}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={handleTrackStatus}
            >
              <Ionicons name="trending-up-outline" size={20} color={Colors.white} />
              <Text style={styles.primaryActionText}>Track Status</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={handleContact}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.primary} />
              <Text style={styles.secondaryActionText}>Contact</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.withdrawButton}
            onPress={handleWithdraw}
          >
            <Text style={styles.withdrawButtonText}>Withdraw Application</Text>
          </TouchableOpacity>
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

  statusHeader: {
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

  companySection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  companyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}10`,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  companyInitial: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.primary,
  },

  companyName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  positionName: {
    fontSize: 14,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.white,
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
    color: Colors.textSecondary,
    marginLeft: 6,
  },

  section: {
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 12,
  },

  descriptionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  requirementIcon: {
    marginRight: 10,
  },

  requirementText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },

  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  timelineLeft: {
    alignItems: "center",
    marginRight: 12,
    width: 20,
  },

  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.border,
    marginTop: 4,
  },

  timelineDotCompleted: {
    backgroundColor: "#10B981",
  },

  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: 4,
    marginBottom: 4,
  },

  timelineContent: {
    flex: 1,
  },

  timelineEvent: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  timelineEventCompleted: {
    color: Colors.textPrimary,
    fontWeight: "600",
  },

  timelineDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    opacity: 0.7,
    marginTop: 2,
  },

  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.primary}10`,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  contactInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
  },

  contactInfo: {
    flex: 1,
  },

  contactName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 2,
  },

  contactDetail: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },

  contactDetailText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 6,
  },

  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },

  primaryAction: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  primaryActionText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },

  secondaryAction: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.white,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.primary,
  },

  secondaryActionText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },

  withdrawButton: {
    paddingVertical: 12,
    alignItems: "center",
  },

  withdrawButtonText: {
    fontSize: 14,
    color: "#EF4444",
    fontWeight: "500",
  },
});