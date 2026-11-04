// app/(student)/documents/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";

import { useTheme } from "../../../src/context/ThemeContext";
import { useAutoHideTab } from "../../../src/hooks/useAutoHideTab";
import api from "../../../src/services/api";
import { BASE_URL } from "../../../src/config/env";
import { SkeletonDocumentList } from "../../../src/components/common/Skeleton";

interface Document {
  id: string;
  type: string;
  description: string;
  original_filename?: string;
  verification_status: string;
  created_at: string;
  file_path?: string;
  validation_confidence?: number;
  validation_message?: string;
}

// ✅ Per-type icons
const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  resume: "person-outline",
  application_letter: "mail-outline",
  waiver: "document-text-outline",
  medical_certificate: "medkit-outline",
  internship_plan: "clipboard-outline",
  insurance: "shield-checkmark-outline",
  endorsement_letter: "ribbon-outline",
  acceptance_letter: "checkmark-done-outline",
  certificate_of_completion: "trophy-outline",
  requirements: "list-outline",
  document: "document-outline",
  transcript: "school-outline",
  user_id: "card-outline",
};

// ✅ Three-tier status: All / Verified / Pending / Rejected
const FILTERS = [
  { value: "all", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

// ✅ Status → color mapping
const STATUS_COLORS = {
  verified: "#10B981", // green
  pending: "#F59E0B",  // amber
  rejected: "#EF4444", // red
};

// ✅ Robust date parser — handles ISO strings, with/without timezone
const parseDate = (value?: string | null): number => {
  if (!value) return 0;
  // Fix the common case where backend returns a datetime without timezone
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const t = new Date(normalized).getTime();
  return isNaN(t) ? 0 : t;
};

export default function DocumentsScreen() {
  const { colors, isDark } = useTheme();
  const { handleScroll } = useAutoHideTab();
  const insets = useSafeAreaInsets();
  const [actionDocument, setActionDocument] = useState<Document | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const fetchDocuments = async () => {
    try {
      const response = await api.get("/documents/");
      setDocuments(response.data);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocuments();
  };

  // ✅ Sort newest first (top) → oldest last (bottom)
  //    Then apply the status filter on top of the sorted list.
  const sortedDocuments = [...documents].sort(
    (a, b) => parseDate(b.created_at) - parseDate(a.created_at)
  );

  const filteredDocuments =
    selectedFilter === "all"
      ? sortedDocuments
      : sortedDocuments.filter((d) => d.verification_status === selectedFilter);

  const getStatusColor = (status: string) => {
    if (isDark) return ({ verified: colors.approved, pending: colors.pending, rejected: colors.rejected } as Record<string, string>)[status] || colors.pending;
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "#F59E0B";
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case "verified":
        return "checkmark-circle-outline";
      case "rejected":
        return "close-circle-outline";
      case "pending":
      default:
        return "time-outline";
    }
  };

  const getTypeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    return TYPE_ICONS[type.toLowerCase()] || "document-text-outline";
  };

  const deleteDocument = async (document: Document) => {
    setDeletingId(document.id);
    try {
      await api.delete(`/documents/${encodeURIComponent(document.id)}`);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      Alert.alert("Document deleted", "Your upload has been removed.");
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      Alert.alert("Could not delete document", typeof detail === "string"
        ? detail : "Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (document: Document) => {
    Alert.alert("Delete document?", `Remove ${document.original_filename || document.type.replace(/_/g, " ")}? This cannot be undone. Documents already used or reviewed must be retained.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteDocument(document) },
    ]);
  };

  const handlePreview = async (document: Document) => {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) {
        Alert.alert("Error", "Session expired. Please log in again.");
        return;
      }

      const url = `${BASE_URL}/api/v1/documents/${document.id}/image?token=${encodeURIComponent(
        token
      )}`;

      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Error", "Cannot open this file on this device");
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error("Preview error:", error);
      Alert.alert("Error", "Failed to open document");
    }
  };

  // ✅ Skeleton on first load
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar
          style={isDark ? "light" : "dark"}
          backgroundColor={colors.background}
        />
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            My Documents
          </Text>
          <View style={styles.uploadButton} />
        </View>
        <SkeletonDocumentList count={5} />
      </View>
    );
  }

  const renderDocument = ({ item }: { item: Document }) => {
    const statusColor = getStatusColor(item.verification_status);
    const displayName = item.type.replace(/_/g, " ").toUpperCase();
    const subtitle = item.original_filename || item.description || null;
    const typeIcon = getTypeIcon(item.type);

    // Confidence badge color reflects status
    const confidenceColor =
      item.verification_status === "verified"
        ? colors.success
        : item.verification_status === "rejected"
        ? colors.error
        : colors.warning;

    return (
      <TouchableOpacity
        style={[styles.documentCard, { backgroundColor: colors.card }]}
        onPress={() => router.push(`/(student)/documents/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.documentIcon,
            { backgroundColor: `${colors.primary}10` },
          ]}
        >
          <Ionicons name={typeIcon} size={24} color={colors.accent} />
        </View>

        <View style={styles.documentInfo}>
          <Text
            style={[styles.documentType, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.documentDescription,
                { color: colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
          <Text style={[styles.documentDate, { color: colors.textSecondary }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.documentActions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Options for ${item.original_filename || item.type.replace(/_/g, " ")}`}
            accessibilityState={{ disabled: deletingId !== null, expanded: actionDocument?.id === item.id, busy: deletingId === item.id }}
            disabled={deletingId !== null}
            style={[styles.optionsButton, { opacity: deletingId !== null ? 0.5 : 1 }]}
            onPress={(event) => { event.stopPropagation(); setActionDocument(item); }}
          >
            {deletingId === item.id ? <ActivityIndicator size="small" color={colors.accent} />
              : <Ionicons name="ellipsis-vertical" size={22} color={colors.textSecondary} />}
          </TouchableOpacity>

          <View
            style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}
          >
            <Ionicons
              name={getStatusIcon(item.verification_status)}
              size={12}
              color={statusColor}
              style={styles.statusIcon}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.verification_status.charAt(0).toUpperCase() +
                item.verification_status.slice(1)}
            </Text>
          </View>

          {item.validation_confidence !== null &&
            item.validation_confidence !== undefined && (
              <View
                style={[
                  styles.confidenceBadge,
                  { backgroundColor: `${confidenceColor}15` },
                ]}
              >
                <Ionicons
                  name={
                    item.verification_status === "verified"
                      ? "checkmark-circle"
                      : item.verification_status === "rejected"
                      ? "close-circle"
                      : "alert-circle"
                  }
                  size={10}
                  color={confidenceColor}
                />
                <Text
                  style={[styles.confidenceText, { color: confidenceColor }]}
                >
                  {item.validation_confidence}%
                </Text>
              </View>
            )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterChip = (filter: { value: string; label: string }) => {
    const isActive = selectedFilter === filter.value;
    const count =
      filter.value === "all"
        ? documents.length
        : documents.filter((d) => d.verification_status === filter.value).length;

    return (
      <TouchableOpacity
        key={filter.value}
        style={[
          styles.filterChip,
          {
            backgroundColor: isActive ? colors.primary : colors.card,
            borderColor: isActive ? colors.primary : colors.border,
          },
        ]}
        onPress={() => setSelectedFilter(filter.value)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.filterChipText,
            { color: isActive ? "#FFFFFF" : colors.textSecondary },
          ]}
        >
          {filter.label}
        </Text>
        {filter.value !== "all" && count > 0 && (
          <View
            style={[
              styles.filterCountBadge,
              {
                backgroundColor: isActive
                  ? "rgba(255,255,255,0.25)"
                  : `${colors.primary}15`,
              },
            ]}
          >
            <Text
              style={[
                styles.filterCountText,
                { color: isActive ? "#FFFFFF" : colors.primary },
              ]}
            >
              {count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={colors.background}
      />

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          My Documents
        </Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => router.push("/(student)/documents/upload")}
        >
          <Ionicons name="add-circle-outline" size={28} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity accessibilityRole="button" onPress={() => router.push("/(student)/documents/templates" as never)} style={{ marginHorizontal: 20, marginBottom: 14, padding: 16, borderRadius: 14, backgroundColor: isDark ? colors.card : "#0b0b2f", borderWidth: isDark ? 1 : 0, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Ionicons name="download-outline" size={24} color="#ffc629" />
        <View style={{ flex: 1 }}><Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Approved CITC forms</Text><Text style={{ color: "#d4d4e7", fontSize: 12, marginTop: 4 }}>Templates, instructions and submission deadlines</Text></View>
        <Ionicons name="chevron-forward" size={18} color="#ffc629" />
      </TouchableOpacity>

      {/* Filter chips */}
      {documents.length > 0 && (
        <View style={styles.filtersWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
          >
            {FILTERS.map(renderFilterChip)}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filteredDocuments}
        renderItem={renderDocument}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="document-text-outline"
              size={64}
              color={colors.border}
            />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {selectedFilter === "all"
                ? "No Documents"
                : `No ${selectedFilter} Documents`}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {selectedFilter === "all"
                ? "Upload your internship documents to get started"
                : `Try a different filter or upload a new document`}
            </Text>
            {selectedFilter === "all" && (
              <TouchableOpacity
                style={[
                  styles.emptyButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() => router.push("/(student)/documents/upload")}
              >
                <Text style={styles.emptyButtonText}>Upload Now</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListFooterComponent={<View style={styles.listFooter} />}
      />

      <Modal
        visible={actionDocument !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionDocument(null)}
      >
        <View style={styles.menuOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close document options"
            onPress={() => setActionDocument(null)}
          />
          <View
            accessibilityViewIsModal
            style={[styles.menuSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}
          >
            <ScrollView bounces={false}>
              <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text accessibilityRole="header" style={[styles.menuTitle, { color: colors.textPrimary }]}>Document options</Text>
                  <Text numberOfLines={2} style={[styles.menuFilename, { color: colors.textSecondary }]}>
                    {actionDocument?.original_filename || actionDocument?.type.replace(/_/g, " ")}
                  </Text>
                </View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close document options" style={styles.optionsButton} onPress={() => setActionDocument(null)}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.menuOption}
                onPress={() => {
                  const document = actionDocument;
                  setActionDocument(null);
                  if (document) router.push(`/(student)/documents/${document.id}` as any);
                }}
              >
                <Ionicons name="information-circle-outline" size={22} color={colors.accent} />
                <Text style={[styles.menuOptionText, { color: colors.textPrimary }]}>View details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.menuOption}
                onPress={() => {
                  const document = actionDocument;
                  setActionDocument(null);
                  if (document) void handlePreview(document);
                }}
              >
                <Ionicons name="eye-outline" size={22} color={colors.accent} />
                <Text style={[styles.menuOptionText, { color: colors.textPrimary }]}>View document</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.menuOption, { borderTopWidth: 1, borderTopColor: colors.border }]}
                onPress={() => {
                  const document = actionDocument;
                  setActionDocument(null);
                  if (document) confirmDelete(document);
                }}
              >
                <Ionicons name="trash-outline" size={22} color={colors.error} />
                <Text style={[styles.menuOptionText, { color: colors.error }]}>Delete document</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  uploadButton: { padding: 4 },

  filtersWrapper: {
    paddingBottom: 12,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  filterCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: "700",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexGrow: 1,
  },
  listFooter: { height: 80 },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  documentInfo: { flex: 1 },
  documentType: { fontSize: 15, fontWeight: "600" },
  documentDescription: { fontSize: 13, marginTop: 2 },
  documentDate: { fontSize: 11, marginTop: 2, opacity: 0.7 },
  documentActions: { alignItems: "flex-end", gap: 4 },
  optionsButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  menuSheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "80%",
    alignSelf: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  menuTitle: { fontSize: 17, fontWeight: "700" },
  menuFilename: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  menuOption: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 14 },
  menuOptionText: { flex: 1, fontSize: 15, fontWeight: "500" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIcon: { marginRight: 4 },
  statusText: { fontSize: 11, fontWeight: "600" },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  confidenceText: { fontSize: 9, fontWeight: "600" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 16 },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  emptyButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  emptyButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});