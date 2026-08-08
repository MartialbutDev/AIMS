// src/components/dashboard/DeadlineItem.tsx
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../context/ThemeContext";

interface DeadlineItemProps {
  title: string;
  date: string;
  priority: "High" | "Medium" | "Low";
  index: number;
  isLast: boolean;
}

export default function DeadlineItem({
  title,
  date,
  priority,
  index,
  isLast,
}: DeadlineItemProps) {
  const { colors } = useTheme();

  const getPriorityColor = () => {
    switch (priority) {
      case "High":
        return colors.error;
      case "Medium":
        return colors.warning;
      case "Low":
        return colors.textSecondary;
    }
  };

  const getPriorityIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (priority) {
      case "High":
        return "alert-circle";
      case "Medium":
        return "time-outline";
      case "Low":
        return "hourglass-outline";
    }
  };

  const priorityColor = getPriorityColor();

  return (
    <MotiView
      from={{ opacity: 0, translateX: -10 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: "spring", delay: index * 50 }}
    >
      <View style={styles.container}>
        <View style={styles.leftSection}>
          <View style={[styles.iconContainer, { backgroundColor: `${priorityColor}15` }]}>
            <Ionicons name={getPriorityIcon()} size={18} color={priorityColor} />
          </View>
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>{date}</Text>
          </View>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}15` }]}>
          <Text style={[styles.priorityText, { color: priorityColor }]}>
            {priority}
          </Text>
        </View>
      </View>
      {!isLast && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    marginTop: 1,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    marginLeft: 48,
  },
});