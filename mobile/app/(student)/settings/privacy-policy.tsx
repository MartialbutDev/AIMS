// app/(student)/settings/privacy-policy.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";

export default function PrivacyPolicyScreen() {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Privacy Policy
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Privacy Policy
          </Text>
          <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
            Last Updated: August 28, 2026
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Introduction
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            The Academic Internship Management System (AIMS) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Information We Collect
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            <Text style={[styles.subSectionTitle, { color: colors.textPrimary }]}>Personal Information:</Text>
            {'\n'}• Full name
            {'\n'}• Student ID
            {'\n'}• Email address
            {'\n'}• Phone number
            {'\n'}• Profile photo (optional)
            {'\n'}• Academic program and year level
            {'\n'}
            <Text style={[styles.subSectionTitle, { color: colors.textPrimary }]}>Usage Data:</Text>
            {'\n'}• Time-in and time-out records
            {'\n'}• Journal entries
            {'\n'}• Document uploads
            {'\n'}• Application history
            {'\n'}• Device information
            {'\n'}• Location data (for DTR verification)
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            How We Use Your Information
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            • To create and manage your account
            {'\n'}• To process internship applications
            {'\n'}• To track and monitor internship progress
            {'\n'}• To verify DTR entries
            {'\n'}• To communicate with you about your internship
            {'\n'}• To improve our services
            {'\n'}• To comply with legal obligations
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Data Storage and Security
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            Your data is stored securely on cloud servers with industry-standard encryption. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Data Sharing
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            We do not sell, trade, or rent your personal information to third parties. Your data may be shared with:
            {'\n'}• Internship coordinators and faculty members for academic purposes
            {'\n'}• Partner companies for internship placement and evaluation
            {'\n'}• Service providers who assist in operating our application
            {'\n'}• Legal authorities when required by law
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Your Rights
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            You have the right to:
            {'\n'}• Access your personal data
            {'\n'}• Correct inaccurate data
            {'\n'}• Request deletion of your data
            {'\n'}• Withdraw consent at any time
            {'\n'}• Data portability
            {'\n'}• Lodge a complaint with a supervisory authority
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Data Retention
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            We retain your personal data for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. After your internship program is completed, we may retain your data for academic and administrative purposes.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Cookies and Tracking
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            We use cookies and similar tracking technologies to enhance your experience, analyze usage, and improve our services. You can control cookie preferences through your device settings.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Children's Privacy
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            Our application is intended for use by college students and faculty members. We do not knowingly collect personal information from individuals under the age of 18. If you become aware that a child has provided us with personal information, please contact us immediately.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Changes to This Policy
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. We encourage you to review this Privacy Policy periodically.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Contact Us
          </Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us:
            {'\n'}Email: privacy@aims.ustp.edu.ph
            {'\n'}Phone: (088) 123-4567
            {'\n'}Address: USTP-CDO, Lapasan, Cagayan de Oro City, 9000
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
  subSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
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