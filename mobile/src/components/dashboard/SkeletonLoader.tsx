// src/components/dashboard/SkeletonLoader.tsx
import { MotiView } from "moti";
import { Skeleton } from "moti/skeleton";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../../context/ThemeContext";

export default function SkeletonLoader() {
  const { colors } = useTheme();
  const colorMode = 'light';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.heroSkeleton}>
        <Skeleton colorMode={colorMode} width="100%" height={140} radius={24} />
      </View>

      <View style={styles.progressSkeleton}>
        <Skeleton colorMode={colorMode} width="100%" height={160} radius={20} />
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <Skeleton colorMode={colorMode} width="48%" height={100} radius={16} />
          <Skeleton colorMode={colorMode} width="48%" height={100} radius={16} />
        </View>
        <View style={styles.statsRow}>
          <Skeleton colorMode={colorMode} width="48%" height={100} radius={16} />
          <Skeleton colorMode={colorMode} width="48%" height={100} radius={16} />
        </View>
      </View>

      <View style={styles.sectionSkeleton}>
        <Skeleton colorMode={colorMode} width="30%" height={22} radius={4} />
        <View style={styles.actionsGrid}>
          <Skeleton colorMode={colorMode} width="48%" height={70} radius={16} />
          <Skeleton colorMode={colorMode} width="48%" height={70} radius={16} />
          <Skeleton colorMode={colorMode} width="48%" height={70} radius={16} />
          <Skeleton colorMode={colorMode} width="48%" height={70} radius={16} />
          <Skeleton colorMode={colorMode} width="100%" height={70} radius={16} />
        </View>
      </View>

      <View style={styles.sectionSkeleton}>
        <Skeleton colorMode={colorMode} width="30%" height={22} radius={4} />
        <View style={styles.activityList}>
          <Skeleton colorMode={colorMode} width="100%" height={60} radius={12} />
          <Skeleton colorMode={colorMode} width="100%" height={60} radius={12} />
          <Skeleton colorMode={colorMode} width="100%" height={60} radius={12} />
          <Skeleton colorMode={colorMode} width="100%" height={60} radius={12} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    flex: 1,
  },
  heroSkeleton: {
    marginBottom: 16,
  },
  progressSkeleton: {
    marginBottom: 16,
  },
  statsGrid: {
    gap: 12,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionSkeleton: {
    marginBottom: 20,
  },
  actionsGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activityList: {
    marginTop: 12,
    gap: 8,
  },
});