// app/(student)/documents/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import * as SecureStore from 'expo-secure-store';

import { useTheme } from "../../../src/context/ThemeContext";
import { useAutoHideTab } from "../../../src/hooks/useAutoHideTab";
import api from "../../../src/services/api";
import DocumentPreview from "../../../src/components/documents/DocumentPreview";
import { BASE_URL } from "../../../src/config/env";

interface Document {
  id: string;
  type: string;
  description: string;
  verification_status: string;
  created_at: string;
  file_path?: string;
}

export default function DocumentsScreen() {
  const { colors, isDark } = useTheme();
  const { handleScroll } = useAutoHideTab();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>("");
  const [previewType, setPreviewType] = useState<string>("");
  const [previewName, setPreviewName] = useState<string>("");

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

  const handlePreview = async (document: Document) => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const imageUrl = `${BASE_URL}/api/v1/documents/${document.id}/image?token=${encodeURIComponent(token || '')}`;
      
      setPreviewImage(imageUrl);
      setPreviewType(document.type);
      setPreviewName(document.description || document.type.replace(/_/g, ' ').toUpperCase());
      setPreviewVisible(true);
    } catch (error) {
      console.error('Error preparing preview:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading documents...</Text>
      </SafeAreaView>
    );
  }

  const renderDocument = ({ item }: { item: Document }) => {
    const statusColor = getStatusColor(item.verification_status);
    const displayName = item.type.replace(/_/g, ' ').toUpperCase();
    
    return (
      <TouchableOpacity
        style={[styles.documentCard, { backgroundColor: colors.card }]}
        onPress={() => router.push(`/(student)/documents/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={[styles.documentIcon, { backgroundColor: `${colors.primary}10` }]}>
          <Ionicons name="document-text-outline" size={28} color={colors.primary} />
        </View>
        
        <View style={styles.documentInfo}>
          <Text style={[styles.documentType, { color: colors.textPrimary }]}>
            {displayName}
          </Text>
          {item.description ? (
            <Text style={[styles.documentDescription, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          <Text style={[styles.documentDate, { color: colors.textSecondary }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.documentActions}>
          <TouchableOpacity
            style={[styles.previewButton, { borderColor: colors.border }]}
            onPress={() => handlePreview(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="eye-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
            <Ionicons
              name={getStatusIcon(item.verification_status)}
              size={12}
              color={statusColor}
              style={styles.statusIcon}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.verification_status.charAt(0).toUpperCase() + item.verification_status.slice(1)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>My Documents</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => router.push("/(student)/documents/upload")}
        >
          <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={documents}
        renderItem={renderDocument}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Documents</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Upload your internship documents to get started
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(student)/documents/upload")}
            >
              <Text style={styles.emptyButtonText}>Upload Now</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <DocumentPreview
        visible={previewVisible}
        imageUri={previewImage}
        documentType={previewType}
        documentName={previewName}
        onClose={() => setPreviewVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  uploadButton: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
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
  documentInfo: {
    flex: 1,
  },
  documentType: {
    fontSize: 15,
    fontWeight: "600",
  },
  documentDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  documentDate: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.7,
  },
  documentActions: {
    alignItems: "flex-end",
    gap: 6,
  },
  previewButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
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
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  emptyButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});