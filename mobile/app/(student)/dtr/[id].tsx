// app/(student)/dtr/[id].tsx
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

// Define the status type
type DTRStatus = "pending" | "submitted" | "approved" | "rejected";

const getDTRDetail = (id: string) => ({
  id,
  date: "2026-03-15",
  day: "Monday",
  timeIn: "08:00 AM",
  timeOut: "05:00 PM",
  totalHours: "8h 0m",
  status: "approved" as DTRStatus,
  overtime: "0h 0m",
  notes: "Regular work day. Completed tasks: UI design, code review, and team meeting.",
  tasks: [
    "UI design for dashboard",
    "Code review for applications module",
    "Team meeting - sprint planning",
  ],
  location: {
    address: "TechCorp Office, Makati",
    latitude: 14.5547,
    longitude: 121.0244,
  },
  attachments: [
    { name: "Timesheet.pdf", size: "245 KB" },
    { name: "Tasks-list.docx", size: "89 KB" },
  ],
});

export default function DTRDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const record = getDTRDetail(id);

  const statusColors: Record<DTRStatus, string> = {
    pending: "#F59E0B",
    submitted: "#3B82F6",
    approved: "#10B981",
    rejected: "#EF4444",
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleEdit = () => {
    router.push(`/(student)/dtr/${id}/edit` as any);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Record",
      "Are you sure you want to delete this DTR record?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => console.log("Deleted") },
      ]
    );
  };

  const handleDownload = () => {
    console.log("Downloading...");
  };

  // Fix: Check if status is pending correctly
  const isPending = record.status === "pending";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DTR Details</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Status Header */}
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.dateText}>{record.date}</Text>
              <Text style={styles.dayText}>{record.day}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColors[record.status]}15` }]}>
              <Text style={[styles.statusText, { color: statusColors[record.status] }]}>
                {getStatusText(record.status)}
              </Text>
            </View>
          </View>

          {/* Time Info */}
          <View style={styles.timeContainer}>
            <View style={styles.timeCard}>
              <Text style={styles.timeLabel}>Time In</Text>
              <Text style={styles.timeValue}>{record.timeIn}</Text>
            </View>
            <View style={styles.timeArrow}>
              <Ionicons name="arrow-forward-outline" size={24} color={Colors.textSecondary} />
            </View>
            <View style={styles.timeCard}>
              <Text style={styles.timeLabel}>Time Out</Text>
              <Text style={styles.timeValue}>{record.timeOut}</Text>
            </View>
          </View>

          {/* Summary Stats */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Hours</Text>
              <Text style={styles.summaryValue}>{record.totalHours}</Text>
            </View>
            {record.overtime && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Overtime</Text>
                <Text style={[styles.summaryValue, { color: "#F59E0B" }]}>
                  {record.overtime}
                </Text>
              </View>
            )}
          </View>

          {/* Notes */}
          {record.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notesText}>{record.notes}</Text>
            </View>
          )}

          {/* Tasks */}
          {record.tasks && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tasks Completed</Text>
              {record.tasks.map((task, index) => (
                <View key={index} style={styles.taskItem}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.primary} style={styles.taskIcon} />
                  <Text style={styles.taskText}>{task}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Attachments */}
          {record.attachments && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Attachments</Text>
              {record.attachments.map((file, index) => (
                <TouchableOpacity key={index} style={styles.fileItem} activeOpacity={0.7}>
                  <Ionicons name="document-outline" size={20} color={Colors.primary} />
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName}>{file.name}</Text>
                    <Text style={styles.fileSize}>{file.size}</Text>
                  </View>
                  <Ionicons name="download-outline" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Location */}
          {record.location && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.locationCard}>
                <Ionicons name="location-outline" size={20} color={Colors.primary} style={styles.locationIcon} />
                <Text style={styles.locationText}>{record.location.address}</Text>
              </View>
            </View>
          )}

          {/* Actions - Only show for pending status */}
          {isPending && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
                <Ionicons name="create-outline" size={20} color={Colors.white} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
            <Ionicons name="download-outline" size={20} color={Colors.primary} />
            <Text style={styles.downloadButtonText}>Download PDF</Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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

  dateText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  dayText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },

  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },

  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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

  timeCard: {
    flex: 1,
    alignItems: "center",
  },

  timeLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },

  timeValue: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  timeArrow: {
    paddingHorizontal: 12,
  },

  summaryContainer: {
    flexDirection: "row",
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

  summaryItem: {
    flex: 1,
    alignItems: "center",
  },

  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },

  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  section: {
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 10,
  },

  notesText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  taskIcon: {
    marginRight: 10,
  },

  taskText: {
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
  },

  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  fileInfo: {
    flex: 1,
    marginLeft: 10,
  },

  fileName: {
    fontSize: 14,
    color: Colors.textPrimary,
  },

  fileSize: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  locationIcon: {
    marginRight: 10,
  },

  locationText: {
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
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

  deleteButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.white,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EF4444",
  },

  deleteButtonText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },

  downloadButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  downloadButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.primary,
    marginLeft: 8,
  },
});