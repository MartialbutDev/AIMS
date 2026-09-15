// app/(student)/applications/new.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  FlatList,
} from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";
import api from "../../../src/services/api";

interface Company {
  id: string;
  name: string;
  description: string;
  industry: string;
  is_moa_signed: boolean;
}

interface Document {
  id: string;
  type: string;
  description: string;
  verification_status: string;
  file_path?: string;
  created_at: string;
}

const DOCUMENT_TYPES = [
  { value: "resume", label: "Resume/CV" },
  { value: "application_letter", label: "Application Letter" },
  { value: "endorsement_letter", label: "Endorsement Letter" },
  { value: "acceptance_letter", label: "Acceptance Letter" },
  { value: "certificate_of_completion", label: "Certificate of Completion" },
  { value: "requirements", label: "Requirements" },
];

// Normalize the many shape variations we might get from the backend
const normalizeDoc = (raw: any): Document => ({
  id: String(raw.id ?? ""),
  type: String(raw.type ?? "document").toLowerCase(),
  description: String(raw.description ?? ""),
  verification_status: String(raw.verification_status ?? "pending").toLowerCase(),
  file_path: raw.file_path,
  created_at: raw.created_at ?? new Date().toISOString(),
});

const toArray = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && Array.isArray(payload.items)) return payload.items as T[];
  return [];
};

export default function NewApplicationScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [position, setPosition] = useState("");
  const [coverLetter, setCoverLetter] = useState("");

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedResume, setSelectedResume] = useState<Document | null>(null);
  const [selectedAppLetter, setSelectedAppLetter] = useState<Document | null>(null);
  const [showResumeDropdown, setShowResumeDropdown] = useState(false);
  const [showAppLetterDropdown, setShowAppLetterDropdown] = useState(false);

  useEffect(() => {
    fetchCompanies();
    fetchDocuments();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await api.get("/companies/");
      setCompanies(toArray<Company>(response.data));
    } catch (error) {
      console.error("Error fetching companies:", error);
      Alert.alert("Error", "Failed to load companies");
    } finally {
      setLoadingCompanies(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true);
      const response = await api.get("/documents/");

      // 🔎 DEBUG: uncomment this temporarily to see the exact raw payload
      console.log(
        "📄 /documents/ raw response:",
        JSON.stringify(response.data, null, 2)
      );

      const normalized = toArray<any>(response.data).map(normalizeDoc);
      console.log(
        "📄 Normalized documents:",
        normalized.map((d) => ({ id: d.id, type: d.type, status: d.verification_status }))
      );

      setDocuments(normalized);
    } catch (error) {
      console.error("Error fetching documents:", error);
      Alert.alert(
        "Documents Error",
        "Could not load your documents. Pull down to refresh."
      );
    } finally {
      setLoadingDocs(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "#10B981";
      case "rejected":
        return "#EF4444";
      default:
        return "#F59E0B";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getVerifiedDocuments = (type?: string) => {
    const wanted = type?.toLowerCase();
    return documents.filter((d) => {
      const statusOk = d.verification_status === "verified";
      const typeOk = !wanted || d.type === wanted;
      return statusOk && typeOk;
    });
  };

  const renderDocumentDropdown = (
    label: string,
    selectedDoc: Document | null,
    setSelectedDoc: (doc: Document | null) => void,
    showDropdown: boolean,
    setShowDropdown: (show: boolean) => void,
    filterType?: string
  ) => {
    const verifiedDocs = getVerifiedDocuments(filterType);
    const docTypeLabel = filterType
      ? DOCUMENT_TYPES.find((t) => t.value === filterType)?.label || filterType
      : "Document";

    return (
      <View style={styles.docSection}>
        <Text style={[styles.docLabel, { color: colors.textPrimary }]}>
          {label} <Text style={styles.required}>*</Text>
        </Text>

        <TouchableOpacity
          style={[
            styles.docSelector,
            {
              backgroundColor: colors.card,
              borderColor: selectedDoc ? colors.success : colors.border,
              borderWidth: selectedDoc ? 2 : 1,
            },
          ]}
          onPress={() =>
            verifiedDocs.length > 0 && setShowDropdown(!showDropdown)
          }
          activeOpacity={0.7}
        >
          <View style={styles.docSelectorLeft}>
            <Ionicons
              name={selectedDoc ? "document-text-outline" : "cloud-upload-outline"}
              size={20}
              color={selectedDoc ? colors.success : colors.textSecondary}
            />
            <Text
              style={[
                styles.docSelectorText,
                { color: selectedDoc ? colors.textPrimary : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {selectedDoc
                ? `${selectedDoc.description || docTypeLabel} ✅ Verified`
                : `Select ${docTypeLabel}`}
            </Text>
          </View>
          {verifiedDocs.length > 0 && (
            <Ionicons
              name={showDropdown ? "chevron-up-outline" : "chevron-down-outline"}
              size={20}
              color={colors.textSecondary}
            />
          )}
        </TouchableOpacity>

        {verifiedDocs.length === 0 && !selectedDoc && (
          <View
            style={[
              styles.noDocWarning,
              { backgroundColor: `${colors.warning}10`, borderColor: `${colors.warning}30` },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text style={[styles.noDocWarningText, { color: colors.warning }]}>
              No verified {docTypeLabel} found. Please upload and wait for
              verification.
            </Text>
          </View>
        )}

        <Modal
          visible={showDropdown}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDropdown(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDropdown(false)}
          >
            <View
              style={[
                styles.dropdownContainer,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[styles.dropdownHeader, { borderBottomColor: colors.border }]}
              >
                <Text style={[styles.dropdownTitle, { color: colors.textPrimary }]}>
                  Select {docTypeLabel}
                </Text>
                <TouchableOpacity onPress={() => setShowDropdown(false)}>
                  <Ionicons name="close-outline" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={verifiedDocs}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      { borderBottomColor: colors.border },
                      selectedDoc?.id === item.id && {
                        backgroundColor: `${colors.primary}10`,
                      },
                    ]}
                    onPress={() => {
                      setSelectedDoc(item);
                      setShowDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dropdownItemLeft}>
                      <View
                        style={[
                          styles.docIcon,
                          { backgroundColor: `${colors.primary}10` },
                        ]}
                      >
                        <Ionicons
                          name="document-text-outline"
                          size={18}
                          color={colors.primary}
                        />
                      </View>
                      <View>
                        <Text
                          style={[styles.dropdownItemName, { color: colors.textPrimary }]}
                        >
                          {item.description ||
                            DOCUMENT_TYPES.find((t) => t.value === item.type)?.label ||
                            item.type}
                        </Text>
                        <Text
                          style={[styles.dropdownItemDate, { color: colors.textSecondary }]}
                        >
                          Verified on{" "}
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString()
                            : "Unknown date"}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.dropdownStatus,
                        { backgroundColor: `${getStatusColor(item.verification_status)}15` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownStatusText,
                          { color: getStatusColor(item.verification_status) },
                        ]}
                      >
                        ✅ Verified
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.dropdownEmpty}>
                    <Ionicons name="document-outline" size={40} color={colors.border} />
                    <Text
                      style={[styles.dropdownEmptyText, { color: colors.textSecondary }]}
                    >
                      No verified {docTypeLabel} found
                    </Text>
                    <Text
                      style={[styles.dropdownEmptySubtext, { color: colors.textTertiary }]}
                    >
                      Upload and wait for verification
                    </Text>
                    <TouchableOpacity
                      style={[styles.dropdownUploadBtn, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        setShowDropdown(false);
                        router.push("/(student)/documents/upload");
                      }}
                    >
                      <Text style={styles.dropdownUploadBtnText}>
                        Upload {docTypeLabel}
                      </Text>
                    </TouchableOpacity>
                  </View>
                }
                style={styles.dropdownList}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  const handleSubmit = async () => {
    if (!selectedCompany) return Alert.alert("Error", "Please select a company");
    if (!position.trim()) return Alert.alert("Error", "Please enter a position");
    if (!selectedResume)
      return Alert.alert("Error", "Please select a verified Resume/CV");
    if (!selectedAppLetter)
      return Alert.alert("Error", "Please select a verified Application Letter");

    setLoading(true);
    try {
      await api.post("/applications/", {
        company_id: selectedCompany,
        position: position.trim(),
        cover_letter: coverLetter.trim() || undefined,
        resume_id: selectedResume.id,
        application_letter_id: selectedAppLetter.id,
      });

      Alert.alert("Success", "Application submitted successfully!", [
        {
          text: "View Applications",
          onPress: () => router.push("/(student)/applications"),
        },
        { text: "OK", style: "default" },
      ]);

      setSelectedCompany("");
      setPosition("");
      setCoverLetter("");
      setSelectedResume(null);
      setSelectedAppLetter(null);
    } catch (error: any) {
      console.error("Submission error:", error);
      Alert.alert(
        "Error",
        error.response?.data?.detail ||
          "Failed to submit application. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedCompanyData = companies.find((c) => c.id === selectedCompany);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          New Application
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {loadingCompanies ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading companies...
            </Text>
          </View>
        ) : companies.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              No Companies Available
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              There are no companies accepting applications at the moment.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
                Select Company <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.companyGrid}>
                {companies.map((company) => (
                  <TouchableOpacity
                    key={company.id}
                    style={[
                      styles.companyCard,
                      {
                        backgroundColor: colors.card,
                        borderColor:
                          selectedCompany === company.id
                            ? colors.primary
                            : colors.border,
                      },
                      selectedCompany === company.id && styles.companyCardSelected,
                    ]}
                    onPress={() => setSelectedCompany(company.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.companyAvatar,
                        { backgroundColor: `${colors.primary}10` },
                      ]}
                    >
                      <Text style={[styles.companyInitial, { color: colors.primary }]}>
                        {company.name.charAt(0)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.companyName,
                        {
                          color:
                            selectedCompany === company.id
                              ? colors.primary
                              : colors.textPrimary,
                        },
                      ]}
                    >
                      {company.name}
                    </Text>
                    <Text
                      style={[styles.companyIndustry, { color: colors.textSecondary }]}
                    >
                      {company.industry}
                    </Text>
                    {selectedCompany === company.id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.primary}
                        style={styles.companyCheck}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {selectedCompanyData && (
              <View
                style={[
                  styles.selectedInfo,
                  {
                    backgroundColor: colors.card,
                    borderColor: `${colors.primary}20`,
                  },
                ]}
              >
                <Text
                  style={[styles.selectedInfoTitle, { color: colors.textSecondary }]}
                >
                  Selected Company
                </Text>
                <Text
                  style={[styles.selectedInfoName, { color: colors.textPrimary }]}
                >
                  {selectedCompanyData.name}
                </Text>
                <Text
                  style={[styles.selectedInfoDesc, { color: colors.textSecondary }]}
                >
                  {selectedCompanyData.description}
                </Text>
                <View style={styles.moaBadge}>
                  <Ionicons
                    name={
                      selectedCompanyData.is_moa_signed
                        ? "checkmark-circle"
                        : "time-outline"
                    }
                    size={14}
                    color={selectedCompanyData.is_moa_signed ? "#10B981" : "#F59E0B"}
                  />
                  <Text
                    style={[
                      styles.moaText,
                      selectedCompanyData.is_moa_signed
                        ? styles.moaActive
                        : styles.moaPending,
                    ]}
                  >
                    {selectedCompanyData.is_moa_signed ? "MOA Signed" : "MOA Pending"}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
                Position <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    color: colors.textPrimary,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="e.g., Software Engineering Intern"
                placeholderTextColor={colors.textSecondary}
                value={position}
                onChangeText={setPosition}
              />
            </View>

            <View style={styles.docSectionWrapper}>
              <Text style={[styles.docSectionTitle, { color: colors.textSecondary }]}>
                Required Documents
              </Text>
              <Text style={[styles.docSectionSubtitle, { color: colors.textTertiary }]}>
                Select from your verified documents
              </Text>

              {loadingDocs ? (
                <View style={styles.docLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    style={[styles.docLoadingText, { color: colors.textSecondary }]}
                  >
                    Loading your documents...
                  </Text>
                </View>
              ) : (
                <>
                  {renderDocumentDropdown(
                    "Resume/CV",
                    selectedResume,
                    setSelectedResume,
                    showResumeDropdown,
                    setShowResumeDropdown,
                    "resume"
                  )}
                  {renderDocumentDropdown(
                    "Application Letter",
                    selectedAppLetter,
                    setSelectedAppLetter,
                    showAppLetterDropdown,
                    setShowAppLetterDropdown,
                    "application_letter"
                  )}
                </>
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
                Cover Letter (Optional)
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.card,
                    color: colors.textPrimary,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Write a brief cover letter..."
                placeholderTextColor={colors.textSecondary}
                value={coverLetter}
                onChangeText={setCoverLetter}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                (!selectedCompany ||
                  !position.trim() ||
                  !selectedResume ||
                  !selectedAppLetter ||
                  loading) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={
                !selectedCompany ||
                !position.trim() ||
                !selectedResume ||
                !selectedAppLetter ||
                loading
              }
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="send-outline"
                    size={20}
                    color="#FFFFFF"
                    style={styles.submitIcon}
                  />
                  <Text style={styles.submitButtonText}>Submit Application</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* same styles as before — nothing changed */
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  headerRight: { width: 32 },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 16 },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  required: { color: "#EF4444" },
  companyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  companyCard: {
    width: "48%",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 12,
    position: "relative",
  },
  companyCardSelected: { borderWidth: 2 },
  companyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  companyInitial: { fontSize: 18, fontWeight: "700" },
  companyName: { fontSize: 13, fontWeight: "500", textAlign: "center" },
  companyIndustry: { fontSize: 11, marginTop: 2 },
  companyCheck: { position: "absolute", top: 8, right: 8 },
  selectedInfo: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  selectedInfoTitle: { fontSize: 12, fontWeight: "500", marginBottom: 4 },
  selectedInfoName: { fontSize: 16, fontWeight: "600" },
  selectedInfoDesc: { fontSize: 13, marginTop: 4 },
  moaBadge: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  moaText: { fontSize: 12, fontWeight: "500", marginLeft: 6 },
  moaActive: { color: "#10B981" },
  moaPending: { color: "#F59E0B" },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 120,
    borderWidth: 1,
    textAlignVertical: "top",
  },
  submitButton: {
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.6, shadowOpacity: 0, elevation: 0 },
  submitIcon: { marginRight: 8 },
  submitButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  docSectionWrapper: { marginBottom: 20 },
  docSectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  docSectionSubtitle: { fontSize: 12, marginBottom: 12 },
  docLoadingContainer: { paddingVertical: 20, alignItems: "center" },
  docLoadingText: { fontSize: 13, marginTop: 8 },
  docSection: { marginBottom: 14 },
  docLabel: { fontSize: 14, fontWeight: "500", marginBottom: 6 },
  docSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  docSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  docSelectorText: { fontSize: 14, flex: 1 },
  noDocWarning: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    gap: 8,
  },
  noDocWarningText: { fontSize: 12, flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  dropdownContainer: {
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: "70%",
    width: "100%",
    overflow: "hidden",
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  dropdownTitle: { fontSize: 16, fontWeight: "600" },
  dropdownList: { maxHeight: 350 },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  dropdownItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  docIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownItemName: { fontSize: 14, fontWeight: "500" },
  dropdownItemDate: { fontSize: 11 },
  dropdownStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dropdownStatusText: { fontSize: 10, fontWeight: "600" },
  dropdownEmpty: { alignItems: "center", paddingVertical: 30 },
  dropdownEmptyText: { fontSize: 14, marginTop: 8, marginBottom: 2 },
  dropdownEmptySubtext: { fontSize: 12, marginBottom: 12 },
  dropdownUploadBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dropdownUploadBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
});