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
        content: "1. Download the AIMS app from the Play Store\n2. Tap 'Sign Up' on the welcome screen\n3. Enter your full name, student ID, email, and password\n4. Verify your email address\n5. Complete your profile with your contact information",
      },
      {
        title: "Complete Your Profile",
        icon: "person-outline",
        content: "1. Go to Settings > Edit Profile\n2. Add your profile picture\n3. Update your phone number\n4. Make sure all information is accurate\n5. Your profile helps coordinators identify you",
      },
      {
        title: "Understand the Dashboard",
        icon: "grid-outline",
        content: "The dashboard shows:\n• Your internship progress (hours completed)\n• Quick stats (applications, documents, DTR, journals)\n• Quick action buttons for common tasks\n• Recent activity feed\n• Upcoming deadlines",
      },
    ],
  },
  "2": {
    id: "2",
    title: "How to Apply",
    icon: "briefcase-outline",
    sections: [
      {
        title: "Find Companies",
        icon: "search-outline",
        content: "1. Go to the Applications tab\n2. Browse the list of available companies\n3. Each company shows their industry and MOA status\n4. Tap on a company to see more details\n5. Check if they have active internship positions",
      },
      {
        title: "Submit Application",
        icon: "send-outline",
        content: "1. Tap 'New Application'\n2. Select a company from the list\n3. Enter the position you're applying for\n4. Write a cover letter (optional but recommended)\n5. Review your application\n6. Tap 'Submit Application'",
      },
      {
        title: "Track Application Status",
        icon: "time-outline",
        content: "Your application will go through these stages:\n• Pending - Awaiting review\n• Reviewing - Under evaluation\n• Interview - You've been shortlisted\n• Accepted - Congratulations! You got the position\n• Rejected - Don't give up, try other companies",
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
        content: "1. Go to the DTR tab\n2. Tap the '+' button\n3. Select the current date\n4. Set your time-in (or use 'Now')\n5. Take a clear photo of yourself at your workstation\n6. Allow location access for verification\n7. Tap 'Clock In'",
      },
      {
        title: "Recording Time-Out",
        icon: "log-out-outline",
        content: "1. Go to the DTR tab\n2. Find your pending DTR entry\n3. Tap 'Record Time-Out'\n4. Take a time-out photo\n5. Allow location verification\n6. Tap 'Clock Out'\n7. Your hours will be automatically calculated",
      },
      {
        title: "DTR Status",
        icon: "checkmark-circle-outline",
        content: "Your DTR entries have these statuses:\n• Pending - Time-in recorded, waiting for time-out\n• Submitted - Complete and awaiting approval\n• Approved - Validated by your coordinator\n• Rejected - Needs correction (check feedback)",
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
        content: "Your weekly journal should include:\n• Technical skills you learned\n• Tasks you completed\n• Challenges you faced\n• How you overcame obstacles\n• Goals for next week\n• Key takeaways from the week",
      },
      {
        title: "How to Submit",
        icon: "send-outline",
        content: "1. Go to the Journals tab\n2. Tap 'New Journal'\n3. Enter the week number\n4. Write a title for your journal\n5. Write a brief summary\n6. Add detailed content (optional)\n7. Tap 'Submit Journal'",
      },
      {
        title: "Journal Status",
        icon: "time-outline",
        content: "Your journals go through these statuses:\n• Draft - Saved but not submitted\n• Submitted - Awaiting review\n• Reviewing - Being evaluated\n• Approved - Accepted by coordinator\n• Rejected - Needs revision (check feedback)",
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
            <Ionicons name={guide.icon} size={40} color={colors.primary} />
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
                <Ionicons name={section.icon} size={22} color={colors.primary} />
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