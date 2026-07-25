// app/(student)/applications/new.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import Colors from "../../../src/theme/colors";

interface Company {
  id: string;
  name: string;
  positions: string[];
}

const mockCompanies: Company[] = [
  { id: "1", name: "TechCorp Inc.", positions: ["Software Engineering Intern", "DevOps Intern", "QA Intern"] },
  { id: "2", name: "Digital Solutions Co.", positions: ["Frontend Developer Intern", "Backend Developer Intern"] },
  { id: "3", name: "Cloud Systems Ltd.", positions: ["Cloud Engineer Intern", "DevOps Intern"] },
  { id: "4", name: "Data Analytics Corp.", positions: ["Data Science Intern", "Data Analyst Intern"] },
];

export default function NewApplicationScreen() {
  const [loading, setLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedPosition, setSelectedPosition] = useState<string>("");
  const [coverLetter, setCoverLetter] = useState("");
  const [showPositions, setShowPositions] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCompany || !selectedPosition) {
      return;
    }

    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      router.back();
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCompanyData = mockCompanies.find(c => c.id === selectedCompany);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Application</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Company</Text>
          <View style={styles.companyGrid}>
            {mockCompanies.map((company) => (
              <TouchableOpacity
                key={company.id}
                style={[
                  styles.companyCard,
                  selectedCompany === company.id && styles.companyCardSelected,
                ]}
                onPress={() => {
                  setSelectedCompany(company.id);
                  setSelectedPosition("");
                  setShowPositions(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.companyAvatar}>
                  <Text style={styles.companyInitial}>{company.name.charAt(0)}</Text>
                </View>
                <Text style={[
                  styles.companyCardName,
                  selectedCompany === company.id && styles.companyCardNameSelected,
                ]}>
                  {company.name}
                </Text>
                {selectedCompany === company.id && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} style={styles.companyCheck} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {selectedCompanyData && showPositions && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Position</Text>
            {selectedCompanyData.positions.map((position) => (
              <TouchableOpacity
                key={position}
                style={[
                  styles.positionItem,
                  selectedPosition === position && styles.positionItemSelected,
                ]}
                onPress={() => setSelectedPosition(position)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.positionText,
                  selectedPosition === position && styles.positionTextSelected,
                ]}>
                  {position}
                </Text>
                {selectedPosition === position && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cover Letter</Text>
          <TextInput
            style={styles.coverLetterInput}
            placeholder="Write your cover letter here..."
            placeholderTextColor={Colors.textSecondary}
            value={coverLetter}
            onChangeText={setCoverLetter}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedCompany || !selectedPosition) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedCompany || !selectedPosition || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Application</Text>
          )}
        </TouchableOpacity>
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

  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  section: {
    marginBottom: 24,
  },

  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 12,
  },

  companyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  companyCard: {
    width: "48%",
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
  },

  companyCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}05`,
  },

  companyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}10`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  companyInitial: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },

  companyCardName: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textPrimary,
    textAlign: "center",
  },

  companyCardNameSelected: {
    color: Colors.primary,
  },

  companyCheck: {
    position: "absolute",
    top: 8,
    right: 8,
  },

  positionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },

  positionItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}05`,
  },

  positionText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },

  positionTextSelected: {
    color: Colors.primary,
    fontWeight: "600",
  },

  coverLetterInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 160,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  submitButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  submitButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },

  submitButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});