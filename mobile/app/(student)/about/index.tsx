// app/(student)/about/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Image, Linking, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "../../../src/context/ThemeContext";
import { APP_NAME, APP_VERSION } from "../../../src/constants/app";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

interface TeamMember {
  id: string;
  name: string;
  role: string;
  description: string;
  image: any;
  social?: {
    github?: string;
    linkedin?: string;
    email?: string;
  };
}

const teamMembers: TeamMember[] = [
  {
    id: "0",
    name: "Kenneth C. Ampolitod",
    role: "Capstone Adviser",
    description: "Provides guidance, mentorship, and oversight throughout the project lifecycle. Ensures the project meets academic standards and industry best practices.",
    image: require("../../../assets/images/team/ampolitod.jpg"),
    social: {
      linkedin: "https://linkedin.com/in/kenneth",
      email: "kenneth.ampolitod@ustp.edu.ph",
    },
  },
  {
    id: "1",
    name: "Maikent Jeorge C. Lopez",
    role: "System Analyst",
    description: "Analyzes system requirements, designs architecture, and ensures the system meets all functional and non-functional requirements.",
    image: require("../../../assets/images/team/lopez.jpg"),
    social: {
      github: "https://github.com/maikent",
      linkedin: "https://linkedin.com/in/maikent",
    },
  },
  {
    id: "2",
    name: "Henna Christine C. Pajo",
    role: "Database Administrator",
    description: "Manages database design, optimization, and maintenance. Ensures data integrity, security, and efficient data retrieval.",
    image: require("../../../assets/images/team/pajo.jpg"),
    social: {
      github: "https://github.com/henna",
      linkedin: "https://linkedin.com/in/henna",
    },
  },
  {
    id: "3",
    name: "Harry S. Fernandez",
    role: "Technical Writer",
    description: "Documents system architecture, creates user manuals, and prepares technical documentation for the project.",
    image: require("../../../assets/images/team/fernandez.jpg"),
    social: {
      github: "https://github.com/harry",
      linkedin: "https://linkedin.com/in/harry",
    },
  },
  {
    id: "4",
    name: "Faisal R. Inidal",
    role: "Front End Developer",
    description: "Develops the user interface and experience of the mobile application. Ensures the app is responsive, intuitive, and visually appealing.",
    image: require("../../../assets/images/team/faisal.jpg"),
    social: {
      github: "https://github.com/faisal",
      linkedin: "https://linkedin.com/in/faisal",
    },
  },
  {
    id: "5",
    name: "Varren Meg M. Naive",
    role: "Backend Developer",
    description: "Develops server-side logic, API endpoints, and database integration. Ensures the system is scalable, secure, and performs efficiently.",
    image: require("../../../assets/images/team/naive.jpg"),
    social: {
      github: "https://github.com/varren",
      linkedin: "https://linkedin.com/in/varren",
    },
  },
];

export default function AboutScreen() {
  const { colors, isDark } = useTheme();

  const openLink = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  const renderAdviser = (member: TeamMember) => (
    <MotiView
      from={{ opacity: 0, scale: 0.96, translateY: 20 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      transition={{ type: "spring", delay: 120, damping: 16 }}
      style={styles.adviserWrapper}
    >
      <LinearGradient
        colors={isDark ? ['rgba(0,0,128,0.15)', 'rgba(0,0,128,0.05)'] : ['rgba(0,0,128,0.08)', 'rgba(0,0,128,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.adviserCard, { borderColor: colors.primary }]}
      >
        <View style={styles.adviserHeader}>
          <View style={[styles.adviserAvatar, { backgroundColor: `${colors.primary}15` }]}>
            <Image source={member.image} style={styles.adviserImage} resizeMode="cover" />
            <View style={styles.adviserBadge}>
              <Ionicons name="star" size={12} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.adviserInfo}>
            <Text style={[styles.adviserName, { color: colors.textPrimary }]}>{member.name}</Text>
            <View style={[styles.adviserRolePill, { backgroundColor: `${colors.primary}20` }]}>
              <Ionicons name="school-outline" size={12} color={colors.primary} />
              <Text style={[styles.adviserRoleText, { color: colors.primary }]}>{member.role}</Text>
            </View>
          </View>
        </View>
        <Text style={[styles.adviserDescription, { color: colors.textSecondary }]}>
          {member.description}
        </Text>
        <View style={styles.adviserSocialRow}>
          {member.social?.linkedin && (
            <TouchableOpacity
              style={[styles.adviserSocialBtn, { backgroundColor: `${colors.primary}12` }]}
              onPress={() => openLink(member.social!.linkedin!)}
              activeOpacity={0.7}
              accessibilityLabel="LinkedIn Profile"
            >
              <Ionicons name="logo-linkedin" size={16} color={colors.primary} />
              <Text style={[styles.adviserSocialBtnText, { color: colors.primary }]}>Connect</Text>
            </TouchableOpacity>
          )}
          {member.social?.email && (
            <TouchableOpacity
              style={[styles.adviserSocialBtn, { backgroundColor: `${colors.primary}12` }]}
              onPress={() => openLink(`mailto:${member.social!.email}`)}
              activeOpacity={0.7}
              accessibilityLabel="Send Email"
            >
              <Ionicons name="mail-outline" size={16} color={colors.primary} />
              <Text style={[styles.adviserSocialBtnText, { color: colors.primary }]}>Email</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </MotiView>
  );

  const renderTeamMember = (member: TeamMember) => {
    if (member.id === "0") return null;
    const index = parseInt(member.id) - 1;

    return (
      <MotiView
        key={member.id}
        from={{ opacity: 0, scale: 0.94, translateY: 24 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: "spring", delay: 160 + index * 40, damping: 14 }}
        style={[styles.memberCard, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}
      >
        <View style={styles.memberAvatar}>
          <Image source={member.image} style={styles.memberImage} resizeMode="cover" />
          <View style={styles.memberInitials}>
            <Text style={styles.memberInitialsText}>
              {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
        </View>
        <Text style={[styles.memberName, { color: colors.textPrimary }]} numberOfLines={2}>
          {member.name}
        </Text>
        <View style={[styles.memberRolePill, { backgroundColor: `${colors.primary}10` }]}>
          <Text style={[styles.memberRoleText, { color: colors.primary }]} numberOfLines={1}>
            {member.role}
          </Text>
        </View>
        <Text style={[styles.memberDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {member.description}
        </Text>
        <View style={styles.memberSocialRow}>
          {member.social?.github && (
            <TouchableOpacity
              style={[styles.memberSocialBtn, { backgroundColor: `${colors.primary}08` }]}
              onPress={() => openLink(member.social!.github!)}
              activeOpacity={0.7}
              accessibilityLabel={`${member.name} GitHub`}
            >
              <Ionicons name="logo-github" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
          {member.social?.linkedin && (
            <TouchableOpacity
              style={[styles.memberSocialBtn, { backgroundColor: `${colors.primary}08` }]}
              onPress={() => openLink(member.social!.linkedin!)}
              activeOpacity={0.7}
              accessibilityLabel={`${member.name} LinkedIn`}
            >
              <Ionicons name="logo-linkedin" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </MotiView>
    );
  };

  // Modified team rendering logic
  const team = teamMembers.filter(m => m.id !== "0");
  
  // Find Varren Meg M. Naive specifically
  const varrenIndex = team.findIndex(m => m.name === "Varren Meg M. Naive");
  
  // Create rows with proper centering for Varren
  const teamRows = [];
  
  if (varrenIndex !== -1) {
    // Get all members before Varren
    const beforeVarren = team.slice(0, varrenIndex);
    const afterVarren = team.slice(varrenIndex + 1);
    
    // Group members before Varren into pairs
    for (let i = 0; i < beforeVarren.length; i += 2) {
      teamRows.push(beforeVarren.slice(i, i + 2));
    }
    
    // Add Varren as a single centered item
    teamRows.push([team[varrenIndex]]);
    
    // Group members after Varren into pairs
    for (let i = 0; i < afterVarren.length; i += 2) {
      teamRows.push(afterVarren.slice(i, i + 2));
    }
  } else {
    // Fallback: just group all members into pairs
    for (let i = 0; i < team.length; i += 2) {
      teamRows.push(team.slice(i, i + 2));
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go Back">
          <Ionicons name="arrow-back-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>About AIMS</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Version {APP_VERSION}</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} accessibilityLabel="Close">
          <Ionicons name="close-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Hero Card - THIS IS WHERE "ACADEMIC INTERNSHIP MANAGEMENT SYSTEM" IS DISPLAYED */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "spring", delay: 60 }}
          style={[styles.heroCard, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
        >
          <LinearGradient
            colors={[`${colors.primary}20`, `${colors.primary}05`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          />
          <View style={[styles.heroIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="school-outline" size={40} color={colors.primary} />
          </View>
          {/* This is the title that needs to be centered - it's already centered! */}
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{APP_NAME}</Text>
          <View style={styles.heroBadge}>
            <View style={[styles.heroBadgeDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.heroBadgeText, { color: colors.success }]}>Active</Text>
          </View>
          <Text style={[styles.heroDescription, { color: colors.textSecondary }]}>
            A mobile-based academic internship management system streamlining the internship process for students, coordinators, and partner companies.
          </Text>
        </MotiView>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { value: '6', label: 'Team Members', delay: 80 },
            { value: '5', label: 'Developers', delay: 100 },
            { value: '1', label: 'Adviser', delay: 120 },
          ].map((stat, i) => (
            <MotiView
              key={i}
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "spring", delay: stat.delay }}
              style={[styles.statCard, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
            >
              <Text style={[styles.statValue, { color: colors.primary }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            </MotiView>
          ))}
        </View>

        {/* Adviser */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Project Adviser</Text>
          <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
        </View>
        {renderAdviser(teamMembers[0])}

        {/* Team */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Development Team</Text>
          <View style={[styles.sectionLine, { backgroundColor: colors.primary }]} />
        </View>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          The brilliant minds behind AIMS
        </Text>

        {teamRows.map((row, idx) => {
          const isVarrenRow = row.length === 1 && row[0].name === "Varren Meg M. Naive";
          return (
            <View key={idx} style={[styles.teamRow, isVarrenRow && styles.centeredRow]}>
              {row.map(m => renderTeamMember(m))}
              {row.length === 1 && !isVarrenRow && <View style={{ width: CARD_WIDTH }} />}
            </View>
          );
        })}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>© {new Date().getFullYear()} {APP_NAME}</Text>
          <Text style={[styles.footerSubtext, { color: colors.textSecondary }]}>Built with ❤️ by the AIMS Team</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
  },
  backBtn: { padding: 6 },
  closeBtn: { padding: 6 },
  headerCenter: { 
    flex: 1, 
    alignItems: 'center' 
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerSubtitle: { 
    fontSize: 11, 
    opacity: 0.6, 
    marginTop: 1,
    textAlign: 'center',
  },

  content: { paddingHorizontal: 16, paddingBottom: 40 },

  // Hero Card
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: { 
    fontSize: 22, 
    fontWeight: '700', 
    letterSpacing: -0.5, 
    marginBottom: 4,
    textAlign: 'center', // Ensure the title is centered
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.12)',
    marginBottom: 10,
  },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  heroBadgeText: { fontSize: 11, fontWeight: '600' },
  heroDescription: { 
    fontSize: 14, 
    textAlign: 'center', 
    lineHeight: 22, 
    opacity: 0.8,
    paddingHorizontal: 4,
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, marginTop: 2, opacity: 0.6 },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  sectionLine: { flex: 1, height: 1.5, borderRadius: 1, opacity: 0.3 },
  sectionTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 13, opacity: 0.6, marginBottom: 16 },

  // Adviser
  adviserWrapper: { marginBottom: 24 },
  adviserCard: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  adviserHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  adviserAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  adviserImage: { width: 56, height: 56, borderRadius: 28 },
  adviserBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  adviserInfo: { flex: 1 },
  adviserName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  adviserRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  adviserRoleText: { fontSize: 11, fontWeight: '600' },
  adviserDescription: { fontSize: 13, lineHeight: 20, opacity: 0.8, marginBottom: 12 },
  adviserSocialRow: { flexDirection: 'row', gap: 10 },
  adviserSocialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  adviserSocialBtnText: { fontSize: 12, fontWeight: '500' },

  // Team
  teamRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    gap: 12, 
    marginBottom: 12 
  },
  centeredRow: {
    justifyContent: 'center',
  },
  memberCard: {
    flex: 1,
    maxWidth: CARD_WIDTH,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  memberAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E8EDF5',
    marginBottom: 8,
  },
  memberImage: { width: 60, height: 60, borderRadius: 30 },
  memberInitials: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,128,0.08)',
  },
  memberInitialsText: { fontSize: 16, fontWeight: '700', color: '#000080' },
  memberName: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  memberRolePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 6 },
  memberRoleText: { fontSize: 10, fontWeight: '600' },
  memberDescription: { fontSize: 11, textAlign: 'center', lineHeight: 16, opacity: 0.7, marginBottom: 8 },
  memberSocialRow: { flexDirection: 'row', gap: 6 },
  memberSocialBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },

  // Footer
  footer: { alignItems: 'center', paddingTop: 20, paddingBottom: 8 },
  footerText: { fontSize: 12, opacity: 0.5 },
  footerSubtext: { fontSize: 11, opacity: 0.35, marginTop: 2 },
});