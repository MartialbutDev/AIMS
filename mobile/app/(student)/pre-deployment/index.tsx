import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../../src/context/ThemeContext";
import { deploymentService } from "../../../src/services/deployment.service";
import type { InternshipDeployment } from "../../../src/services/deployment.service";

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
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.2;
  const gold = "#FFC629";
  const accent = isDark ? colors.accent : colors.primary;
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
  const requiredItems = items.filter(item => item.required);
  const verified = requiredItems.filter(item => item.status === "verified").length;
  const progress = requiredItems.length ? verified / requiredItems.length : 0;
  const nextDocument = items.find(item => item.required && (item.status === "missing" || item.status === "rejected"));
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

  const upload = (documentType: string) => router.push({
    pathname: "/(student)/documents/upload", params: { type: documentType },
  });
  const title = !deployment ? "Awaiting your placement"
    : deployment.status === "DEPLOYED" ? "Deployment confirmed"
    : deployment.status === "COMPLETED" ? "Internship completed"
    : deployment.status === "CANCELLED" ? "Deployment cancelled"
    : ready ? "Ready for coordinator review" : "Prepare for deployment";

  const button = (label: string, onPress: () => void, primary = false, accessibilityLabel?: string) => (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel || label}
      onPress={onPress} activeOpacity={0.8}
      style={[styles.button, { backgroundColor: primary ? gold : colors.surfaceSecondary,
        borderColor: primary ? gold : colors.border }]}>
      <Text style={[styles.buttonText, { color: primary ? "#0B0B2F" : colors.accent }]}>{label}</Text>
      <Ionicons name="arrow-forward" size={18} color={primary ? "#0B0B2F" : colors.accent} />
    </TouchableOpacity>
  );

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back"
        onPress={() => router.canGoBack() ? router.back() : router.replace("/(student)/dashboard")}
        style={[styles.headerButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Pre-deployment</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh deployment requirements"
        disabled={loading || refreshing} onPress={() => void load(true)}
        style={[styles.headerButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {refreshing ? <ActivityIndicator size="small" color={accent} /> : <Ionicons name="refresh-outline" size={20} color={accent} />}
      </TouchableOpacity>
    </View>
    {loading ? <View style={styles.center}>
      <ActivityIndicator size="large" color={accent} />
      <Text style={[styles.body, { color: colors.textSecondary }]}>Loading your requirements…</Text>
    </View> : <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, compact && styles.compactContent, { paddingBottom: insets.bottom + 28 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={accent} colors={[accent]} />}>
      {error ? <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}><Ionicons name="cloud-offline-outline" size={28} color={colors.error} /></View>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>Unable to load deployment</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>Please check your connection and try again. Your deployment status could not be verified.</Text>
        {button("Try again", () => void load(), true)}
      </View> : <>
        <View style={[styles.hero, { backgroundColor: isDark ? "#202640" : "#0B0B2F" }, compact && styles.compactHero]}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><Ionicons name={deployment?.status === "DEPLOYED" || deployment?.status === "COMPLETED" ? "checkmark-done-outline" : "clipboard-outline"} size={23} color={gold} /></View>
            <Text style={styles.eyebrow}>{deployment?.status === "PRE_DEPLOYMENT" ? "BEFORE YOU START" : "YOUR INTERNSHIP"}</Text>
          </View>
          <Text accessibilityRole="header" style={[styles.heroTitle, compact && styles.compactHeroTitle]}>{title}</Text>
          {deployment?.company_name && <Text style={styles.heroCompany}>{deployment.company_name}</Text>}
          {deployment && <View style={styles.metaRow}><Ionicons name="calendar-outline" size={15} color="#CED5E9" /><Text style={styles.metaText}>AY {deployment.academic_year} · Semester {deployment.semester}</Text></View>}
          <Text style={styles.heroBody}>{message}</Text>
          {!deployment && button("View applications", () => router.push("/(student)/applications"), true)}
          {canUpload && nextDocument && button(`${nextDocument.status === "rejected" ? "Correct" : "Upload"} ${nextDocument.label}`, () => upload(nextDocument.document_type), true)}
          {deployment?.deployment_date && <View style={styles.dateRow}><Ionicons name="calendar-number-outline" size={18} color={gold} /><Text style={styles.dateText}>Deployment date · {displayDate(deployment.deployment_date)}</Text></View>}
        </View>

        {deployment && <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeading}>
              <View style={styles.flex}><Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>Your requirements</Text><Text style={[styles.caption, { color: colors.textSecondary }]}>Complete each required document below.</Text></View>
              {requiredItems.length > 0 && <View style={[styles.countBadge, { backgroundColor: colors.accentMuted }]}><Text style={[styles.count, { color: accent }]}>{verified}<Text style={[styles.countTotal, { color: colors.textSecondary }]}> / {requiredItems.length}</Text></Text></View>}
            </View>
            {checklist && items.length > 0 ? <>
              {requiredItems.length > 0 && <View accessibilityRole="progressbar" accessibilityLabel="Required documents verified" accessibilityValue={{ min: 0, max: requiredItems.length, now: verified, text: `${verified} of ${requiredItems.length} required documents verified` }} style={[styles.track, { backgroundColor: colors.border }]}><View style={[styles.fill, { backgroundColor: accent, width: `${Math.round(progress * 100)}%` }]} /></View>}
              <View style={styles.requirementList}>
                {items.map(item => {
                  const verifiedDocument = item.status === "verified";
                  const rejectedDocument = item.status === "rejected";
                  const missing = item.status === "missing";
                  const color = verifiedDocument ? (isDark ? colors.success : "#147D58") : rejectedDocument ? (isDark ? colors.error : "#B42338") : missing ? colors.textSecondary : (isDark ? colors.warning : "#946000");
                  const label = verifiedDocument ? "Verified" : rejectedDocument ? "Needs correction" : missing ? "Upload needed" : "Awaiting review";
                  return <View key={item.document_type} style={[styles.requirement, { borderColor: colors.border }]}>
                    <View style={styles.requirementHeading}>
                      <View style={[styles.documentIcon, { backgroundColor: colors.surfaceSecondary }]}><Ionicons name={verifiedDocument ? "checkmark-circle-outline" : rejectedDocument ? "alert-circle-outline" : missing ? "cloud-upload-outline" : "time-outline"} size={23} color={color} /></View>
                      <View style={styles.flex}><Text style={[styles.documentTitle, { color: colors.textPrimary }]}>{item.label}</Text><Text style={[styles.documentMeta, { color: colors.textSecondary }]}>{item.required ? "Required document" : "Optional document"}</Text></View>
                    </View>
                    <View style={styles.statusRow}><View style={[styles.statusDot, { backgroundColor: color }]} /><Text style={[styles.statusText, { color }]}>{label}</Text></View>
                    {canUpload && (missing || rejectedDocument) && button(rejectedDocument ? "Upload correction" : "Upload document", () => upload(item.document_type), false, `Upload ${item.label}`)}
                    {item.document_id && button("View document", () => router.push({ pathname: "/(student)/documents/[id]", params: { id: item.document_id! } }), false, `View ${item.label}`)}
                  </View>;
                })}
              </View>
            </> : <View style={[styles.notice, { backgroundColor: colors.surfaceSecondary }]}><Ionicons name="information-circle-outline" size={21} color={accent} /><Text style={[styles.body, styles.flex, { color: colors.textSecondary }]}>The document checklist is unavailable. Refresh to try again or contact your coordinator.</Text></View>}
          </View>

          {canUpload && <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={[styles.documentIcon, { backgroundColor: colors.accentMuted }]}><Ionicons name="shield-checkmark-outline" size={23} color={accent} /></View>
            <View style={[styles.flex, { gap: 5 }]}><Text style={[styles.documentTitle, { color: colors.textPrimary }]}>{ready ? "Waiting for coordinator approval" : "What happens next?"}</Text><Text style={[styles.body, { color: colors.textSecondary }]}>{ready ? "Your documents are verified. Your coordinator will check deployment eligibility and confirm your start date." : "Upload missing documents and correct returned requirements. Your coordinator reviews the documents and confirms deployment before attendance begins."}</Text></View>
          </View>}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.documentTitle, { color: colors.textPrimary }]}>Document library</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>View your uploaded files, review feedback, and manage document versions.</Text>
            {button("Manage documents", () => router.push("/(student)/documents"))}
          </View>
        </>}
        {(deployment?.status === "DEPLOYED" || deployment?.status === "COMPLETED") && <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>Internship records</Text>
          {button("View DTR records", () => router.push("/(student)/dtr"))}
          {button("View journals", () => router.push("/(student)/journals"))}
        </View>}
      </>}
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  headerButton: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", flex: 1, letterSpacing: -0.3 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  content: { paddingHorizontal: 20, gap: 18 },
  compactContent: { paddingHorizontal: 14 },
  hero: { borderRadius: 22, padding: 22, gap: 14 },
  compactHero: { padding: 18 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#303147", justifyContent: "center", alignItems: "center" },
  eyebrow: { color: "#FFC629", fontSize: 10, fontWeight: "700", letterSpacing: 1.2, flex: 1, lineHeight: 17 },
  heroTitle: { color: "#FFFFFF", fontSize: 27, lineHeight: 34, fontWeight: "700", letterSpacing: -0.7 },
  compactHeroTitle: { fontSize: 24, lineHeight: 31 },
  heroCompany: { color: "#FFFFFF", fontSize: 16, lineHeight: 23, fontWeight: "600" },
  heroBody: { color: "#CED5E9", fontSize: 14, lineHeight: 22 },
  metaRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  metaText: { color: "#CED5E9", fontSize: 12, lineHeight: 19, flex: 1 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: "#42475D", paddingTop: 14 },
  dateText: { color: "#FFFFFF", fontSize: 13, lineHeight: 20, flex: 1 },
  card: { borderRadius: 20, padding: 18, gap: 14, borderWidth: 1 },
  heading: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  caption: { fontSize: 12, lineHeight: 19, marginTop: 5 },
  countBadge: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
  count: { fontSize: 22, fontWeight: "700" },
  countTotal: { fontSize: 13, fontWeight: "500" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  requirementList: { gap: 12 },
  requirement: { borderWidth: 1, borderRadius: 15, padding: 14, gap: 12 },
  requirementHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  documentIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  documentTitle: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  documentMeta: { fontSize: 11, lineHeight: 17, marginTop: 3 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 19 },
  body: { fontSize: 13, lineHeight: 21 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 17, borderRadius: 17 },
  emptyIcon: { width: 54, height: 54, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  button: { minHeight: 48, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1 },
  buttonText: { fontSize: 13, lineHeight: 20, fontWeight: "700", flex: 1 },
  flex: { flex: 1, minWidth: 0 },
});
