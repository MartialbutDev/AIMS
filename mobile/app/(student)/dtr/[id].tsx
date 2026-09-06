// app/(student)/dtr/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";
import { dtrService, DTR } from "../../../src/services/dtr.service";
import { BASE_URL } from "../../../src/config/env";
import DocumentPreview from "../../../src/components/documents/DocumentPreview";

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
  pending: "Pending Time-Out",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export default function DTRDetailScreen() {
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [dtr, setDtr] = useState<DTR | null>(null);
  const [previewImage, setPreviewImage] = useState<string>("");
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDTR();
    }
  }, [id]);

  const fetchDTR = async () => {
    try {
      setLoading(true);
      const data = await dtrService.getDTRById(id);
      setDtr(data);
    } catch (error) {
      console.error("Error fetching DTR detail:", error);
      Alert.alert("Error", "Failed to load DTR details");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
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

  const getImageUri = (imagePath?: string) => {
    if (!imagePath) return null;
    if (imagePath.startsWith("http")) return imagePath;
    const cleanPath = imagePath.replace(/\\/g, "/");
    return `${BASE_URL}/static/${cleanPath}`;
  };

  const openImagePreview = (uri: string, title: string) => {
    setPreviewImage(uri);
    setPreviewTitle(title);
    setPreviewVisible(true);
  };

  const canTimeOut = dtr?.status === 'pending' && !dtr?.time_out;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading DTR details...</Text>
        </View>
      </View>
    );
  }

  if (!dtr) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
        <View style={styles.centerContent}>
          <Ionicons name="calendar-outline" size={64} color={colors.border} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>DTR record not found</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={fetchDTR}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusColor = statusColors[dtr.status] || colors.primary;
  const statusIcon = statusIcons[dtr.status] || "help-circle-outline";
  const imageInUri = getImageUri(dtr.image_in_path);
  const imageOutUri = getImageUri(dtr.image_out_path);
  const hasTimeOut = !!dtr.time_out;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>DTR Details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={[
          styles.content,
          canTimeOut && styles.contentWithButton,
        ]}
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={[styles.dateText, { color: colors.textPrimary }]}>{formatDate(dtr.date)}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
            <Ionicons name={statusIcon} size={16} color={statusColor} style={styles.statusIcon} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabels[dtr.status] || dtr.status}
            </Text>
          </View>

          <View style={styles.timeGrid}>
            <View style={styles.timeBlock}>
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Time In</Text>
              <View style={styles.timeValueRow}>
                <Ionicons name="log-in-outline" size={18} color="#10B981" />
                <Text style={[styles.timeValue, { color: colors.textPrimary }]}>{formatTime(dtr.time_in)}</Text>
              </View>
            </View>

            <View style={[styles.timeDivider, { backgroundColor: colors.border }]} />

            <View style={styles.timeBlock}>
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Time Out</Text>
              <View style={styles.timeValueRow}>
                <Ionicons 
                  name={hasTimeOut ? "log-out-outline" : "time-outline"} 
                  size={18} 
                  color={hasTimeOut ? "#EF4444" : colors.textSecondary} 
                />
                <Text style={[styles.timeValue, { color: hasTimeOut ? colors.textPrimary : colors.textSecondary }]}>
                  {hasTimeOut ? formatTime(dtr.time_out) : "Not yet"}
                </Text>
              </View>
            </View>

            <View style={[styles.timeDivider, { backgroundColor: colors.border }]} />

            <View style={styles.timeBlock}>
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Total Hours</Text>
              <View style={styles.timeValueRow}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text style={[styles.timeValue, { color: hasTimeOut ? colors.primary : colors.textSecondary }]}>
                  {hasTimeOut && dtr.total_hours ? `${dtr.total_hours} hrs` : "—"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {dtr.location_address && (
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              <Ionicons name="location-outline" size={16} color={colors.primary} /> Location
            </Text>
            <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
              {dtr.location_address}
            </Text>
          </View>
        )}

        {!!dtr.tasks_completed && (
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Tasks Completed</Text>
            <Text style={[styles.sectionText, { color: colors.textSecondary }]}>{dtr.tasks_completed}</Text>
          </View>
        )}

        {!!dtr.notes && (
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notes</Text>
            <Text style={[styles.sectionText, { color: colors.textSecondary }]}>{dtr.notes}</Text>
          </View>
        )}

        {!!dtr.feedback && (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: statusColor }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Coordinator Feedback</Text>
            <Text style={[styles.sectionText, { color: colors.textSecondary }]}>{dtr.feedback}</Text>
          </View>
        )}

        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Verification Photos</Text>
          <View style={styles.photosRow}>
            {imageInUri ? (
              <TouchableOpacity
                style={styles.photoContainer}
                onPress={() => openImagePreview(imageInUri, "Time-In Photo")}
                activeOpacity={0.8}
              >
                <Image source={{ uri: imageInUri }} style={styles.photo} />
                <View style={[styles.photoBadge, { backgroundColor: "rgba(16, 185, 129, 0.85)" }]}>
                  <Ionicons name="log-in-outline" size={10} color="#FFFFFF" />
                  <Text style={styles.photoBadgeText}>Time In</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.noPhotoContainer, { backgroundColor: `${colors.border}40` }]}>
                <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                <Text style={[styles.noPhotoText, { color: colors.textSecondary }]}>No Time-In Photo</Text>
              </View>
            )}

            {imageOutUri ? (
              <TouchableOpacity
                style={styles.photoContainer}
                onPress={() => openImagePreview(imageOutUri, "Time-Out Photo")}
                activeOpacity={0.8}
              >
                <Image source={{ uri: imageOutUri }} style={styles.photo} />
                <View style={[styles.photoBadge, { backgroundColor: "rgba(239, 68, 68, 0.85)" }]}>
                  <Ionicons name="log-out-outline" size={10} color="#FFFFFF" />
                  <Text style={styles.photoBadgeText}>Time Out</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.noPhotoContainer, { backgroundColor: `${colors.border}40` }]}>
                <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                <Text style={[styles.noPhotoText, { color: colors.textSecondary }]}>No Time-Out Photo</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {canTimeOut && (
        <View style={[styles.buttonContainer, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/(student)/dtr/time-out?id=${dtr.id}` as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
            <Text style={styles.actionButtonText}>Record Time-Out</Text>
          </TouchableOpacity>
        </View>
      )}

      <DocumentPreview
        visible={previewVisible}
        imageUri={previewImage}
        documentType="image"
        documentName={previewTitle}
        onClose={() => setPreviewVisible(false)}
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
    padding: 20,
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
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
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
    width: 32,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  contentWithButton: {
    paddingBottom: 100,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 18,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  statusIcon: {
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  timeGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  timeBlock: {
    flex: 1,
    alignItems: "center",
  },
  timeDivider: {
    width: 1,
    height: 32,
  },
  timeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  timeValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  sectionCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  photosRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  photoContainer: {
    flex: 1,
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  photo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  photoBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  noPhotoContainer: {
    flex: 1,
    height: 140,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  noPhotoText: {
    fontSize: 12,
    marginTop: 6,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});