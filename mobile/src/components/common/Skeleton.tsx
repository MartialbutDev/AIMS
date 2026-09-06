// src/components/common/Skeleton.tsx
import { MotiView } from "moti";
import { Skeleton as MotiSkeleton } from "moti/skeleton";
import { StyleSheet, View, Dimensions } from "react-native";
import { useTheme } from "../../context/ThemeContext";

const { width: screenWidth } = Dimensions.get("window");

interface SkeletonProps {
  width?: number;  // ✅ Changed from string | number to number
  height?: number;
  radius?: number;
  colorMode?: "light" | "dark";
}

export function Skeleton({
  width = screenWidth - 40,  // ✅ Use number
  height = 20,
  radius = 8,
  colorMode,
}: SkeletonProps) {
  const { isDark } = useTheme();
  const mode = colorMode || (isDark ? "dark" : "light");

  return (
    <MotiSkeleton
      colorMode={mode}
      width={width}
      height={height}
      radius={radius}
    />
  );
}

// ✅ Skeleton for DTR Card
export function SkeletonDTRCard() {
  const { isDark } = useTheme();
  const mode = isDark ? "dark" : "light";

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <Skeleton width={120} height={20} colorMode={mode} />
          <View style={styles.timeRow}>
            <Skeleton width={60} height={16} colorMode={mode} />
            <Skeleton width={60} height={16} colorMode={mode} />
          </View>
        </View>
        <Skeleton width={70} height={24} radius={12} colorMode={mode} />
      </View>
      <View style={styles.cardFooter}>
        <Skeleton width={80} height={16} colorMode={mode} />
        <Skeleton width={100} height={16} colorMode={mode} />
      </View>
    </View>
  );
}

// ✅ Skeleton for Application Card
export function SkeletonApplicationCard() {
  const { isDark } = useTheme();
  const mode = isDark ? "dark" : "light";

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <View style={styles.avatarRow}>
            <Skeleton width={44} height={44} radius={12} colorMode={mode} />
            <View>
              <Skeleton width={120} height={18} colorMode={mode} />
              <Skeleton width={80} height={14} colorMode={mode} />
            </View>
          </View>
        </View>
        <Skeleton width={70} height={24} radius={12} colorMode={mode} />
      </View>
      <Skeleton width={100} height={14} colorMode={mode} />
    </View>
  );
}

// ✅ Skeleton for Journal Card
export function SkeletonJournalCard() {
  const { isDark } = useTheme();
  const mode = isDark ? "dark" : "light";

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <View style={styles.avatarRow}>
            <Skeleton width={40} height={40} radius={8} colorMode={mode} />
            <View>
              <Skeleton width={100} height={18} colorMode={mode} />
              <Skeleton width={80} height={14} colorMode={mode} />
            </View>
          </View>
        </View>
        <Skeleton width={60} height={20} radius={10} colorMode={mode} />
      </View>
      <Skeleton width={screenWidth - 80} height={16} colorMode={mode} />
      <Skeleton width={screenWidth - 160} height={14} colorMode={mode} />
    </View>
  );
}

// ✅ Skeleton for Document Card
export function SkeletonDocumentCard() {
  const { isDark } = useTheme();
  const mode = isDark ? "dark" : "light";

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <View style={styles.avatarRow}>
            <Skeleton width={48} height={48} radius={12} colorMode={mode} />
            <View>
              <Skeleton width={120} height={18} colorMode={mode} />
              <Skeleton width={80} height={14} colorMode={mode} />
            </View>
          </View>
        </View>
        <Skeleton width={70} height={24} radius={12} colorMode={mode} />
      </View>
    </View>
  );
}

// ✅ Skeleton for Notification Item
export function SkeletonNotification() {
  const { isDark } = useTheme();
  const mode = isDark ? "dark" : "light";

  return (
    <View style={styles.notificationItem}>
      <Skeleton width={44} height={44} radius={22} colorMode={mode} />
      <View style={styles.notificationContent}>
        <Skeleton width={screenWidth * 0.6} height={16} colorMode={mode} />
        <Skeleton width={screenWidth * 0.75} height={14} colorMode={mode} />
        <Skeleton width={screenWidth * 0.3} height={12} colorMode={mode} />
      </View>
    </View>
  );
}

// ✅ Skeleton List for DTR
export function SkeletonDTRList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonDTRCard key={`dtr-skeleton-${index}`} />
      ))}
    </View>
  );
}

// ✅ Skeleton List for Applications
export function SkeletonApplicationList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonApplicationCard key={`app-skeleton-${index}`} />
      ))}
    </View>
  );
}

// ✅ Skeleton List for Journals
export function SkeletonJournalList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonJournalCard key={`journal-skeleton-${index}`} />
      ))}
    </View>
  );
}

// ✅ Skeleton List for Documents
export function SkeletonDocumentList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonDocumentCard key={`doc-skeleton-${index}`} />
      ))}
    </View>
  );
}

// ✅ Skeleton for Notifications
export function SkeletonNotificationList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonNotification key={`notif-skeleton-${index}`} />
      ))}
    </View>
  );
}

// ✅ Skeleton for Profile Screen
export function SkeletonProfile() {
  const { isDark } = useTheme();
  const mode = isDark ? "dark" : "light";

  return (
    <View style={styles.profileContainer}>
      <View style={styles.profileHeader}>
        <Skeleton width={100} height={100} radius={50} colorMode={mode} />
        <Skeleton width={150} height={24} colorMode={mode} />
        <Skeleton width={100} height={16} colorMode={mode} />
        <Skeleton width={80} height={24} radius={12} colorMode={mode} />
      </View>
      <View style={styles.profileSection}>
        <Skeleton width={screenWidth - 40} height={60} colorMode={mode} />
        <Skeleton width={screenWidth - 40} height={60} colorMode={mode} />
        <Skeleton width={screenWidth - 40} height={60} colorMode={mode} />
      </View>
    </View>
  );
}

// ✅ Skeleton for Dashboard Stats
export function SkeletonDashboardStats() {
  const { isDark } = useTheme();
  const mode = isDark ? "dark" : "light";

  return (
    <View style={styles.statsGrid}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Skeleton width={40} height={40} radius={8} colorMode={mode} />
          <Skeleton width={60} height={26} colorMode={mode} />
          <Skeleton width={80} height={14} colorMode={mode} />
        </View>
        <View style={styles.statCard}>
          <Skeleton width={40} height={40} radius={8} colorMode={mode} />
          <Skeleton width={60} height={26} colorMode={mode} />
          <Skeleton width={80} height={14} colorMode={mode} />
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Skeleton width={40} height={40} radius={8} colorMode={mode} />
          <Skeleton width={60} height={26} colorMode={mode} />
          <Skeleton width={80} height={14} colorMode={mode} />
        </View>
        <View style={styles.statCard}>
          <Skeleton width={40} height={40} radius={8} colorMode={mode} />
          <Skeleton width={60} height={26} colorMode={mode} />
          <Skeleton width={80} height={14} colorMode={mode} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: "transparent",
    gap: 10,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardLeft: {
    flex: 1,
    gap: 8,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  profileContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  profileHeader: {
    alignItems: "center",
    gap: 8,
  },
  profileSection: {
    gap: 12,
  },
  statsGrid: {
    paddingHorizontal: 20,
    gap: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    gap: 6,
    backgroundColor: "transparent",
  },
});