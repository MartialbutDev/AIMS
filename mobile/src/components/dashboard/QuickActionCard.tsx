// src/components/dashboard/QuickActionCard.tsx
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "../../context/ThemeContext";

interface QuickActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  color: string;
  onPress: () => void;
  fullWidth?: boolean;
}

export default function QuickActionCard({
  icon,
  label,
  subtitle,
  color,
  onPress,
  fullWidth = false,
}: QuickActionCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <MotiView
      from={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", delay: 100 }}
      style={[styles.container, fullWidth && styles.fullWidth]}
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
        <View style={styles.content}>
          <View style={[
            styles.iconContainer,
            {
              backgroundColor: `${color}15`,  // ← Same as StatisticCard
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
              borderWidth: 1,
            }
          ]}>
            <Ionicons name={icon} size={22} color={color} />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward-outline" size={18} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: '48%',
    maxWidth: '48%',
  },
  fullWidth: {
    minWidth: '100%',
    maxWidth: '100%',
  },
  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1,
    minHeight: 72,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    borderWidth: 1,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
});