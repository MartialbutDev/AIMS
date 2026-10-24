import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../../src/context/ThemeContext";
import { deploymentService } from "../../../src/services/deployment.service";
import type { InternshipDeployment } from "../../../src/services/deployment.service";

const STATUS_LABELS = {
  PRE_DEPLOYMENT: "Pre-deployment",
  DEPLOYED: "Deployed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function displayDate(value: string): string {
  // Parse date-only values locally so they do not shift to the previous day.
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

export default function PreDeploymentScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = isDark ? "#FCBA04" : colors.primary;
  const [deployment, setDeployment] = useState<InternshipDeployment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const requestRef = useRef(0);
  const focusedRef = useRef(false);

  const load = useCallback(async (refresh = false) => {
    const request = ++requestRef.current;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const result = await deploymentService.getMyDeployment();
      if (focusedRef.current && request === requestRef.current) setDeployment(result);
    } catch {
      if (focusedRef.current && request === requestRef.current) setError(true);
    } finally {
      if (focusedRef.current && request === requestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    void load();
    return () => {
      focusedRef.current = false;
      requestRef.current += 1;
    };
  }, [load]));

  const checklist = deployment?.checklist;
  const items = checklist?.items ?? [];
  const verified = items.filter(item => item.status === "verified").length;
  const canUpload = deployment?.status === "PRE_DEPLOYMENT";
  const ready = checklist?.ready_for_deployment === true;
  const message = !deployment
    ? "Your pre-deployment checklist will appear after your internship application is accepted."
    : deployment.status === "DEPLOYED"
      ? "Your coordinator has confirmed your deployment. You can now submit DTR and journals."
      : deployment.status === "COMPLETED"
        ? "Your internship is completed. You can view your existing DTR and journals."
        : deployment.status === "CANCELLED"
          ? "This deployment has been cancelled. Contact your coordinator for the next steps."
          : ready
            ? "All required documents are verified. Awaiting coordinator confirmation."
            : "Submit your required documents for verification. Your coordinator will confirm your official deployment once all requirements are verified.";

  const button = (label: string, onPress: () => void, primary = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.button, { backgroundColor: primary ? accent : colors.surfaceSecondary }]}
    >
      <Text style={[styles.buttonText, { color: primary ? (isDark ? "#0F172A" : "#FFFFFF") : colors.textPrimary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button" accessibilityLabel="Back to dashboard"
          hitSlop={12} onPress={() => router.canGoBack() ? router.back() : router.replace("/(student)/dashboard")}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Pre-deployment</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={{ color: colors.textSecondary }}>Loading your requirements…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={accent} colors={[accent]} />}
        >
          {error ? (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>Unable to load deployment</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>Please check your connection and try again. Your deployment status could not be verified.</Text>
              {button("Try again", () => void load(), true)}
            </View>
          ) : (
            <>
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <Ionicons name={ready ? "checkmark-circle-outline" : "clipboard-outline"} size={32} color={accent} />
                <Text style={[styles.heading, { color: colors.textPrimary }]}>{deployment ? STATUS_LABELS[deployment.status] : "No deployment yet"}</Text>
                {deployment?.company_name && <Text style={[styles.company, { color: colors.textPrimary }]}>{deployment.company_name}</Text>}
                {deployment && <Text style={[styles.body, { color: colors.textSecondary }]}>Academic Year {deployment.academic_year} · Semester {deployment.semester}</Text>}
                <Text style={[styles.body, { color: colors.textSecondary }]}>{message}</Text>
                {deployment?.deployment_date && <Text style={[styles.body, { color: colors.textPrimary }]}>Deployment Date: {displayDate(deployment.deployment_date)}</Text>}
                {!deployment && button("View applications", () => router.push("/(student)/applications"), true)}
              </View>

              {deployment && (
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                  <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>Document requirements</Text>
                  {checklist && items.length > 0 ? (
                    <>
                      <Text style={[styles.body, { color: colors.textSecondary }]}>{verified} of {items.length} documents verified</Text>
                      {items.map(item => {
                        const status = item.status;
                        const color = status === "verified" ? colors.success : status === "rejected" ? colors.error : colors.warning;
                        const label = status === "verified" ? "Verified" : status === "rejected" ? "Rejected" : status === "missing" ? "Missing" : "Pending";
                        return (
                          <View key={item.document_type} style={[styles.requirement, { borderTopColor: colors.border }]}>
                            <Ionicons name={status === "verified" ? "checkmark-circle-outline" : status === "rejected" ? "close-circle-outline" : "time-outline"} size={22} color={color} />
                            <View style={styles.requirementText}>
                              <Text style={[styles.company, { color: colors.textPrimary }]}>{item.label}</Text>
                              <Text style={[styles.body, { color }]}>{label}{item.required ? " · Required" : ""}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  ) : <Text style={[styles.body, { color: colors.textSecondary }]}>The document checklist is unavailable. Refresh to try again or contact your coordinator.</Text>}
                  {canUpload && button("Upload a document", () => router.push("/(student)/documents/upload"), true)}
                  {canUpload && <Text style={[styles.body, { color: colors.textSecondary }]}>Choose the matching document type on the upload screen. Replace rejected requirements by uploading a corrected document.</Text>}
                  {button("Manage documents", () => router.push("/(student)/documents"))}
                </View>
              )}

              {(deployment?.status === "DEPLOYED" || deployment?.status === "COMPLETED") && (
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                  {button("View DTR records", () => router.push("/(student)/dtr"))}
                  {button("View journals", () => router.push("/(student)/journals"))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, padding: 20 },
  title: { fontSize: 22, fontWeight: "700", flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  content: { paddingHorizontal: 20, gap: 16 },
  card: { borderRadius: 20, padding: 20, gap: 12 },
  heading: { fontSize: 18, fontWeight: "700" },
  company: { fontSize: 15, fontWeight: "600" },
  body: { fontSize: 14, lineHeight: 21 },
  requirement: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, paddingTop: 14 },
  requirementText: { flex: 1, gap: 4 },
  button: { minHeight: 48, borderRadius: 12, padding: 14, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 14, fontWeight: "700", textAlign: "center" },
});
