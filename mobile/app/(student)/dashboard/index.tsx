// app/(student)/dashboard/index.tsx
import { router } from "expo-router";
import { ScrollView, StyleSheet, RefreshControl, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect, useRef } from "react";
import * as SecureStore from "expo-secure-store";

import { useTheme } from "../../../src/context/ThemeContext";
import { dashboardService } from "../../../src/services/dashboard.service";
import { notificationService } from "../../../src/services/notification.service";
import { authService } from "../../../src/services/auth.service";
import { useScrollContext } from "../../../src/context/ScrollContext";

import HeroCard from "../../../src/components/dashboard/HeroCard";
import InternshipProgressCard from "../../../src/components/dashboard/InternshipProgressCard";
import StatisticCard from "../../../src/components/dashboard/StatisticCard";
import QuickActionCard from "../../../src/components/dashboard/QuickActionCard";
import ActivityTimeline from "../../../src/components/dashboard/ActivityTimeline";
import SectionHeader from "../../../src/components/dashboard/SectionHeader";
import DeadlineItem from "../../../src/components/dashboard/DeadlineItem";
import SkeletonLoader from "../../../src/components/dashboard/SkeletonLoader";

interface DeadlineItem {
  id: string;
  title: string;
  date: string;
  priority: "High" | "Medium" | "Low";
}

const mockDeadlines: DeadlineItem[] = [
  { id: "1", title: "Submit Weekly Journal", date: "Tomorrow", priority: "High" },
  { id: "2", title: "Upload MOA", date: "Aug 12, 2026", priority: "Medium" },
  { id: "3", title: "Complete DTR", date: "Friday, Jun 6", priority: "Low" },
];

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const { setScrollValue } = useScrollContext();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [greeting] = useState(getGreeting());
  const [userName, setUserName] = useState("Student");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [currentDate] = useState(formatDate(new Date()));
  
  const lastScrollY = useRef(0);

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  useEffect(() => {
    loadUserData();
    fetchDashboardData();
    fetchNotificationCount();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await SecureStore.getItemAsync('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserName(user.first_name || "Student");
        
        const avatar = await authService.getAvatar();
        console.log('📸 Dashboard - Avatar URL:', avatar);
        if (avatar) {
          setUserAvatar(avatar);
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const fetchNotificationCount = async () => {
    try {
      const count = await notificationService.getNotificationCount();
      setNotificationCount(count.unread);
    } catch (error) {
      console.error("Error fetching notification count:", error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [statsData, activitiesData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getRecentActivities(4),
      ]);
      setStats(statsData);
      setActivities(activitiesData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setStats({ applications: 0, documents: 0, dtr: 0, journals: 0 });
      setActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    await Promise.all([fetchDashboardData(), fetchNotificationCount()]);
  };

  const navigateTo = (route: string) => {
    router.push(route as any);
  };

  const handleScroll = (event: any) => {
    const currentOffsetY = event.nativeEvent.contentOffset.y;
    const diff = currentOffsetY - lastScrollY.current;
    
    if (diff > 5) {
      setScrollValue(1);
    } else if (diff < -5) {
      setScrollValue(0);
    }
    
    lastScrollY.current = currentOffsetY;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
        <SkeletonLoader />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        <HeroCard
          greeting={greeting}
          userName={userName}
          userAvatar={userAvatar}
          currentDate={currentDate}
          notificationCount={notificationCount}
          onNotificationPress={() => navigateTo("/(student)/notifications")}
          onProfilePress={() => navigateTo("/(student)/profile")}
        />

        <InternshipProgressCard
          progress={68}
          hoursRendered={320}
          remainingHours={150}
          currentCompany="TechNova Inc."
        />

        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <StatisticCard
              icon="briefcase-outline"
              value={stats?.applications || 0}
              label="Applications"
              color={colors.primary}
              onPress={() => navigateTo("/(student)/applications")}
            />
            <StatisticCard
              icon="document-text-outline"
              value={stats?.documents || 0}
              label="Documents"
              color="#0EA5E9"
              onPress={() => navigateTo("/(student)/documents")}
            />
          </View>
          <View style={styles.statsRow}>
            <StatisticCard
              icon="calendar-outline"
              value={stats?.dtr || 0}
              label="DTR Records"
              color="#10B981"
              onPress={() => navigateTo("/(student)/dtr")}
            />
            <StatisticCard
              icon="book-outline"
              value={stats?.journals || 0}
              label="Journals"
              color="#F59E0B"
              onPress={() => navigateTo("/(student)/journals")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              icon="briefcase-outline"
              label="Apply Internship"
              subtitle="Start your application"
              color={colors.primary}
              onPress={() => navigateTo("/(student)/applications/new")}
            />
            <QuickActionCard
              icon="document-text-outline"
              label="Upload Document"
              subtitle="Submit requirements"
              color="#0EA5E9"
              onPress={() => navigateTo("/(student)/documents/upload")}
            />
            <QuickActionCard
              icon="calendar-outline"
              label="Submit DTR"
              subtitle="Log your daily time"
              color="#10B981"
              onPress={() => navigateTo("/(student)/dtr/new")}
            />
            <QuickActionCard
              icon="book-outline"
              label="Write Journal"
              subtitle="Share your experience"
              color="#F59E0B"
              onPress={() => navigateTo("/(student)/journals/new")}
            />
            <QuickActionCard
              icon="stats-chart-outline"
              label="View Reports"
              subtitle="Track your progress"
              color="#8B5CF6"
              onPress={() => navigateTo("/(student)/reports")}
              fullWidth
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Recent Activity" />
          <View style={[
            styles.activityCard, 
            { 
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
            }
          ]}>
            <ActivityTimeline activities={activities} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Upcoming Deadlines" />
          <View style={[
            styles.deadlinesCard, 
            { 
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
            }
          ]}>
            {mockDeadlines.map((deadline, index) => (
              <DeadlineItem
                key={deadline.id}
                title={deadline.title}
                date={deadline.date}
                priority={deadline.priority}
                index={index}
                isLast={index === mockDeadlines.length - 1}
              />
            ))}
          </View>
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
  scrollContent: {
    paddingBottom: 120,
  },
  statsContainer: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  activityCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1,
  },
  deadlinesCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1,
  },
  footerSpacer: {
    height: 30,
  },
});