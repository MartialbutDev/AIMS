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

export default function NewApplicationScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [position, setPosition] = useState("");
  const [coverLetter, setCoverLetter] = useState("");

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies/');
      setCompanies(response.data);
    } catch (error) {
      console.error('Error fetching companies:', error);
      Alert.alert('Error', 'Failed to load companies');
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCompany) {
      Alert.alert("Error", "Please select a company");
      return;
    }
    if (!position.trim()) {
      Alert.alert("Error", "Please enter a position");
      return;
    }

    setLoading(true);
    try {
      await api.post('/applications/', {
        company_id: selectedCompany,
        position: position.trim(),
        cover_letter: coverLetter.trim() || undefined,
      });

      Alert.alert(
        "Success",
        "Application submitted successfully!",
        [
          { 
            text: "View Applications", 
            onPress: () => router.push("/(student)/applications") 
          },
          { text: "OK", style: "default" }
        ]
      );
      
      setSelectedCompany("");
      setPosition("");
      setCoverLetter("");
      
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage = error.response?.data?.detail || "Failed to submit application. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const selectedCompanyData = companies.find(c => c.id === selectedCompany);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>New Application</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {loadingCompanies ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading companies...</Text>
          </View>
        ) : companies.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Companies Available</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              There are no companies accepting applications at the moment.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Select Company <Text style={styles.required}>*</Text></Text>
              <View style={styles.companyGrid}>
                {companies.map((company) => (
                  <TouchableOpacity
                    key={company.id}
                    style={[
                      styles.companyCard,
                      { 
                        backgroundColor: colors.card,
                        borderColor: selectedCompany === company.id ? colors.primary : colors.border,
                      },
                      selectedCompany === company.id && styles.companyCardSelected,
                    ]}
                    onPress={() => setSelectedCompany(company.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.companyAvatar, { backgroundColor: `${colors.primary}10` }]}>
                      <Text style={[styles.companyInitial, { color: colors.primary }]}>{company.name.charAt(0)}</Text>
                    </View>
                    <Text style={[
                      styles.companyName,
                      { color: selectedCompany === company.id ? colors.primary : colors.textPrimary },
                    ]}>
                      {company.name}
                    </Text>
                    <Text style={[styles.companyIndustry, { color: colors.textSecondary }]}>{company.industry}</Text>
                    {selectedCompany === company.id && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={styles.companyCheck} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {selectedCompanyData && (
              <View style={[styles.selectedInfo, { backgroundColor: colors.card, borderColor: `${colors.primary}20` }]}>
                <Text style={[styles.selectedInfoTitle, { color: colors.textSecondary }]}>Selected Company</Text>
                <Text style={[styles.selectedInfoName, { color: colors.textPrimary }]}>{selectedCompanyData.name}</Text>
                <Text style={[styles.selectedInfoDesc, { color: colors.textSecondary }]}>{selectedCompanyData.description}</Text>
                <View style={styles.moaBadge}>
                  <Ionicons 
                    name={selectedCompanyData.is_moa_signed ? "checkmark-circle" : "time-outline"} 
                    size={14} 
                    color={selectedCompanyData.is_moa_signed ? "#10B981" : "#F59E0B"} 
                  />
                  <Text style={[
                    styles.moaText,
                    selectedCompanyData.is_moa_signed ? styles.moaActive : styles.moaPending
                  ]}>
                    {selectedCompanyData.is_moa_signed ? "MOA Signed" : "MOA Pending"}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Position <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="e.g., Software Engineering Intern"
                placeholderTextColor={colors.textSecondary}
                value={position}
                onChangeText={setPosition}
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Cover Letter (Optional)</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
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
                (!selectedCompany || !position.trim() || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedCompany || !position.trim() || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={20} color="#FFFFFF" style={styles.submitIcon} />
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
  container: {
    flex: 1,
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
  },
  headerRight: {
    width: 32,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  required: {
    color: "#EF4444",
  },
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
  companyCardSelected: {
    borderWidth: 2,
  },
  companyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  companyInitial: {
    fontSize: 18,
    fontWeight: "700",
  },
  companyName: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  companyIndustry: {
    fontSize: 11,
    marginTop: 2,
  },
  companyCheck: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  selectedInfo: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  selectedInfoTitle: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  selectedInfoName: {
    fontSize: 16,
    fontWeight: "600",
  },
  selectedInfoDesc: {
    fontSize: 13,
    marginTop: 4,
  },
  moaBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  moaText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 6,
  },
  moaActive: {
    color: "#10B981",
  },
  moaPending: {
    color: "#F59E0B",
  },
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
  submitButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitIcon: {
    marginRight: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});