// app/(student)/settings/help-support.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";

import { useTheme } from "../../../src/context/ThemeContext";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface GuideItem {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

const faqData: FAQItem[] = [
  {
    id: "1",
    question: "How do I apply for an internship?",
    answer: "Go to the Applications tab, tap 'New Application', select a company, fill in the position and cover letter, then submit.",
  },
  {
    id: "2",
    question: "How do I submit my Daily Time Record (DTR)?",
    answer: "Go to the DTR tab, tap the '+' button, take a time-in photo, enter your time-in, then later record your time-out with another photo.",
  },
  {
    id: "3",
    question: "What documents do I need to upload?",
    answer: "You need to upload your Resume/CV, Application Letter, Endorsement Letter, and Certificate of Completion.",
  },
  {
    id: "4",
    question: "How do I track my internship progress?",
    answer: "Your dashboard shows your progress including hours rendered, remaining hours, and your current company.",
  },
  {
    id: "5",
    question: "What should I do if my DTR is rejected?",
    answer: "Check the feedback from your coordinator, correct the issues, and resubmit your DTR.",
  },
  {
    id: "6",
    question: "How do I change my password?",
    answer: "Go to Settings > Change Password, enter your current password and new password, then save.",
  },
  {
    id: "7",
    question: "How do I contact my coordinator?",
    answer: "You can message your coordinator through the app or contact them via email provided in your internship details.",
  },
  {
    id: "8",
    question: "What is the minimum hours required for internship?",
    answer: "The minimum required hours is 300 hours for the internship program.",
  },
];

const guides: GuideItem[] = [
  {
    id: "1",
    title: "Getting Started",
    description: "Learn how to set up your account and start your internship journey",
    icon: "rocket-outline",
    onPress: () => router.push(`/(student)/settings/guide-detail?id=1` as any),
  },
  {
    id: "2",
    title: "How to Apply",
    description: "Step-by-step guide on applying for internships",
    icon: "briefcase-outline",
    onPress: () => router.push(`/(student)/settings/guide-detail?id=2` as any),
  },
  {
    id: "3",
    title: "DTR Guide",
    description: "Learn how to properly submit your Daily Time Records",
    icon: "calendar-outline",
    onPress: () => router.push(`/(student)/settings/guide-detail?id=3` as any),
  },
  {
    id: "4",
    title: "Journal Writing",
    description: "Tips on writing effective weekly journals",
    icon: "book-outline",
    onPress: () => router.push(`/(student)/settings/guide-detail?id=4` as any),
  },
];

export default function HelpSupportScreen() {
  const { colors, isDark } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"faq" | "guides">("faq");
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");

  const filteredFaq = faqData.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Contact Support",
      "Choose how you'd like to contact us",
      [
        {
          text: "Email",
          onPress: () => {
            Linking.openURL("mailto:support@aims.com?subject=Help%20Request");
          },
        },
        {
          text: "Phone",
          onPress: () => {
            Linking.openURL("tel:+639123456789");
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleReportProblem = () => {
    setShowReportModal(true);
  };

  const handleSubmitReport = () => {
    if (!reportTitle.trim() || !reportDescription.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    Alert.alert(
      "Report Submitted",
      "Thank you for reporting this issue. Our team will look into it.",
      [
        {
          text: "OK",
          onPress: () => {
            setShowReportModal(false);
            setReportTitle("");
            setReportDescription("");
          },
        },
      ]
    );
  };

  const renderFAQItem = ({ item }: { item: FAQItem }) => {
    const isExpanded = expandedId === item.id;

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.faqItem,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        onPress={() => toggleExpand(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.faqHeader}>
          <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>
            {item.question}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up-outline" : "chevron-down-outline"}
            size={20}
            color={colors.textSecondary}
          />
        </View>
        {isExpanded && (
          <View style={[styles.faqAnswerContainer, { borderTopColor: colors.border }]}>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
              {item.answer}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderGuideItem = ({ item }: { item: GuideItem }) => (
    <TouchableOpacity
      key={item.id}
      style={[
        styles.guideCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.guideIcon, { backgroundColor: `${colors.primary}15` }]}>
        <Ionicons name={item.icon} size={28} color={colors.primary} />
      </View>
      <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>{item.title}</Text>
      <Text style={[styles.guideDescription, { color: colors.textSecondary }]}>
        {item.description}
      </Text>
      <View style={styles.guideArrow}>
        <Ionicons name="arrow-forward-outline" size={18} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Help & Support
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleContactSupport}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="mail-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.textPrimary }]}>
              Contact Support
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleReportProblem}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: `${colors.error}15` }]}>
              <Ionicons name="flag-outline" size={24} color={colors.error} />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.textPrimary }]}>
              Report Problem
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "faq" && [styles.activeTab, { borderBottomColor: colors.primary }],
            ]}
            onPress={() => setActiveTab("faq")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === "faq" ? colors.primary : colors.textSecondary,
                },
              ]}
            >
              FAQ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "guides" && [styles.activeTab, { borderBottomColor: colors.primary }],
            ]}
            onPress={() => setActiveTab("guides")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === "guides" ? colors.primary : colors.textSecondary,
                },
              ]}
            >
              User Guides
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        {activeTab === "faq" && (
          <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search FAQs..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Content */}
        {activeTab === "faq" ? (
          <View style={styles.faqContainer}>
            {filteredFaq.length > 0 ? (
              <FlatList
                data={filteredFaq}
                renderItem={renderFAQItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={styles.faqList}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={colors.border} />
                <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>
                  No results found
                </Text>
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                  Try adjusting your search terms
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.guidesContainer}>
            {guides.map((guide) => renderGuideItem({ item: guide }))}
          </View>
        )}

        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Report Problem Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Report a Problem
              </Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Ionicons name="close-outline" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.background,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Brief title of the problem"
              placeholderTextColor={colors.textSecondary}
              value={reportTitle}
              onChangeText={setReportTitle}
            />

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.modalTextArea,
                {
                  backgroundColor: colors.background,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Describe the problem in detail..."
              placeholderTextColor={colors.textSecondary}
              value={reportDescription}
              onChangeText={setReportDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitReportButton, { backgroundColor: colors.primary }]}
              onPress={handleSubmitReport}
            >
              <Text style={styles.submitReportButtonText}>Submit Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 10,
  },
  faqContainer: {
    flex: 1,
  },
  faqList: {
    gap: 8,
  },
  faqItem: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    marginRight: 12,
  },
  faqAnswerContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 20,
  },
  guidesContainer: {
    gap: 12,
  },
  guideCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    position: "relative",
  },
  guideIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  guideDescription: {
    fontSize: 13,
    opacity: 0.7,
  },
  guideArrow: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 14,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  required: {
    color: "#EF4444",
  },
  modalInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalTextArea: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    minHeight: 120,
    marginBottom: 20,
  },
  submitReportButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitReportButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  footerSpacer: {
    height: 20,
  },
});