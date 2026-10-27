// src/components/dashboard/HeroCard.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../../context/ThemeContext";

interface HeroCardProps {
  greeting: string;
  userName: string;
  userAvatar?: string | null;
  currentDate: string;
  notificationCount: number;
  onNotificationPress: () => void;
  onProfilePress: () => void;
}

export default function HeroCard({
  greeting,
  userName,
  userAvatar,
  currentDate,
  notificationCount,
  onNotificationPress,
  onProfilePress,
}: HeroCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 600 }}
      style={[styles.container, isDark && { borderWidth: 1, borderColor: colors.border }]}
    >
      {/* Background photo */}
      <ImageBackground
        source={require("../../../assets/images/hero-background.jpg")}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Dark gradient overlay for text readability */}
        <LinearGradient
          colors={isDark ? ["rgba(11, 11, 47, 0.90)", "rgba(22, 27, 59, 0.84)", "rgba(11, 13, 27, 0.96)"] : [
            "rgba(15, 23, 42, 0.75)",   // slate-900/75 at top
            "rgba(30, 64, 175, 0.65)",   // blue-900/65 in middle
            "rgba(15, 23, 42, 0.85)",    // slate-900/85 at bottom
          ]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradientOverlay}
        >
          {/* Subtle decorative circles */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          <View style={styles.decorativeCircle3} />

          <View style={styles.content}>
            {/* ---- header ---- */}
            <View style={styles.header}>
              <View style={styles.greetingContainer}>
                <Text style={styles.greeting}>{greeting},</Text>
                <Text style={styles.userName} numberOfLines={1}>
                  {userName}
                </Text>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.notificationButton}
                  onPress={onNotificationPress}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={22}
                    color="#FFFFFF"
                  />
                  {notificationCount > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>
                        {notificationCount > 9 ? "9+" : notificationCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={onProfilePress}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    {userAvatar ? (
                      <Image
                        source={{ uri: userAvatar }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Text style={styles.avatarText}>
                        {userName.charAt(0)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* ---- footer ---- */}
            <View style={styles.footer}>
              <View style={styles.dateBadge}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color="rgba(255,255,255,0.9)"
                />
                <Text style={styles.dateText}>{currentDate}</Text>
              </View>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>In Progress</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#1E40AF",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    // Needed so the child ImageBackground respects the parent's radius on Android
    backgroundColor: "#0F172A",
  },
  backgroundImage: {
    width: "100%",
    minHeight: 180,
  },
  gradientOverlay: {
    padding: 24,
    paddingTop: 20,
    paddingBottom: 18,
    minHeight: 180,
    justifyContent: "space-between",
  },

  // Subtle accent circles on top of the image
  decorativeCircle1: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  decorativeCircle2: {
    position: "absolute",
    bottom: -60,
    left: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  decorativeCircle3: {
    position: "absolute",
    top: 20,
    right: 80,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  content: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greetingContainer: {
    flex: 1,
    marginRight: 12,
  },
  greeting: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.2,
    // Helps legibility over busy backgrounds
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  userName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginTop: -2,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationButton: {
    position: "relative",
    width: 40,
    height: 40,
    borderRadius: 20,
    // Slightly stronger glass effect now that it's over a photo
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#1E40AF",
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 4,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E40AF",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  dateText: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.9)",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16,185,129,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.35)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#A7F3D0",
    letterSpacing: 0.3,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});