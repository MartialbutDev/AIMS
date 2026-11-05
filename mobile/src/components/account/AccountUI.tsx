import type { PropsWithChildren } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

type Icon = keyof typeof Ionicons.glyphMap;
export function AccountHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return <View style={ui.header}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={[ui.back, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
    </TouchableOpacity>
    <View style={{ flex: 1 }}><Text style={[ui.eyebrow, { color: colors.textSecondary }]}>AIMS · STUDENT</Text><Text accessibilityRole="header" style={[ui.headerTitle, { color: colors.textPrimary }]}>{title}</Text></View>
  </View>;
}
export function AccountPage({ title, children }: PropsWithChildren<{ title: string }>) {
  const { colors, isDark } = useTheme();
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <AccountHeader title={title} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={ui.page}>
        <View style={ui.pageInner}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function AccountHero({ icon, title, description, label = 'YOUR AIMS EXPERIENCE' }: { icon: Icon; title: string; description: string; label?: string }) {
  return <View style={ui.hero}>
    <View style={ui.heroTop}><Text style={ui.heroLabel}>{label}</Text><Ionicons name={icon} size={24} color="#FFC629" /></View>
    <Text style={ui.heroTitle}>{title}</Text><Text style={ui.heroDescription}>{description}</Text>
    <View style={ui.heroAccent} />
  </View>;
}
export function Panel({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return <View style={[ui.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>;
}
export function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  const { colors } = useTheme();
  return <View style={ui.sectionLabel}><Text accessibilityRole="header" style={[ui.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>{hint && <Text style={[ui.description, { color: colors.textSecondary }]}>{hint}</Text>}</View>;
}
export function MenuRow({ icon, title, detail, onPress, danger = false, disabled = false }: { icon: Icon; title: string; detail?: string; onPress?: () => void; danger?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  const body = <><View style={[ui.rowIcon, { backgroundColor: danger ? `${colors.error}12` : colors.accentMuted }]}><Ionicons name={icon} size={20} color={danger ? colors.error : colors.accent} /></View>
    <View style={{ flex: 1 }}><Text style={[ui.rowTitle, { color: danger ? colors.error : colors.textPrimary }]}>{title}</Text>{detail && <Text style={[ui.rowDetail, { color: colors.textSecondary }]}>{detail}</Text>}</View>
    {onPress && <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />}</>;
  return onPress ? <TouchableOpacity accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={[ui.row, { opacity: disabled ? .45 : 1 }]}>{body}</TouchableOpacity> : <View style={ui.row}>{body}</View>;
}
export function ActionButton({ title, onPress, busy = false, disabled = false, secondary = false, danger = false }: { title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; danger?: boolean }) {
  const { colors } = useTheme();
  const foreground = danger ? colors.error : secondary ? colors.accent : colors.onAccent;
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} onPress={onPress} disabled={disabled || busy} style={[ui.button, { backgroundColor: secondary || danger ? colors.card : colors.accent, borderColor: danger ? colors.error : secondary ? colors.border : colors.accent, opacity: disabled || busy ? .5 : 1 }]}>
    {busy && <ActivityIndicator color={foreground} size="small" />}<Text style={[ui.buttonText, { color: foreground }]}>{title}</Text>
  </TouchableOpacity>;
}
export const ui = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  back: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 9, letterSpacing: 1.8, fontWeight: '700', marginBottom: 4 },
  headerTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -.5 },
  page: { paddingHorizontal: 20, paddingBottom: 32 },
  pageInner: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 16 },
  hero: { backgroundColor: '#0b0b2f', borderRadius: 24, padding: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#303056' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  heroLabel: { flex: 1, color: '#FFD45E', fontSize: 10, fontWeight: '700', letterSpacing: 1.6, lineHeight: 16 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, fontWeight: '700', letterSpacing: -.7 },
  heroDescription: { color: '#D1D4E8', fontSize: 13, lineHeight: 21, marginTop: 9 },
  heroAccent: { backgroundColor: '#FFC629', width: 38, height: 3, borderRadius: 2, marginTop: 20 },
  panel: { padding: 18, borderRadius: 20, borderWidth: 1, gap: 12 },
  sectionLabel: { gap: 5, marginTop: 5 },
  sectionTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -.2 },
  description: { fontSize: 13, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, minHeight: 56 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  rowDetail: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  button: { borderRadius: 14, minHeight: 50, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 14, borderWidth: 1, minHeight: 52, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
});
