
import { router } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  RefreshControl,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect, useRef, useCallback } from "react";
import * as SecureStore from "expo-secure-store";

import { useTheme } from "../../../src/context/ThemeContext";
import { dashboardService } from "../../../src/services/dashboard.service";
import { notificationService } from "../../../src/services/notification.service";
import { authService } from "../../../src/services/auth.service";
import { dtrService } from "../../../src/services/dtr.service";
import { useScrollContext } from "../../../src/context/ScrollContext";

import HeroCard from "../../../src/components/dashboard/HeroCard";
import InternshipProgressCard from "../../../src/components/dashboard/InternshipProgressCard";
import StatisticCard from "../../../src/components/dashboard/StatisticCard";
import QuickActionCard from "../../../src/components/dashboard/QuickActionCard";
import ActivityTimeline from "../../../src/components/dashboard/ActivityTimeline";
import SectionHeader from "../../../src/components/dashboard/SectionHeader";
import SkeletonLoader from "../../../src/components/dashboard/SkeletonLoader";

const REQUIRED_HOURS = 486;

interface DashboardStats {
  applications: number;
  documents: number;
  dtr: number;
  journals: number;
}

interface InternshipProgress {
  progress: number;
  hoursRendered: number;
  remainingHours: number;
  currentCompany: string;
}

const DEFAULT_STATS: DashboardStats = {
  applications: 0,
  documents: 0,
  dtr: 0,
  journals: 0,
};

const DEFAULT_PROGRESS: InternshipProgress = {
  progress: 0,
  hoursRendered: 0,
  remainingHours: REQUIRED_HOURS,
  currentCompany: "Not yet assigned",
};

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";

  return "Good Evening";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function safeNumber(value: unknown, fallback = 0): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const { setScrollValue } = useScrollContext();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [activities, setActivities] = useState<any[]>([]);

  const [notificationCount, setNotificationCount] = useState(0);

  const [greeting, setGreeting] = useState(getGreeting());
  const [currentDate, setCurrentDate] = useState(
    formatDate(new Date())
  );

  const [userName, setUserName] = useState("Student");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const [progress, setProgress] =
    useState<InternshipProgress>(DEFAULT_PROGRESS);

  const lastScrollY = useRef(0);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const loadUserData = useCallback(async (requestId: number) => {
    try {
      const userData = await SecureStore.getItemAsync("user");

      let nextUserName = "Student";

      if (userData) {
        const user = JSON.parse(userData);
        nextUserName = user.first_name || "Student";
      }

      const avatar = await authService.getAvatar();

      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      setUserName(nextUserName);
      setUserAvatar(avatar || null);
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  }, []);

  const fetchDashboardData = useCallback(
    async (requestId: number) => {
      try {
        const [statsData, activitiesData] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getRecentActivities(4),
        ]);

        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        setStats({
          applications: safeNumber(statsData?.applications),
          documents: safeNumber(statsData?.documents),
          dtr: safeNumber(statsData?.dtr),
          journals: safeNumber(statsData?.journals),
        });

        setActivities(
          Array.isArray(activitiesData) ? activitiesData : []
        );
      } catch (error) {
        console.error("Error fetching dashboard data:", error);

        // Preserve previously loaded data during temporary errors.
      }
    },
    []
  );

  const fetchNotificationCount = useCallback(
    async (requestId: number) => {
      try {
        const count =
          await notificationService.getNotificationCount();

        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        setNotificationCount(
          Math.max(0, safeNumber(count?.unread))
        );
      } catch (error) {
        console.error(
          "Error fetching notification count:",
          error
        );
      }
    },
    []
  );

  const fetchProgress = useCallback(
    async (requestId: number) => {
      try {
        const summary = await dtrService.getDTRSummary();

        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        const hoursRendered = Math.max(
          0,
          safeNumber(summary?.total_hours)
        );

        const remainingHours = Math.max(
          0,
          safeNumber(
            summary?.remaining_hours,
            REQUIRED_HOURS - hoursRendered
          )
        );

        const progressPercent = Math.min(
          100,
          Math.max(
            0,
            safeNumber(
              summary?.progress_percent,
              (hoursRendered / REQUIRED_HOURS) * 100
            )
          )
        );

        setProgress({
          progress: progressPercent,
          hoursRendered,
          remainingHours,
          currentCompany:
            summary?.current_company || "Not yet assigned",
        });
      } catch (error) {
        console.error("Error fetching progress:", error);
      }
    },
    []
  );

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      const requestId = ++requestIdRef.current;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const now = new Date();
      setGreeting(getGreeting());
      setCurrentDate(formatDate(now));

      try {
        await Promise.allSettled([
          loadUserData(requestId),
          fetchDashboardData(requestId),
          fetchNotificationCount(requestId),
          fetchProgress(requestId),
        ]);
      } finally {
        if (
          mountedRef.current &&
          requestId === requestIdRef.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      loadUserData,
      fetchDashboardData,
      fetchNotificationCount,
      fetchProgress,
    ]
  );

  useEffect(() => {
    mountedRef.current = true;

    void loadDashboard();

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    void loadDashboard(true);
  }, [loadDashboard]);

  const navigateTo = (route: string) => {
    router.push(route as any);
  };

  const handleScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const currentOffsetY =
      event.nativeEvent.contentOffset.y;

    const diff = currentOffsetY - lastScrollY.current;

    if (currentOffsetY <= 0) {
      setScrollValue(0);
    } else if (diff > 5) {
      setScrollValue(1);
    } else if (diff < -5) {
      setScrollValue(0);
    }

    lastScrollY.current = currentOffsetY;
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background },
        ]}
      >
        <StatusBar
          style={isDark ? "light" : "dark"}
          backgroundColor={colors.background}
        />

        <SkeletonLoader />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={colors.background}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <HeroCard
          greeting={greeting}
          userName={userName}
          userAvatar={userAvatar}
          currentDate={currentDate}
          notificationCount={notificationCount}
          onNotificationPress={() =>
            navigateTo("/(student)/notifications")
          }
          onProfilePress={() =>
            navigateTo("/(student)/profile")
          }
        />

        <InternshipProgressCard
          progress={progress.progress}
          hoursRendered={progress.hoursRendered}
          remainingHours={progress.remainingHours}
          currentCompany={progress.currentCompany}
        />

        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <StatisticCard
              icon="briefcase-outline"
              value={stats.applications}
              label="Applications"
              color={colors.primary}
              onPress={() =>
                navigateTo("/(student)/applications")
              }
            />

            <StatisticCard
              icon="document-text-outline"
              value={stats.documents}
              label="Documents"
              color="#0EA5E9"
              onPress={() =>
                navigateTo("/(student)/documents")
              }
            />
          </View>

          <View style={styles.statsRow}>
            <StatisticCard
              icon="calendar-outline"
              value={stats.dtr}
              label="DTR Records"
              color="#10B981"
              onPress={() =>
                navigateTo("/(student)/dtr")
              }
            />

            <StatisticCard
              icon="book-outline"
              value={stats.journals}
              label="Journals"
              color="#F59E0B"
              onPress={() =>
                navigateTo("/(student)/journals")
              }
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
              onPress={() =>
                navigateTo("/(student)/applications/new")
              }
            />

            <QuickActionCard
              icon="document-text-outline"
              label="Upload Document"
              subtitle="Submit requirements"
              color="#0EA5E9"
              onPress={() =>
                navigateTo("/(student)/documents/upload")
              }
            />

            <QuickActionCard
              icon="calendar-outline"
              label="Submit DTR"
              subtitle="Log your daily time"
              color="#10B981"
              onPress={() =>
                navigateTo("/(student)/dtr/new")
              }
            />

            <QuickActionCard
              icon="book-outline"
              label="Weekly Journal"
              subtitle="Submit your journal"
              color="#F59E0B"
              onPress={() =>
                navigateTo("/(student)/journals/new")
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Recent Activities" />

          <ActivityTimeline activities={activities} />
        </View>
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
    marginTop: 20,
    gap: 12,
  },

  statsRow: {
    flexDirection: "row",
    gap: 12,
  },

  section: {
    marginTop: 28,
    paddingHorizontal: 20,
  },

  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginTop: 16,
  },
});
