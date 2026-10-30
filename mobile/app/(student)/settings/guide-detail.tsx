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
    id: "1",
    title: "Getting Started",
    icon: "rocket-outline",
    sections: [
      {
        title: "Create Your Account",
        icon: "person-add-outline",
        content: "1. Install the AIMS APK provided through your school’s approved distribution channel.\n2. Create your student account with accurate name, student ID and contact details.\n3. Submit the account-verification documents requested by AIMS.\n4. Wait for the school reviewer to verify your account.\n5. Sign in and follow the next step shown on your dashboard.",
      },
      {
        title: "Complete Your Profile",
        icon: "person-outline",
        content: "Open Profile to review your details and photo. Use the edit controls for the fields available to you. Ask your coordinator to correct your student ID or other school-controlled information.",
      },
      {
        title: "Understand the Dashboard",
        icon: "grid-outline",
        content: "Your dashboard shows the configured academic term, school-approved hours and deployment progress. Use Pre-deployment before starting the internship, and Completion & archive when you are ready for the final review. Read updates in Notifications.",
      },
    ],
  },
  "2": {
    id: "2",
    title: "How to Apply",
    icon: "briefcase-outline",
    sections: [
      {
        title: "Prepare your application",
        icon: "search-outline",
        content: "1. Upload your resume/CV and application letter in Documents.\n2. Wait for verification of both files.\n3. Open Applications and choose an available partner company.\n4. Check the company details and follow your coordinator’s placement instructions.",
      },
      {
        title: "Submit Application",
        icon: "send-outline",
        content: "1. Create a new application.\n2. Select the company and position.\n3. Select your verified resume/CV and application letter.\n4. Add the requested application details and submit.\n5. Your coordinator reviews the application before company review.\n6. For a school-arranged placement, open the proposal, review it and acknowledge or decline it with a reason.",
      },
      {
        title: "Track Application Status",
        icon: "time-outline",
        content: "Check the status and feedback in Applications. Company acceptance does not authorize attendance recording by itself. Complete the Pre-deployment checklist and wait for your coordinator to confirm deployment before recording DTR or submitting journals.",
      },
    ],
  },
  "3": {
    id: "3",
    title: "DTR Guide",
    icon: "calendar-outline",
    sections: [
      {
        title: "Recording Time-In",
        icon: "log-in-outline",
        content: "1. Confirm that your deployment is active.\n2. Open DTR and create your time-in entry.\n3. Use a date on or after your official deployment date.\n4. Take a time-in photo and allow the requested location access.\n5. Review your entry before saving.",
      },
      {
        title: "Recording Time-Out",
        icon: "log-out-outline",
        content: "1. Open the pending DTR entry.\n2. Record a time-out later than the time-in.\n3. Provide the required time-out photo and location details.\n4. Submit the time-out. The complete entry goes to coordinator review.\n5. Only valid, school-approved hours contribute to completion progress.",
      },
      {
        title: "DTR Status",
        icon: "checkmark-circle-outline",
        content: "Pending: time-in recorded, time-out still required.\nSubmitted: awaiting coordinator review.\nApproved: reviewed by the coordinator.\nRejected: read the feedback and ask your coordinator for correction instructions.\nArchived records require the coordinator to reopen completion before corrections.",
      },
    ],
  },
  "4": {
    id: "4",
    title: "Journal Writing",
    icon: "book-outline",
    sections: [
      {
        title: "What to Write",
        icon: "create-outline",
        content: "Follow the journal format published or required by your coordinator. Describe the tasks completed, skills practised, challenges and what you learned. Prepare your report as a readable PDF before uploading it.",
      },
      {
        title: "How to Submit",
        icon: "send-outline",
        content: "1. Confirm that your deployment is active.\n2. Open Journals and create a journal.\n3. Enter the week number (1–52), title and optional summary.\n4. Select the journal PDF.\n5. Submit it for coordinator review.\n6. Read any feedback in the journal details.",
      },
      {
        title: "Journal Status",
        icon: "time-outline",
        content: "Draft: not yet submitted.\nSubmitted or reviewing: awaiting a decision.\nApproved: accepted by your coordinator.\nRejected: read the feedback and follow your coordinator’s correction instructions.\nCompleting the journal requirements does not automatically approve internship completion.",
      },
    ],
  },
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
    fontSize: 16,
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