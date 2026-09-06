// app/(student)/settings/terms.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";

export default function TermsScreen() {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Terms & Conditions
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Terms & Conditions
          </Text>
          <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
            Last Updated: August 28, 2026
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            1. Acceptance of Terms
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            By downloading, installing, or using the Academic Internship Management System (AIMS) mobile application, you agree to be bound by these Terms & Conditions. If you do not agree to these terms, please do not use the application.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            2. Description of Service
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            AIMS is a mobile-based academic internship management system designed to streamline the internship process for students, coordinators, and partner companies of the College of Information Technology and Computing (CITC) at the University of Science and Technology of Southern Philippines - Cagayan de Oro (USTP-CDO).
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            3. User Accounts
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            3.1. You must create an account to use certain features of the application.
            {'\n'}3.2. You are responsible for maintaining the confidentiality of your account credentials.
            {'\n'}3.3. You are responsible for all activities that occur under your account.
            {'\n'}3.4. You must provide accurate and complete information when creating your account.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            4. User Obligations
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            4.1. Use the application only for academic and internship-related purposes.
            {'\n'}4.2. Provide accurate and truthful information.
            {'\n'}4.3. Respect the privacy and rights of other users.
            {'\n'}4.4. Comply with all applicable laws and regulations.
            {'\n'}4.5. Not engage in any activity that disrupts or interferes with the application.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            5. Intellectual Property
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            All content, features, and functionality of the application, including but not limited to text, graphics, logos, icons, and software, are the property of USTP-CDO and are protected by copyright, trademark, and other intellectual property laws.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            6. Privacy
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            Your use of the application is also governed by our Privacy Policy. Please review our Privacy Policy to understand our practices regarding your personal information.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            7. Disclaimer of Warranties
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            The application is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the application will be uninterrupted, error-free, or free from viruses or other harmful components.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            8. Limitation of Liability
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            To the fullest extent permitted by law, USTP-CDO shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from your use of the application.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            9. Termination
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            We may terminate or suspend your account and bar access to the application immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever, including without limitation a breach of the Terms.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            10. Changes to Terms
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            We reserve the right to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            11. Contact Us
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            If you have any questions about these Terms, please contact us at:
            {'\n'}Email: support@aims.ustp.edu.ph
            {'\n'}Phone: (088) 123-4567
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            © {new Date().getFullYear()} University of Science and Technology of Southern Philippines - Cagayan de Oro. All rights reserved.
          </Text>
        </View>

        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
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
  card: {
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 13,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  footerText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    opacity: 0.7,
  },
  footerSpacer: {
    height: 20,
  },
});