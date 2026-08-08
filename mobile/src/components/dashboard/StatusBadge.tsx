// src/components/dashboard/StatusBadge.tsx
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../context/ThemeContext";

interface StatusBadgeProps {
  status: string;
  type?: "priority" | "status" | "progress";
}

export default function StatusBadge({ status, type = "status" }: StatusBadgeProps) {
  const { colors } = useTheme();

  const getColor = () => {
    if (type === "priority") {
      switch (status.toLowerCase()) {
        case "high":
          return "#EF4444";
        case "medium":
          return "#F59E0B";
        case "low":
          return "#6B7280";
        default:
          return "#6B7280";
      }
    }
    switch (status.toLowerCase()) {
      case "pending":
        return colors.pending;
      case "approved":
        return colors.approved;
      case "rejected":
        return colors.rejected;
      case "submitted":
        return colors.submitted;
      case "draft":
        return colors.draft;
      case "reviewing":
        return colors.reviewing;
      case "in progress":
        return colors.primary;
      default:
        return colors.textSecondary;
    }
  };

  const color = getColor();

  return (
    <View style={[styles.container, { backgroundColor: `${color}15` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});