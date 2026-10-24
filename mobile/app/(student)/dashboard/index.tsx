
import { router, useFocusEffect } from "expo-router";
import {
  Alert,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState, useRef, useCallback } from "react";
import * as SecureStore from "expo-secure-store";

import { useTheme } from "../../../src/context/ThemeContext";
import { dashboardService } from "../../../src/services/dashboard.service";
import { notificationService } from "../../../src/services/notification.service";
import { authService } from "../../../src/services/auth.service";
import { dtrService } from "../../../src/services/dtr.service";
import { deploymentService } from "../../../src/services/deployment.service";
import type { InternshipDeployment } from "../../../src/services/deployment.service";
import { useScrollContext } from "../../../src/context/ScrollContext";

import HeroCard from "../../../src/components/dashboard/HeroCard";
import InternshipProgressCard from "../../../src/components/dashboard/InternshipProgressCard";
import StatisticCard from "../../../src/components/dashboard/StatisticCard";
import QuickActionCard from "../../../src/components/dashboard/QuickActionCard";
import ActivityTimeline from "../../../src/components/dashboard/ActivityTimeline";
import SectionHeader from "../../../src/components/dashboard/SectionHeader";
import SkeletonLoader from "../../../src/components/dashboard/SkeletonLoader";

const REQUIRED_HOURS = 486;

// ============================================================
// TYPES AND INTERFACES
// ============================================================

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

interface StudentUser {
  id?: string;
  email?: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

// ============================================================
// DEFAULT VALUES
// ============================================================

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

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good Morning";
  }

  if (hour < 17) {
    return "Good Afternoon";
  }

  return "Good Evening";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function safeNumber(
  value: unknown,
  fallback = 0
): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

/**
 * Build the student's complete display name.
 *
 * Examples:
 *
 * Juan + M. + Cruz
 * => Juan M. Cruz
 *
 * Juan + null + Cruz
 * => Juan Cruz
 *
 * Maria Angela + D. + Santos
 * => Maria Angela D. Santos
 *
 * Legacy accounts:
 * Juan M. + null + Cruz
 * => Juan M. Cruz
 */
function formatFullName(
  user: StudentUser | null | undefined
): string {
  if (!user) {
    return "Student";
  }

  const nameParts = [
    user.first_name,
    user.middle_name,
    user.last_name,
  ];

  const fullName = nameParts
    .filter(
      (part): part is string =>
        typeof part === "string" &&
        part.trim().length > 0
    )
    .map((part) => part.trim())
    .join(" ");

  return fullName || "Student";
}

// ============================================================
// DASHBOARD SCREEN
// ============================================================

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const { setScrollValue } = useScrollContext();

  // ==========================================================
  // STATES
  // ==========================================================

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] =
    useState<DashboardStats>(DEFAULT_STATS);

  const [activities, setActivities] =
    useState<any[]>([]);

  const [notificationCount, setNotificationCount] =
    useState(0);

  const [greeting, setGreeting] =
    useState(getGreeting());

  const [currentDate, setCurrentDate] = useState(
    formatDate(new Date())
  );

  const [userName, setUserName] =
    useState("Student");

  const [userAvatar, setUserAvatar] =
    useState<string | null>(null);

  const [progress, setProgress] =
    useState<InternshipProgress>(DEFAULT_PROGRESS);

  const [deployment, setDeployment] =
    useState<InternshipDeployment | null>(null);
  const [deploymentError, setDeploymentError] = useState(false);

  // ==========================================================
  // REFERENCES
  // ==========================================================

  const lastScrollY = useRef(0);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);

  /**
   * Prevent outdated requests from modifying dashboard state.
   */
  const isCurrentRequest = useCallback(
    (requestId: number): boolean => {
      return (
        mountedRef.current &&
        requestId === requestIdRef.current
      );
    },
    []
  );

  // ==========================================================
  // LOAD STUDENT INFORMATION
  // ==========================================================

  const loadUserData = useCallback(
    async (requestId: number) => {
      let cachedUser: StudentUser | null = null;

      // ------------------------------------------------------
      // STEP 1: LOAD CACHED USER
      // ------------------------------------------------------

      try {
        const storedUser =
          await SecureStore.getItemAsync("user");

        if (storedUser) {
          cachedUser = JSON.parse(
            storedUser
          ) as StudentUser;

          if (isCurrentRequest(requestId)) {
            setUserName(
              formatFullName(cachedUser)
            );
          }
        }
      } catch (error) {
        console.error(
          "Error reading cached student information:",
          error
        );
      }

      // ------------------------------------------------------
      // STEP 2: REFRESH USER FROM BACKEND
      // ------------------------------------------------------

      try {
        const currentUser =
          await authService.getCurrentUser();

        if (!isCurrentRequest(requestId)) {
          return;
        }

        if (currentUser) {
          const updatedUser =
            currentUser as StudentUser;

          setUserName(
            formatFullName(updatedUser)
          );

          // Update locally cached profile information.
          // Preserve any existing cached fields not returned
          // by the backend.
          try {
            const mergedUser = {
              ...(cachedUser || {}),
              ...updatedUser,
            };

            await SecureStore.setItemAsync(
              "user",
              JSON.stringify(mergedUser)
            );
          } catch (storageError) {
            console.error(
              "Error caching updated student information:",
              storageError
            );
          }
        }
      } catch (error) {
        // Keep the cached name if the backend is unavailable.
        console.error(
          "Error refreshing student information:",
          error
        );
      }

      // ------------------------------------------------------
      // STEP 3: LOAD STUDENT AVATAR
      // ------------------------------------------------------

      try {
        const avatar =
          await authService.getAvatar();

        if (!isCurrentRequest(requestId)) {
          return;
        }

        setUserAvatar(avatar || null);
      } catch (error) {
        console.error(
          "Error loading student avatar:",
          error
        );
      }
    },
    [isCurrentRequest]
  );

  // ==========================================================
  // FETCH DASHBOARD STATISTICS
  // ==========================================================

  const fetchDashboardData = useCallback(
    async (requestId: number) => {
      try {
        const [
          statsData,
          activitiesData,
        ] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getRecentActivities(4),
        ]);

        if (!isCurrentRequest(requestId)) {
          return;
        }

        setStats({
          applications: safeNumber(
            statsData?.applications
          ),
          documents: safeNumber(
            statsData?.documents
          ),
          dtr: safeNumber(
            statsData?.dtr
          ),
          journals: safeNumber(
            statsData?.journals
          ),
        });

        setActivities(
          Array.isArray(activitiesData)
            ? activitiesData
            : []
        );
      } catch (error) {
        console.error(
          "Error fetching dashboard data:",
          error
        );

        // Preserve previously loaded statistics.
      }
    },
    [isCurrentRequest]
  );

  // ==========================================================
  // FETCH NOTIFICATION COUNT
  // ==========================================================

  const fetchNotificationCount = useCallback(
    async (requestId: number) => {
      try {
        const count =
          await notificationService
            .getNotificationCount();

        if (!isCurrentRequest(requestId)) {
          return;
        }

        setNotificationCount(
          Math.max(
            0,
            safeNumber(count?.unread)
          )
        );
      } catch (error) {
        console.error(
          "Error fetching notification count:",
          error
        );
      }
    },
    [isCurrentRequest]
  );

  const fetchDeployment = useCallback(
    async (requestId: number) => {
      try {
        const currentDeployment = await deploymentService.getMyDeployment();

        if (!isCurrentRequest(requestId)) return;

        setDeployment(currentDeployment);
        setDeploymentError(false);
      } catch (error) {
        console.error("Error fetching internship deployment:", error);

        if (!isCurrentRequest(requestId)) return;

        setDeployment(null);
        setDeploymentError(true);
      }
    },
    [isCurrentRequest]
  );

  // ==========================================================
  // FETCH INTERNSHIP PROGRESS
  // ==========================================================

  const fetchProgress = useCallback(
    async (requestId: number) => {
      try {
        const summary =
          await dtrService.getDTRSummary();

        if (!isCurrentRequest(requestId)) {
          return;
        }

        const hoursRendered = Math.max(
          0,
          safeNumber(
            summary?.total_hours
          )
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
            summary?.current_company ||
            "Not yet assigned",
        });
      } catch (error) {
        console.error(
          "Error fetching internship progress:",
          error
        );
      }
    },
    [isCurrentRequest]
  );

  // ==========================================================
  // LOAD DASHBOARD
  // ==========================================================

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      const requestId =
        ++requestIdRef.current;

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
          fetchDeployment(requestId),
        ]);
      } finally {
        if (isCurrentRequest(requestId)) {
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
      fetchDeployment,
      isCurrentRequest,
    ]
  );

  // ==========================================================
  // INITIAL DASHBOARD LOAD
  // ==========================================================

  useFocusEffect(useCallback(() => {
    mountedRef.current = true;

    void loadDashboard();

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [loadDashboard]));

  // ==========================================================
  // PULL TO REFRESH
  // ==========================================================

  const onRefresh = useCallback(() => {
    void loadDashboard(true);
  }, [loadDashboard]);

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const navigateTo = (route: string) => {
    const isInternshipRoute =
      route === "/(student)/dtr" || route.startsWith("/(student)/dtr/") ||
      route === "/(student)/journals" || route.startsWith("/(student)/journals/");
    const isSubmissionRoute =
      route === "/(student)/dtr/new" || route === "/(student)/journals/new";

    if (isInternshipRoute) {
      if (refreshing || deploymentError) {
        Alert.alert(
          "Deployment Status Unavailable",
          refreshing
            ? "Please wait while your deployment status is refreshed."
            : "Unable to verify your deployment. Pull down to refresh and try again."
        );
        return;
      }

      const canAccessRecords =
        deployment?.status === "DEPLOYED" || deployment?.status === "COMPLETED";
      const canSubmit = deployment?.status === "DEPLOYED";

      if (!canAccessRecords || (isSubmissionRoute && !canSubmit)) {
        Alert.alert(
          "Deployment Required",
          deployment?.status === "COMPLETED"
            ? "Your internship is completed. You can view existing records, but new submissions are closed."
            : "Your coordinator must confirm your internship deployment before you can access DTR and journals."
        );
        return;
      }
    }

    router.push(route as any);
  };

  // ==========================================================
  // SCROLL HANDLER
  // ==========================================================

  const handleScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const currentOffsetY =
      event.nativeEvent.contentOffset.y;

    const diff =
      currentOffsetY - lastScrollY.current;

    if (currentOffsetY <= 0) {
      setScrollValue(0);
    } else if (diff > 5) {
      setScrollValue(1);
    } else if (diff < -5) {
      setScrollValue(0);
    }

    lastScrollY.current = currentOffsetY;
  };

  // ==========================================================
  // LOADING SCREEN
  // ==========================================================

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor:
              colors.background,
          },
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

  // ==========================================================
  // MAIN DASHBOARD
  // ==========================================================

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            colors.background,
        },
      ]}
    >
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={colors.background}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
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
        {/* ============================================= */}
        {/* STUDENT HERO CARD */}
        {/* ============================================= */}

        <HeroCard
          greeting={greeting}
          userName={userName}
          userAvatar={userAvatar}
          currentDate={currentDate}
          notificationCount={
            notificationCount
          }
          onNotificationPress={() =>
            navigateTo(
              "/(student)/notifications"
            )
          }
          onProfilePress={() =>
            navigateTo(
              "/(student)/profile"
            )
          }
        />

        {/* ============================================= */}
        {/* INTERNSHIP PROGRESS */}
        {/* ============================================= */}

        <InternshipProgressCard
          progress={progress.progress}
          hoursRendered={
            progress.hoursRendered
          }
          remainingHours={
            progress.remainingHours
          }
          currentCompany={
            deployment?.company_name || progress.currentCompany
          }
          deploymentStatus={deployment?.status}
          academicYear={deployment?.academic_year}
          semester={deployment?.semester}
          deploymentDate={deployment?.deployment_date}
        />

        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigateTo("/(student)/pre-deployment")}
          style={[styles.deploymentLink, { backgroundColor: colors.card }]}
          activeOpacity={0.8}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15 }}>
            {deployment?.status === "DEPLOYED" || deployment?.status === "COMPLETED"
              ? "View deployment details"
              : "View pre-deployment checklist"}
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4, lineHeight: 20 }}>
            Requirements, verification status, and coordinator confirmation
          </Text>
        </TouchableOpacity>

        {/* ============================================= */}
        <TouchableOpacity onPress={() => router.push('/(student)/completion' as never)} style={{ marginHorizontal: 20, marginBottom: 18, padding: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}><Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Final clearance & official completion</Text><Text style={{ color: colors.textSecondary, marginTop: 6, lineHeight: 20 }}>View approved requirements, submit final files, and track school completion.</Text></TouchableOpacity>
        {/* DASHBOARD STATISTICS */}
        {/* ============================================= */}

        <View
          style={styles.statsContainer}
        >
          <View style={styles.statsRow}>
            <StatisticCard
              icon="briefcase-outline"
              value={stats.applications}
              label="Applications"
              color={colors.primary}
              onPress={() =>
                navigateTo(
                  "/(student)/applications"
                )
              }
            />

            <StatisticCard
              icon="document-text-outline"
              value={stats.documents}
              label="Documents"
              color="#0EA5E9"
              onPress={() =>
                navigateTo(
                  "/(student)/documents"
                )
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
                navigateTo(
                  "/(student)/dtr"
                )
              }
            />

            <StatisticCard
              icon="book-outline"
              value={stats.journals}
              label="Journals"
              color="#F59E0B"
              onPress={() =>
                navigateTo(
                  "/(student)/journals"
                )
              }
            />
          </View>
        </View>

        {/* ============================================= */}
        {/* QUICK ACTIONS */}
        {/* ============================================= */}

        <View style={styles.section}>
          <SectionHeader
            title="Quick Actions"
          />

          <View
            style={styles.quickActionsGrid}
          >
            <QuickActionCard
              icon="briefcase-outline"
              label="Apply Internship"
              subtitle="Start your application"
              color={colors.primary}
              onPress={() =>
                navigateTo(
                  "/(student)/applications/new"
                )
              }
            />

            <QuickActionCard
              icon="document-text-outline"
              label="Upload Document"
              subtitle="Submit requirements"
              color="#0EA5E9"
              onPress={() =>
                navigateTo(
                  "/(student)/documents/upload"
                )
              }
            />

            <QuickActionCard
              icon="calendar-outline"
              label="Submit DTR"
              subtitle="Log your daily time"
              color="#10B981"
              onPress={() =>
                navigateTo(
                  "/(student)/dtr/new"
                )
              }
            />

            <QuickActionCard
              icon="book-outline"
              label="Weekly Journal"
              subtitle="Submit your journal"
              color="#F59E0B"
              onPress={() =>
                navigateTo(
                  "/(student)/journals/new"
                )
              }
            />
          </View>
        </View>

        {/* ============================================= */}
        {/* RECENT ACTIVITIES */}
        {/* ============================================= */}

        <View style={styles.section}>
          <SectionHeader
            title="Recent Activities"
          />

          <ActivityTimeline
            activities={activities}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  deploymentLink: { marginHorizontal: 20, marginBottom: 4, padding: 18, borderRadius: 16 },
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
