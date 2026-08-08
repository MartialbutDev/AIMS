// src/components/dashboard/StatisticCard.tsx
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "../../context/ThemeContext";

interface StatisticCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  color: string;
  subtitle?: string;
  onPress?: () => void;
}

export default function StatisticCard({
  icon,
  value,
  label,
  color,
  subtitle = "Last updated today",
  onPress,
}: StatisticCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <MotiView
      from={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", delay: 100 }}
      style={styles.container}
    >
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[
          styles.iconContainer,
          {
            backgroundColor: `${color}15`,  // ← Solid background with color
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
            borderWidth: 1,
          }
        ]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        <View style={[styles.accentBar, { backgroundColor: color }]} />
      </TouchableOpacity>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    paddingBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 100,
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
  },
  value: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 10,
    opacity: 0.5,
    marginTop: 2,
  },
  accentBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});