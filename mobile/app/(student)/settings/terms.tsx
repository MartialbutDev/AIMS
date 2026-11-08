// app/(student)/settings/terms.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";

const TERMS_SECTIONS = [
  {
    "title": "1. Purpose and use",
    "body": "AIMS supports student onboarding, internship applications, documents, deployment, attendance, journals and completion. Students use the mobile app or student web portal with the same account. Coordinators, company supervisors, the Career Center, Dean and administrators act through their authorized roles. Using AIMS does not by itself guarantee a placement, completion, a grade or graduation."
  },
  {
    "title": "2. Your account and security",
    "body": "Use your own registered identity and provide accurate student, academic and contact details. Keep your password and one-time codes private. Do not share accounts, impersonate another user or create accounts to bypass restrictions. Review your active sessions and end unfamiliar sessions. Report suspected unauthorized access to the school administrator through official channels."
  },
  {
    "title": "3. Eligibility, applications and deployment",
    "body": "Approved orientation and current-term Certificate of Registration (COR) records are required before an application can advance. Submit the required application documents and school-issued endorsement letter; the endorsement must be approved before forwarding to the company. Company acceptance does not authorize deployment. Complete the applicable pre-deployment requirements and wait for coordinator approval before using deployed-intern attendance features. Follow the academic term, requirements and deadlines applicable to your placement."
  },
  {
    "title": "4. Documents and assisted review",
    "body": "Upload readable, relevant documents you are authorized to submit, using the correct document type and approved form version where provided. Do not submit fabricated records or claim a signature belongs to another person. Text extraction and OCR assist document checks; they do not authenticate signatures, establish document authenticity or replace the responsible reviewer. A submission may be returned, rejected or require human review. Keep originals available when the school or company requests them."
  },
  {
    "title": "5. Replacements, deletion and history",
    "body": "An approved document can remain current while a replacement is reviewed. An approved replacement becomes current while review history is retained. Previously submitted application attachments remain associated with that application. Delete or hide controls are available only where permitted; hiding an item does not erase its server record, reviews, application attachments or academic history. Contact your coordinator about corrections or removal requests affecting retained records."
  },
  {
    "title": "6. Attendance, photographs and location",
    "body": "Record your own actual attendance and submit the requested clock-in or clock-out photo. When you capture location, the app requests device permission and sends the captured coordinates with your attendance submission. Location accuracy depends on the device, permissions, GPS and available network signals; a captured coordinate or photo alone is not proof of presence. Check the location before submitting, and report an inaccurate reading to your coordinator. Do not falsify times, reuse another person's evidence or manipulate location. If capture fails or permission is unavailable, contact your coordinator for guidance."
  },
  {
    "title": "7. Reviews, corrections and completion",
    "body": "Only approved attendance contributes to completion hours. Use the time-correction process for incorrect recorded times; company review and coordinator approval are required. Submit journals and address review feedback. Internship completion requires the applicable eligibility checklist, student request, company confirmation and coordinator final approval. Final grade release is a separate authorized action. Archived completion records may be protected from ordinary edits."
  },
  {
    "title": "8. Privacy and authorized access",
    "body": "AIMS processes account and academic information, uploaded documents, attendance photos and location, reviews and related activity to administer internships. Access depends on each role and its assigned responsibilities; company access is limited to the relevant placement or application scope. Submit only information needed for the academic process and avoid unnecessary personal or confidential company data. Read the Privacy Policy for further information. Nothing in these terms removes rights provided by applicable Philippine law, including the Data Privacy Act of 2012."
  },
  {
    "title": "9. Record retention and privacy requests",
    "body": "Academic records, attachments, review history and security records may need to be retained for legitimate academic, administrative or legal purposes. Clearing the app cache, hiding a document, signing out or uninstalling the app does not delete those server records. Request access, correction or deletion through the university's official channels; requests remain subject to applicable privacy rights and lawful retention requirements. These terms do not establish an automatic deletion period."
  },
  {
    "title": "10. Notifications, availability and retries",
    "body": "Notification preferences and phone permissions affect delivery. Network conditions or service interruptions can delay email, push and in-app updates. Check your AIMS records and official school instructions for deadlines and decisions. After a connection failure, refresh the relevant records before retrying because the server may already have received the submission. Report missing or inconsistent records rather than repeatedly submitting the same action."
  },
  {
    "title": "11. Responsible access and shared materials",
    "body": "Use only the records and actions your role permits. Do not attempt to access another student's documents, bypass approval checks, disrupt the service or share confidential records without authorization. Respect the rights of students, the university, partner companies and creators of uploaded material. Account access may be restricted to address security incidents or misuse; contact the administrator to review an access issue. This does not itself determine an academic disciplinary outcome."
  },
  {
    "title": "12. Updates and assistance",
    "body": "The date above identifies the revision displayed in this app. Review updated terms when a new revision is made available. For questions about requirements, attendance, reviews or completion, contact your assigned coordinator. For sign-in or account-security issues, contact the school administrator. Use the university's official privacy contact for personal-data concerns. Do not send passwords or one-time codes in a support report."
  }
];

export default function TermsScreen({ publicAccess = false, onBack = () => router.back() }: { publicAccess?: boolean; onBack?: () => void } = {}) {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.backButton}>
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
            Last updated: November 8, 2026
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            These terms explain responsible use of AIMS for the College of Information Technology and Computing (CITC), USTP Cagayan de Oro. University academic policies, applicable partner agreements and Philippine law continue to apply.
          </Text>

          {TERMS_SECTIONS.map(section => (
            <View key={section.title}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {section.title}
              </Text>
              <Text selectable style={[styles.bodyText, { color: colors.textSecondary }]}>
                {section.body}
              </Text>
            </View>
          ))}

          <TouchableOpacity accessibilityRole="link" accessibilityLabel="Read the privacy policy" onPress={() => router.push(publicAccess ? '/(auth)/privacy-policy' : '/(student)/settings/privacy-policy')} style={styles.resourceLink}>
            <Text style={[styles.resourceLinkText, { color: colors.accent }]}>Read the Privacy Policy</Text>
          </TouchableOpacity>
          {!publicAccess && <TouchableOpacity accessibilityRole="link" accessibilityLabel="Open help and support" onPress={() => router.push('/(student)/settings/help-support')} style={styles.resourceLink}>
            <Text style={[styles.resourceLinkText, { color: colors.accent }]}>Help & support</Text>
          </TouchableOpacity>}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            AIMS · CITC · USTP Cagayan de Oro
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
  resourceLink: {
    minHeight: 44,
    justifyContent: "center",
    marginTop: 8,
  },
  resourceLinkText: {
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  footerSpacer: {
    height: 20,
  },
});
