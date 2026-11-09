// app/(student)/settings/guide-detail.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";

interface GuideContent {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  sections: {
    title: string;
    content: string;
    icon?: keyof typeof Ionicons.glyphMap;
  }[];
}

const guideContents: Record<string, GuideContent> = {
  "1": {
    "id": "1",
    "title": "Getting started",
    "icon": "rocket-outline",
    "sections": [
      {
        "title": "One student account",
        "icon": "person-add-outline",
        "content": "1. Register with your own name, student number and contact details.\n2. Use that same account on mobile and the student web portal.\n3. Keep passwords and one-time codes private.\n4. Review your profile and active sign-in sessions in account settings."
      },
      {
        "title": "Orientation and COR first",
        "icon": "school-outline",
        "content": "Upload your orientation certificate and current-term Certificate of Registration (COR) in onboarding. Both need approval before your application can advance. Pending or rejected documents do not establish eligibility. Read the review notes and follow the next step shown by AIMS."
      },
      {
        "title": "Your academic term and next step",
        "icon": "grid-outline",
        "content": "The dashboard and DTR summary use the configured academic term and required hours. Follow your assigned coordinator and the current checklist. Completion & archive is in Profile, with a shortcut in the dashboard Internship Progress card."
      }
    ]
  },
  "2": {
    "id": "2",
    "title": "Applying and deployment",
    "icon": "briefcase-outline",
    "sections": [
      {
        "title": "Prepare and apply",
        "icon": "document-text-outline",
        "content": "1. Complete approved orientation and COR onboarding.\n2. Upload your resume/CV and application letter in Documents.\n3. Use current approved versions in your application.\n4. Select an available partner company, enter the requested details and submit.\n5. Track status and feedback in Applications."
      },
      {
        "title": "Endorsement before company review",
        "icon": "send-outline",
        "content": "Your school provides the endorsement letter. Follow the steps inside your application to upload it under Endorsement Letter, linked to that application. Wait for review and approval. Your coordinator can forward the application to the company only after the required endorsement is approved. OCR reads text; it does not authenticate a signature."
      },
      {
        "title": "Acceptance and deployment are separate",
        "icon": "checkmark-circle-outline",
        "content": "The company reviews the forwarded application and decides whether to accept you. The company provides an acceptance letter when required by your checklist. Complete Pre-deployment requirements and wait for coordinator deployment approval. Acceptance alone does not unlock DTR or journal submissions."
      },
      {
        "title": "School-arranged placements",
        "icon": "people-outline",
        "content": "If you receive a direct-placement proposal, review its company and instructions, then acknowledge or decline through the proposal. It still requires the applicable eligibility, company/MOA and deployment checks. An active deployment prevents another internship application from proceeding."
      }
    ]
  },
  "3": {
    "id": "3",
    "title": "Attendance and corrections",
    "icon": "calendar-outline",
    "sections": [
      {
        "title": "Clock in and clock out",
        "icon": "time-outline",
        "content": "1. Confirm that your deployment is active.\n2. Open DTR, take your own clock-in photo and capture your location.\n3. Check the position and reported accuracy before saving. The server records clock times; capture sessions expire after five minutes.\n4. Open the pending entry when your shift ends.\n5. Take a clock-out photo, capture a fresh location and submit once.\n6. The company supervisor confirms or disputes attendance first. Your coordinator then gives final approval. Only company-confirmed and coordinator-approved hours count."
      },
      {
        "title": "Lunch and other breaks",
        "icon": "pause-circle-outline",
        "content": "Open today's pending DTR record and tap Start break when you stop working. Tap End break when you return. Breaks are saved by the server and remain recorded when you close the app. Stay connected and check that the save succeeds. End any active break before clocking out. Working hours equal clock-out minus clock-in minus recorded breaks. Company and coordinator review are still required. A time correction preserves recorded break deductions."
      },
      {
        "title": "Check location accuracy",
        "icon": "location-outline",
        "content": "Location is an estimate, not proof of presence. A phone may use GPS and nearby networks; an Ethernet-only PC may give a rough network estimate. Enable precise location and recapture if the position is wrong. AIMS warns when reported accuracy is over 100 metres or unavailable. This is an app caution, not a school geofence or proof that a closer reading is correct. Contact your coordinator when a reliable capture is unavailable."
      },
      {
        "title": "Request a time correction",
        "icon": "create-outline",
        "content": "Open the DTR record and its time-correction form. Enter the proposed clock-in/clock-out times and a clear reason. Your linked company supervisor reviews the request first, then your coordinator makes the school decision. A request alone does not change the recorded times or approved hours. Follow returned feedback. Completed archives may need to be reopened by the coordinator before changes."
      },
      {
        "title": "Statuses and connection failures",
        "icon": "cloud-offline-outline",
        "content": "Pending: clock-in saved, clock-out still needed.\nSubmitted: awaiting company confirmation, then coordinator review.\nApproved: counts toward completion only when company confirmation is also recorded.\nRejected: read the review feedback.\nIf the connection drops, refresh the DTR list before retrying; your submission may already have reached the server. Do not repeatedly clock out or create another entry to correct an existing one."
      }
    ]
  },
  "4": {
    "id": "4",
    "title": "Weekly journals",
    "icon": "book-outline",
    "sections": [
      {
        "title": "Prepare a relevant journal",
        "icon": "create-outline",
        "content": "Use the journal format published or required by your coordinator. Describe tasks, skills, challenges and lessons learned. Prepare a readable PDF and omit confidential client or company information that you are not authorized to share."
      },
      {
        "title": "Submit and review feedback",
        "icon": "send-outline",
        "content": "During an active deployment, open Journals, enter the week number and title, add the requested summary and select the PDF. Submit for coordinator review. A submitted or reviewing journal is not yet approved. Read returned/rejected feedback and follow the available correction or resubmission steps."
      },
      {
        "title": "Journals and completion",
        "icon": "ribbon-outline",
        "content": "Approved journals satisfy the relevant part of your completion checklist. Journals alone do not complete your internship, release your grade or replace company confirmation and coordinator final approval."
      }
    ]
  },
  "5": {
    "id": "5",
    "title": "Documents and replacements",
    "icon": "documents-outline",
    "sections": [
      {
        "title": "Choose the correct file and type",
        "icon": "document-text-outline",
        "content": "Use Official forms for coordinator-published versions, instructions and deadlines. Upload readable, relevant files with your correct student details and academic term. Choosing a file may send it for text extraction and a type suggestion; saving it as a requirement is a separate Upload action. A suggested type is not approval."
      },
      {
        "title": "Understand the review result",
        "icon": "search-outline",
        "content": "Pending review: uploaded but not approved. Wait for the responsible reviewer or follow the requested correction.\nVerified / approved: accepted for that requirement by the current checks or review; other application/deployment approvals may still be needed.\nRejected: not accepted; read the reason and submit the correct document.\nOCR assists text and content checks. Neither text extraction nor the Verified label authenticates signatures or guarantees the document issuer is genuine."
      },
      {
        "title": "Replace without losing an approved document",
        "icon": "copy-outline",
        "content": "A new replacement does not automatically replace your current approved document. The approved version remains active while a pending replacement is checked. A rejected replacement does not invalidate the approved version. Once approved, the replacement becomes current and the previous version remains in history. Submitted application attachments keep their original versions."
      },
      {
        "title": "View, hide or delete",
        "icon": "ellipsis-horizontal-outline",
        "content": "Use the document three-dot menu for available actions. Deletion can be restricted for documents linked to applications or retained academic records. Hide removes an item from the usual view without erasing its server record or review history. Contact your coordinator about an incorrect approved document or a revocation."
      }
    ]
  },
  "6": {
    "id": "6",
    "title": "Completion and archive",
    "icon": "ribbon-outline",
    "sections": [
      {
        "title": "Check eligibility",
        "icon": "list-outline",
        "content": "Open Profile → Completion & archive, or use the dashboard Internship Progress shortcut. Review the checklist for your deployment and academic term: approved attendance hours, journals, required documents and any outstanding reviews. Resolve missing items and returned feedback first."
      },
      {
        "title": "Request and confirm completion",
        "icon": "business-outline",
        "content": "Submit your completion request when eligible. Your company supervisor reviews and confirms the internship, including the required completion evidence. If returned, read the reason, address it and use the available resubmission action. Enough hours alone do not approve completion."
      },
      {
        "title": "Final approval, grade and archive",
        "icon": "school-outline",
        "content": "After company confirmation, your coordinator makes the final completion decision. Final grade release is a separate action; see the grade only when released. The completed internship is retained in the archive. Ordinary edits may be locked to protect that history; ask your coordinator about corrections rather than starting another record."
      }
    ]
  }
};

export default function GuideDetailScreen() {
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const guide = id ? guideContents[id] : null;

  if (!guide) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Guide Not Found</Text>
          <View style={styles.headerRight} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {guide.title}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Guide Header */}
        <View style={[styles.guideHeader, { backgroundColor: colors.card }]}>
          <View style={[styles.guideIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name={guide.icon} size={40} color={colors.accent} />
          </View>
          <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>{guide.title}</Text>
          <Text style={[styles.guideSubtitle, { color: colors.textSecondary }]}>
            Step-by-step guide to help you navigate the app
          </Text>
        </View>

        {/* Sections */}
        {guide.sections.map((section, index) => (
          <View
            key={index}
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              {section.icon && (
                <Ionicons name={section.icon} size={22} color={colors.accent} />
              )}
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {section.title}
              </Text>
            </View>
            <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
            <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
              {section.content}
            </Text>
          </View>
        ))}

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
    flex: 1,
  },
  headerRight: {
    width: 32,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  guideHeader: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  guideIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  guideTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  guideSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    opacity: 0.7,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  sectionDivider: {
    height: 1,
    marginVertical: 10,
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 24,
  },
  footerSpacer: {
    height: 20,
  },
});
