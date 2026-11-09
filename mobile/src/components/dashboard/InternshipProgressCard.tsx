
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";

import { useTheme } from "../../context/ThemeContext";
import type { DeploymentStatus } from "../../services/deployment.service";



interface InternshipProgressCardProps {
  progress: number | null;
  hoursRendered: number;
  remainingHours: number | null;
  programNotice?: string | null;
  currentCompany: string;
  deploymentStatus?: DeploymentStatus | null;
  academicYear?: string | null;
  semester?: string | null;
  deploymentDate?: string | null;
  onViewCompletion?: () => void;
}

const STATUS_LABELS: Record<DeploymentStatus, string> = {
  PRE_DEPLOYMENT: "Pre-deployment",
  DEPLOYED: "Deployed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function InternshipProgressCard({
  progress,
  hoursRendered,
  remainingHours,
  programNotice,
  currentCompany,
  deploymentStatus,
  academicYear,
  semester,
  deploymentDate,
  onViewCompletion,
}: InternshipProgressCardProps) {
  const { colors, isDark } = useTheme();

  const accentColor = isDark
    ? colors.accent
    : colors.primary;

  const gradientColors = isDark
    ? ([colors.card, colors.surfaceSecondary] as const)
    : (["#FFFFFF", "#F8FAFC"] as const);

  const safeProgress = progress != null && Number.isFinite(progress)
    ? Math.max(0, Math.min(100, progress))
    : 0;

  const statusColor =
    deploymentStatus === "DEPLOYED"
      ? colors.approved
      : deploymentStatus === "COMPLETED"
        ? colors.info
        : deploymentStatus === "CANCELLED"
          ? colors.rejected
          : colors.pending;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "spring", delay: 150 }}
      style={styles.container}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, isDark && { borderWidth: 1, borderColor: colors.border }]}
      >
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { color: colors.textPrimary },
            ]}
          >
            Internship Progress
          </Text>

          <Text
            style={[
              styles.percentage,
              { color: accentColor },
            ]}
          >
            {progress == null ? "—" : `${Math.round(safeProgress)}%`}
          </Text>
        </View>

        {progress == null ? <Text style={{ color: colors.textSecondary, lineHeight: 21, marginBottom: 18 }}>Required hours awaiting configuration{programNotice ? `\n${programNotice}` : ''}</Text> : <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBarTrack,
              {
                backgroundColor: isDark
                  ? colors.border
                  : "#E8EDF5",
              },
            ]}
          >
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: `${safeProgress}%`,
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>
        </View>}

        <View
          style={[
            styles.statsContainer,
            {
              backgroundColor: isDark
                ? colors.surfaceSecondary
                : "#F8FAFC",
            },
          ]}
        >
          <View style={styles.statItem}>
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: `${accentColor}15` },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={16}
                color={accentColor}
              />
            </View>

            <View style={styles.statContent}>
              <Text
                style={[
                  styles.statValue,
                  { color: colors.textPrimary },
                ]}
              >
                {hoursRendered}h
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Hours Rendered
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.statDivider,
              {
                backgroundColor: isDark
                  ? colors.border
                  : "#E8EDF5",
              },
            ]}
          />

          <View style={styles.statItem}>
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: "#F59E0B15" },
              ]}
            >
              <Ionicons
                name="hourglass-outline"
                size={16}
                color="#F59E0B"
              />
            </View>

            <View style={styles.statContent}>
              <Text
                style={[
                  styles.statValue,
                  { color: colors.textPrimary },
                ]}
              >
                {remainingHours == null ? "—" : `${remainingHours}h`}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Remaining
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.statDivider,
              {
                backgroundColor: isDark
                  ? colors.border
                  : "#E8EDF5",
              },
            ]}
          />

          <View style={styles.statItem}>
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: "#10B98115" },
              ]}
            >
              <Ionicons
                name="business-outline"
                size={16}
                color="#10B981"
              />
            </View>

            <View style={styles.statContent}>
              <Text
                style={[
                  styles.statValue,
                  { color: colors.textPrimary },
                ]}
                numberOfLines={2}
              >
                {currentCompany}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Current Company
              </Text>
            </View>
          </View>
        </View>

        {deploymentStatus && (
          <View
            style={[
              styles.deploymentSection,
              {
                borderTopColor: isDark
                  ? colors.border
                  : "#E8EDF5",
              },
            ]}
          >
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusColor },
                ]}
              />

              <Text
                style={[
                  styles.statusText,
                  { color: colors.textPrimary },
                ]}
              >
                {STATUS_LABELS[deploymentStatus]}
              </Text>
            </View>

            {academicYear && (
              <Text
                style={[
                  styles.metaText,
                  { color: colors.textSecondary },
                ]}
              >
                Academic Year {academicYear}
                {semester ? ` • Semester ${semester}` : ""}
              </Text>
            )}

            {deploymentDate && (
              <Text
                style={[
                  styles.metaText,
                  { color: colors.textSecondary },
                ]}
              >
                Deployment Date: {deploymentDate}
              </Text>
            )}
          </View>
        )}
        {onViewCompletion && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="View internship completion and archive"
            onPress={onViewCompletion}
            activeOpacity={0.7}
            style={[styles.completionShortcut, { borderTopColor: colors.border }]}
          >
            <Ionicons name="ribbon-outline" size={18} color={accentColor} />
            <Text style={[styles.completionShortcutText, { color: accentColor }]}>
              View completion
            </Text>
            <Ionicons name="chevron-forward" size={16} color={accentColor} />
          </TouchableOpacity>
        )}
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
    borderColor: "rgba(0,0,0,0.03)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  percentage: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  progressBarContainer: {
    marginBottom: 18,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 14,
    padding: 12,
  },
  statItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  deploymentSection: {
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 14,
    gap: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
  },
  completionShortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 10,
  },
  completionShortcutText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  metaText: {
    fontSize: 12,
  },
});
