// src/components/dashboard/InternshipProgressCard.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { useTheme } from "../../context/ThemeContext";

interface InternshipProgressCardProps {
  progress: number;
  hoursRendered: number;
  remainingHours: number;
  currentCompany: string;
}

export default function InternshipProgressCard({
  progress,
  hoursRendered,
  remainingHours,
  currentCompany,
}: InternshipProgressCardProps) {
  const { colors, isDark } = useTheme();

  // ✅ FIXED: Use as const to make it a readonly tuple
  const gradientColors = isDark 
    ? ["#1E293B", "#0F172A"] as const  // Dark mode
    : ["#FFFFFF", "#F8FAFC"] as const; // Light mode

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "spring", delay: 150 }}
      style={styles.container}
    >
      <LinearGradient
        colors={gradientColors}  // ✅ Now TypeScript is happy
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Internship Progress</Text>
          <Text style={[styles.percentage, { color: colors.primary }]}>{progress}%</Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#334155' : '#E8EDF5' }]}>
            <Animated.View
              style={[
                styles.progressBarFill,
                { width: `${progress}%`, backgroundColor: colors.primary },
              ]}
            />
          </View>
        </View>

        <View style={[styles.statsContainer, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
          <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{hoursRendered}h</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Hours Rendered</Text>
            </View>
          </View>

          <View style={[styles.statDivider, { backgroundColor: isDark ? '#334155' : '#E8EDF5' }]} />

          <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: '#F59E0B15' }]}>
              <Ionicons name="hourglass-outline" size={16} color="#F59E0B" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{remainingHours}h</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Remaining</Text>
            </View>
          </View>

          <View style={[styles.statDivider, { backgroundColor: isDark ? '#334155' : '#E8EDF5' }]} />

          <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: '#10B98115' }]}>
              <Ionicons name="business-outline" size={16} color="#10B981" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{currentCompany}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Current Company</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  gradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  percentage: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  progressBarContainer: {
    marginBottom: 18,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
});