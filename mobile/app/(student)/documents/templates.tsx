import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { useTheme } from '../../../src/context/ThemeContext'
import { documentTemplateService } from '../../../src/services/documentTemplate.service'
import type { OfficialForm, OfficialFormLibrary } from '../../../src/services/documentTemplate.service'

const deadlineLabel = (value: string) => new Date(`${value}T12:00:00+08:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
export default function OfficialFormsScreen() {
  const { colors, isDark } = useTheme()
  const [library, setLibrary] = useState<OfficialFormLibrary | null>(null), [error, setError] = useState('')
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [downloading, setDownloading] = useState<string | null>(null)
  useFocusEffect(useCallback(() => {
    let active = true
    documentTemplateService.getLibrary().then(data => { if (active) { setLibrary(data); setError('') } }).catch(e => { if (active) setError(e.response?.data?.detail || 'Could not load approved forms. Try again.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, []))
  async function refresh() {
    setRefreshing(true)
    try { setLibrary(await documentTemplateService.getLibrary()); setError('') }
    catch (e: any) { setError(e.response?.data?.detail || 'Could not refresh approved forms.') }
    finally { setRefreshing(false) }
  }
  async function download(form: OfficialForm) {
    if (downloading) return
    setDownloading(form.id)
    try { await documentTemplateService.download(form) }
    catch (e) { Alert.alert('Form download', e instanceof Error ? e.message : 'Please try again.') }
    finally { setDownloading(null) }
  }
  const message = library?.assignment_status === 'unassigned' ? 'Your coordinator assignment is not available for this term yet. Your forms will appear after assignment.' : library?.assignment_status === 'coordinator_inactive' ? 'Your coordinator’s active designation needs confirmation. Contact your internship office for the correct forms.' : 'Your coordinator has not published any forms for this term yet.'
  return <View style={[styles.screen, { backgroundColor: colors.background }]}><StatusBar style={isDark ? 'light' : 'dark'} /><View style={styles.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to documents" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity><Text style={[styles.heading, { color: colors.textPrimary }]}>Approved CITC forms</Text></View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={[styles.hero, isDark && { backgroundColor: colors.gradientStart, borderWidth: 1, borderColor: colors.border, borderTopColor: colors.accent }]}><Ionicons name="documents-outline" size={30} color="#ffc629" /><Text style={styles.heroTitle}>Start with the right form.</Text><Text style={styles.heroText}>Download the current approved version, read the instructions, and prepare your requirements.</Text>{library && <Text style={styles.term}>{library.academic_year} · Semester {library.semester}</Text>}</View>
      {!!error && <View style={[styles.card, { backgroundColor: colors.card, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}><Text accessibilityRole="alert" style={{ color: isDark ? '#ffb9be' : '#a82b39' }}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={refresh}><Text style={[styles.retry, { color: colors.accent }]}>Retry</Text></TouchableOpacity></View>}
      {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 25 }} /> : !library?.items.length ? <View style={[styles.card, { backgroundColor: colors.card, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}><Text style={[styles.title, { color: colors.textPrimary }]}>No published forms yet</Text><Text style={[styles.body, { color: colors.textSecondary }]}>{message}</Text></View> : library.items.map(form => <View style={[styles.card, { backgroundColor: colors.card, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]} key={form.id}><View style={styles.cardTop}><Text style={[styles.category, { color: colors.textSecondary }]}>{form.document_type.replace(/_/g, ' ').toUpperCase()}</Text><Text style={[styles.version, isDark && { backgroundColor: colors.accentMuted, color: colors.accent }]}>v{form.version}</Text></View><Text style={[styles.title, { color: colors.textPrimary }]}>{form.title}</Text><Text style={[styles.fileInfo, { color: colors.textSecondary }]}>{form.mime_type === 'application/pdf' ? 'PDF' : 'DOCX'} · {(form.file_size / 1024).toFixed(0)} KB</Text><Text style={[styles.label, { color: colors.textSecondary }]}>SUBMISSION DEADLINE</Text><Text style={[styles.deadline, { color: colors.textPrimary }]}>{form.deadline ? deadlineLabel(form.deadline) : 'No deadline set'}</Text><Text style={[styles.label, { color: colors.textSecondary }]}>INSTRUCTIONS</Text><Text style={[styles.body, { color: colors.textPrimary }]} selectable>{form.instructions}</Text><Text style={[styles.label, { color: colors.textSecondary }]}>APPROVAL REFERENCE</Text><Text style={[styles.body, { color: colors.textSecondary }]} selectable>{form.approval_reference}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Download ${form.title}, version ${form.version}`} disabled={!!downloading} onPress={() => download(form)} style={[styles.download, { backgroundColor: isDark ? colors.accent : "#0b0b2f", opacity: downloading && downloading !== form.id ? .5 : 1 }]}>{downloading === form.id ? <ActivityIndicator color={isDark ? colors.onAccent : "#ffc629"} size="small" /> : <Ionicons name="download-outline" size={20} color={isDark ? colors.onAccent : "#ffc629"} />}<Text style={[styles.downloadText, isDark && { color: colors.onAccent }]}>{downloading === form.id ? 'Downloading…' : 'Download · Open or save'}</Text></TouchableOpacity></View>)}
      <Text style={[styles.note, { color: colors.textSecondary }]}>Downloads are blank forms. Follow your coordinator’s instructions for signatures and submission. Deadlines are Philippine dates.</Text>
    </ScrollView></View>
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, back: { padding: 5 }, heading: { fontSize: 19, fontWeight: '700', flex: 1 }, content: { paddingHorizontal: 20, paddingBottom: 35, gap: 16 },
  hero: { backgroundColor: '#0b0b2f', borderRadius: 18, padding: 23, borderTopWidth: 3, borderTopColor: '#ffc629' }, heroTitle: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 15 }, heroText: { color: '#d4d4e7', lineHeight: 22, fontSize: 13, marginTop: 10 }, term: { color: '#ffc629', fontSize: 11, marginTop: 18 },
  card: { padding: 20, borderRadius: 16, gap: 8 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, category: { fontSize: 10, letterSpacing: 1, flex: 1 }, version: { backgroundColor: '#fff1ba', color: '#5c4600', fontSize: 11, padding: 7, borderRadius: 5, maxWidth: '50%' }, title: { fontWeight: '700', fontSize: 19, marginTop: 6 }, body: { fontSize: 13, lineHeight: 22 }, fileInfo: { fontSize: 11 }, label: { fontSize: 9, letterSpacing: 1, fontWeight: '600', marginTop: 14 }, deadline: { fontSize: 14, fontWeight: '600' }, download: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 15, padding: 15, backgroundColor: '#0b0b2f', borderRadius: 9 }, downloadText: { color: '#fff', fontSize: 12, fontWeight: '700' }, note: { fontSize: 11, lineHeight: 19, textAlign: 'center', padding: 8 }, retry: { fontWeight: '700', marginTop: 12 },
})
