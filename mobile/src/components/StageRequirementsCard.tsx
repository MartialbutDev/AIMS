import { useCallback, useState } from 'react'
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import api from '../services/api'
import { useTheme } from '../context/ThemeContext'
import { loadRequirementInput, requirementsForStage, type RequirementPlan } from '../utils/stageRequirements'

export function StageRequirementsCard() {
  const { colors, isDark } = useTheme()
  const { width, fontScale } = useWindowDimensions()
  const cardWidth = Math.max(0, Math.min(520, width - (width < 360 ? 32 : 40)))
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true)
  const [result, setResult] = useState<{ revision: number; plan: RequirementPlan | null; error: boolean } | null>(null)
  const plan = result?.plan || null, error = result?.revision === revision && result.error
  useFocusEffect(useCallback(() => {
    let active = true
    const controller = new AbortController()
    setLoading(true)
    loadRequirementInput(<T,>(path: string) => api.get<T>(path, { signal: controller.signal, timeout: 15000 }).then(result => result.data))
      .then(input => { if (active) setResult({ revision, plan: requirementsForStage(input), error: false }) })
      .catch(() => { if (active) setResult({ revision, plan: null, error: true }) })
      .finally(() => { if (active) setLoading(false) })
    const timer = setInterval(() => { if (AppState.currentState === 'active') setRevision(value => value + 1) }, 60000)
    const listener = AppState.addEventListener('change', state => { if (state === 'active') setRevision(value => value + 1) })
    return () => { active = false; controller.abort(); clearInterval(timer); listener.remove() }
  }, [revision]))
  function open() {
    if (!plan) return
    const action = plan.action
    if (action.path === 'documents' && action.type) return router.push({ pathname: '/(student)/documents/upload', params: { type: action.type } })
    if (action.path === 'applications' && action.applicationId) return router.push({ pathname: '/(student)/applications/[id]', params: { id: action.applicationId } })
    const routes = { onboarding: '/onboarding', documents: '/(student)/documents', companies: '/(student)/applications/new', applications: '/(student)/applications', 'direct-placements': '/(student)/applications/direct-placements', 'pre-deployment': '/(student)/pre-deployment', attendance: '/(student)/dtr', completion: '/(student)/completion' } as const
    const path = routes[action.path as keyof typeof routes]
    if (path) router.push(path)
  }
  return <View style={[styles.card, { width: cardWidth, padding: fontScale > 1.2 ? 14 : 18, backgroundColor: colors.card, borderColor: colors.border, borderTopColor: '#0B0B2F' }]}>
    {loading && !plan ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.textSecondary }}>Checking your requirements…</Text></View> : error ? <>
      <Text accessibilityRole="alert" style={{ color: colors.textPrimary, lineHeight: 22 }}>Your requirements could not be loaded.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => setRevision(value => value + 1)} style={styles.secondary}><Text style={{ color: colors.accent, fontWeight: '600' }}>Try again</Text></TouchableOpacity>
    </> : plan && <>
      <View style={styles.heading}><Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{plan.title}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh requirements" disabled={loading} onPress={() => setRevision(value => value + 1)} style={styles.refresh}><Text style={{ color: colors.accent, fontSize: 12 }}>Refresh</Text></TouchableOpacity></View>
      <Text style={[styles.note, { color: colors.textSecondary }]}>{plan.note}</Text>
      {plan.rows.map(row => <View key={row.key} style={[styles.row, { borderBottomColor: colors.border }]}><View style={styles.label}><Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14, lineHeight: 22 }}>{row.label}</Text>{row.note && <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 5 }}>{row.note}</Text>}</View><View style={[styles.badge, { backgroundColor: colors.surfaceSecondary }]}><Text style={{ fontSize: 12, lineHeight: 19, fontWeight: '600', color: ['Approved','Provided'].includes(row.status) ? isDark ? '#9DE1BF' : '#17633A' : ['Rejected','Needs attention'].includes(row.status) ? isDark ? '#FFB4B4' : '#9C2525' : colors.textSecondary }}>{row.status}</Text></View></View>)}
      <TouchableOpacity accessibilityRole="button" disabled={loading} accessibilityState={{ disabled: loading }} onPress={open} style={[styles.action, { backgroundColor: colors.primary }, isDark && { backgroundColor: Boolean(loading) ? colors.surfaceTertiary : colors.accent }]}><Text style={[styles.actionText, isDark && { color: (Boolean(loading) ? colors.textSecondary : colors.onAccent) }]}>{plan.action.label}</Text></TouchableOpacity>
    </>}
  </View>
}
const styles = StyleSheet.create({
  card: { alignSelf: 'center', shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2, padding: 18, borderRadius: 18, borderWidth: 1, borderTopWidth: 3, marginBottom: 20 },
  loading: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', minHeight: 60 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  title: { fontSize: 17, fontWeight: '700', lineHeight: 25, flexGrow: 1, flexBasis: 190 },
  refresh: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  note: { fontSize: 13, lineHeight: 21, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, borderBottomWidth: 1, paddingVertical: 14 },
  label: { flexGrow: 1, flexBasis: 150, minWidth: 0 },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, maxWidth: '100%' },
  action: { minHeight: 48, borderRadius: 10, padding: 14, marginTop: 18, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#FFFFFF', fontSize: 14, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  secondary: { minHeight: 44, justifyContent: 'center', marginTop: 10 },
})
