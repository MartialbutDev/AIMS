// src/components/settings/ThemeToggle.tsx
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";

export default function ThemeToggle() {
  const { mode, toggleTheme, colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card }]}
      onPress={toggleTheme}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}10` }]}>
            <Ionicons 
              name={isDark ? "moon-outline" : "sunny-outline"} 
              size={22} 
              color={colors.primary} 
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Dark Mode
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {isDark ? "Enabled" : "Disabled"}
            </Text>
          </View>
        </View>
        
        {/* ✅ Only the track and thumb should animate, not the whole section */}
        <View style={styles.toggleContainer}>
          <MotiView
            style={[styles.toggleTrack, { backgroundColor: isDark ? colors.primary : colors.border }]}
          >
            <MotiView
              animate={{
                translateX: isDark ? 18 : 0,
              }}
              transition={{ type: "spring", damping: 15 }}
              style={[styles.toggleThumb, { backgroundColor: colors.card }]}
            />
          </MotiView>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  toggleContainer: {
    width: 44,
    height: 26,
    justifyContent: 'center',
    marginLeft: 8,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});