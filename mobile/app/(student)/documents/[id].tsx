// app/(student)/documents/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";

import { useTheme } from "../../../src/context/ThemeContext";
import api from "../../../src/services/api";
import { BASE_URL } from "../../../src/config/env";

interface DocumentDetail {
  id: string;
  type: string;
  description: string;
  original_filename?: string;      // ✅ NEW
  verification_status: string;
  created_at: string;
  file_path?: string;
  extracted_text?: string;
  validation_confidence?: number;
  validation_message?: string;
}

export default function DocumentDetailScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [opening, setOpening] = useState(false);

  const fetchDocument = useCallback(
    async (showSpinner = true) => {
      if (!id) return;
      try {
        if (showSpinner) setLoading(true);
        const response = await api.get(`/documents/${id}`);
        setDocument(response.data);
      } catch (error) {
        console.error("Error fetching document:", error);
        Alert.alert("Error", "Failed to load document details");
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      fetchDocument(!document);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return colors.success;
      case "rejected":
        return colors.error;
      default:
        return colors.warning;
    }
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case "verified":
        return "checkmark-circle-outline";
      case "rejected":
        return "close-circle-outline";
      default:
        return "time-outline";
    }
  };

  const handlePreview = async () => {
    if (!document) return;
    try {
      setOpening(true);
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
    } finally {
      setOpening(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading document...
          </Text>
        </View>
      </View>
    );
  }

  if (!document) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <Ionicons name="document-text-outline" size={64} color={colors.border} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Document not found
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => fetchDocument(true)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusColor = getStatusColor(document.verification_status);
  const displayName = document.type.replace(/_/g, " ").toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={colors.background}
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back-outline"
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Document Details
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 30 + insets.bottom },
        ]}
      >
        {/* Header card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.iconContainer}>
            <Ionicons name="document-text-outline" size={48} color={colors.primary} />
          </View>

          <Text style={[styles.docType, { color: colors.textPrimary }]}>
            {displayName}
          </Text>

          <View
            style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}
          >
            <Ionicons
              name={getStatusIcon(document.verification_status)}
              size={16}
              color={statusColor}
              style={styles.statusIcon}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {document.verification_status.charAt(0).toUpperCase() +
                document.verification_status.slice(1)}
            </Text>
          </View>
        </View>

        {/* ✅ File Name section */}
        {document.original_filename && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              File Name
            </Text>
            <View
              style={[
                styles.fileNameCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="document-outline"
                size={18}
                color={colors.primary}
              />
              <Text
                style={[styles.fileNameText, { color: colors.textPrimary }]}
                numberOfLines={2}
              >
                {document.original_filename}
              </Text>
            </View>
          </View>
        )}

        {/* Validation */}
        {document.validation_confidence !== null &&
          document.validation_confidence !== undefined && (
            <View
              style={[
                styles.validationCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.validationHeader}>
                <Ionicons
                  name={
                    document.validation_confidence >= 50
                      ? "checkmark-circle"
                      : "alert-circle"
                  }
                  size={20}
                  color={
                    document.validation_confidence >= 50
                      ? colors.success
                      : colors.warning
                  }
                />
                <Text
                  style={[styles.validationTitle, { color: colors.textPrimary }]}
                >
                  Validation Confidence
                </Text>
              </View>
              <View style={styles.validationRow}>
                <Text
                  style={[styles.validationLabel, { color: colors.textSecondary }]}
                >
                  Score
                </Text>
                <Text
                  style={[
                    styles.validationScore,
                    {
                      color:
                        document.validation_confidence >= 50
                          ? colors.success
                          : colors.warning,
                    },
                  ]}
                >
                  {document.validation_confidence}%
                </Text>
              </View>
              {document.validation_message && (
                <Text
                  style={[
                    styles.validationMessage,
                    { color: colors.textSecondary },
                  ]}
                >
                  {document.validation_message}
                </Text>
              )}
            </View>
          )}

        {/* Description */}
        {document.description && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Description
            </Text>
            <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
              {document.description}
            </Text>
          </View>
        )}

        {/* Uploaded */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Uploaded
          </Text>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            {formatDate(document.created_at)}
          </Text>
        </View>

        {/* OCR text */}
        {document.extracted_text && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Extracted Text (OCR)
            </Text>
            <View
              style={[
                styles.ocrCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[styles.ocrText, { color: colors.textSecondary }]}
                numberOfLines={10}
              >
                {document.extracted_text}
              </Text>
            </View>
          </View>
        )}

        {/* Open document button */}
        <TouchableOpacity
          style={[
            styles.previewButton,
            { backgroundColor: colors.primary },
            opening && styles.previewButtonDisabled,
          ]}
          onPress={handlePreview}
          disabled={opening}
          activeOpacity={0.85}
        >
          {opening ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="open-outline" size={20} color="#FFFFFF" />
              <Text style={styles.previewButtonText}>Open Document</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { marginTop: 12, fontSize: 16 },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  retryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 12,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  headerRight: { width: 32 },
  content: { paddingHorizontal: 20 },
  card: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  docType: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusIcon: { marginRight: 6 },
  statusText: { fontSize: 14, fontWeight: "600" },

  // ✅ File name card
  fileNameCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  fileNameText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },

  validationCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  validationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  validationTitle: { fontSize: 15, fontWeight: "600" },
  validationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  validationLabel: { fontSize: 13 },
  validationScore: { fontSize: 18, fontWeight: "700" },
  validationMessage: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  sectionText: { fontSize: 14, lineHeight: 20 },
  ocrCard: { padding: 14, borderRadius: 12, borderWidth: 1 },
  ocrText: { fontSize: 13, lineHeight: 20 },
  previewButton: {
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    shadowColor: "#2563EB",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  previewButtonDisabled: { opacity: 0.6, shadowOpacity: 0, elevation: 0 },
  previewButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});