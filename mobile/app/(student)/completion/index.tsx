import { useCallback, useRef, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../src/context/ThemeContext'
import { completionService as service } from '../../../src/services/completion.service'
import type { CompletionList, CompletionRecord } from '../../../src/services/completion.service'

function message(error: unknown): string {
  const candidate = error as { response?: { data?: { detail?: unknown } }; message?: string }
  return typeof candidate?.response?.data?.detail === 'string' ? candidate.response.data.detail : candidate?.message || 'Could not load completion. Please try again.'
}
const human = (value: string) => value.replace(/_/g, ' ')
const timestamp = (value: string) => new Date(value.endsWith('Z') ? value : value + 'Z').toLocaleString()

export default function CompletionScreen() {
  const { colors } = useTheme()
  const [list, setList] = useState<CompletionList | null>(null)
  const [selected, setSelected] = useState<CompletionRecord | null>(null)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const selectedId = useRef<string | null>(null)
  const sequence = useRef(0)
  const active = useRef(false)
  const text = { color: colors.textPrimary }
  const muted = { color: colors.textSecondary }
  const card = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }]

  const load = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true); setError('')
    try {
      const result = await service.list(page, filter)
      const id = selectedId.current ?? result.items[0]?.deployment_id
      const detail = id ? await service.detail(id) : null
      if (!active.current || request !== sequence.current) return
      setList(result); setSelected(detail); selectedId.current = detail?.deployment_id ?? null
    } catch (e) { if (active.current && request === sequence.current) setError(message(e)) }
    finally { if (active.current && request === sequence.current) setLoading(false) }
  }, [page, filter])

  useFocusEffect(useCallback(() => {
    active.current = true; void load()
    return () => { active.current = false; ++sequence.current }
  }, [load]))

  async function select(id: string) {
    if (busy) return
    const request = ++sequence.current
    selectedId.current = id; setLoading(true); setError(''); setSelected(null); setNote('')
    try { const detail = await service.detail(id); if (active.current && request === sequence.current) setSelected(detail) }
    catch (e) { if (active.current && request === sequence.current) setError(message(e)) }
    finally { if (active.current && request === sequence.current) setLoading(false) }
  }

  async function sendRequest() {
    if (!selected || busy) return
    setBusy(true); setError('')
    try {
      const result = await service.request(selected.deployment_id, selected.version, note.trim())
      if (!active.current) return
      setSelected(result); setNote(''); Alert.alert('Request submitted', 'Your company supervisor can now confirm your internship completion. Your coordinator makes the final decision.')
      void load()
    } catch (e) { if (active.current) setError(message(e)) }
    finally { if (active.current) setBusy(false) }
  }

  async function certificate(kind?: 'journals' | 'documents', recordId?: string, extension?: string) {
    if (!selected || busy) return
    setBusy(true); setError('')
    try { await service.certificate(selected.deployment_id, kind, recordId, extension) }
    catch (e) { if (active.current) setError(message(e)) }
    finally { if (active.current) setBusy(false) }
  }

  return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
    <View style={styles.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity><View><Text style={[styles.kicker, { color: colors.accent }]}>CITC · INTERNSHIP JOURNEY</Text><Text style={[styles.title, text]}>Completion & archive</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { if (!busy) void load() }} tintColor={colors.accent} />} keyboardShouldPersistTaps="handled">
      <Text style={[styles.paragraph, muted]}>Request completion after your requirements are reviewed. Company confirmation comes next, followed by your coordinator’s approval and grade release.</Text>
      <View style={styles.filters}>{['all', 'active', 'completed'].map(value => <TouchableOpacity key={value} accessibilityRole="button" disabled={busy} onPress={() => { if (value === filter) return; selectedId.current = null; setSelected(null); setFilter(value); setPage(1) }} style={[styles.filter, { backgroundColor: filter === value ? colors.accent : colors.card }]}><Text style={{ color: filter === value ? colors.onAccent : colors.textPrimary }}>{value === 'completed' ? 'Archive' : human(value)}</Text></TouchableOpacity>)}</View>
      {!!error && <View style={card}><Text accessibilityRole="alert" style={{ color: colors.rejected }}>{error}</Text><TouchableOpacity disabled={busy} onPress={() => void load()} style={styles.back}><Text style={{ color: colors.accent }}>Refresh records</Text></TouchableOpacity></View>}
      {!loading && !list?.items.length && <View style={card}><Text style={text}>No confirmed internships in this view.</Text></View>}
      {list?.items.map(record => <TouchableOpacity accessibilityRole="button" key={record.deployment_id} disabled={busy || loading} onPress={() => void select(record.deployment_id)} style={[...card, selected?.deployment_id === record.deployment_id && { borderColor: colors.accent }]}><Text style={[styles.subtitle, text]}>{record.company_name}</Text><Text style={muted}>AY {record.academic_year} · Semester {record.semester}</Text><Text style={[styles.badge, { color: colors.accent }]}>{human(record.status)}</Text></TouchableOpacity>)}
      {list && list.total > list.limit && <View style={styles.pagination}><TouchableOpacity disabled={page <= 1 || busy || loading} onPress={() => { selectedId.current = null; setPage(p => p - 1) }}><Text style={text}>Previous</Text></TouchableOpacity><Text style={muted}>{page} / {Math.ceil(list.total / list.limit)}</Text><TouchableOpacity disabled={page * list.limit >= list.total || busy || loading} onPress={() => { selectedId.current = null; setPage(p => p + 1) }}><Text style={text}>Next</Text></TouchableOpacity></View>}
      {loading && <ActivityIndicator color={colors.accent} />}
      {selected && !loading && <>
        <View style={card}><Text style={[styles.subtitle, text]}>{selected.checklist?.label}</Text><Text style={[styles.hours, text]}>{selected.checklist?.approved_hours} / {selected.checklist?.required_hours} hours</Text><Text style={muted}>{selected.checklist?.dtr_count} DTR · {selected.checklist?.journal_count} journals</Text>{selected.checklist?.items.map(item => <View style={[styles.check, { borderColor: colors.border }]} key={item.key}><Ionicons name={item.met ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={item.met ? colors.approved : colors.textTertiary} /><Text style={[styles.checkText, text]}>{item.label}</Text></View>)}
          {selected.status === 'completed' && <Text style={[styles.paragraph, { color: colors.approved }]}>Your internship is officially completed. Your DTR, journals and documents are read-only.</Text>}
          {selected.status === 'completed_legacy' && <Text style={[styles.paragraph, muted]}>This is an older completed internship. No completion decision or final grade has been inferred.</Text>}
        </View>
        {selected.can_write && ['not_requested', 'returned'].includes(selected.status) && <View style={card}><Text style={[styles.subtitle, text]}>Request internship completion</Text><Text style={[styles.paragraph, muted]}>All checklist items except company confirmation must be satisfied before submitting.</Text><TextInput accessibilityLabel="Completion request note" multiline maxLength={2000} editable={!busy} value={note} onChangeText={setNote} placeholder="Optional note for your company and coordinator" placeholderTextColor={colors.textTertiary} style={[styles.input, text, { backgroundColor: colors.inputBackground, borderColor: colors.border }]} /><TouchableOpacity accessibilityRole="button" disabled={busy || !selected.checklist?.ready_to_request} onPress={() => Alert.alert('Submit completion request?', 'Your company supervisor and coordinator will review the request.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Submit', onPress: () => void sendRequest() }])} style={[styles.button, { backgroundColor: colors.accent, opacity: busy || !selected.checklist?.ready_to_request ? .45 : 1 }]}><Text style={{ color: colors.onAccent, fontWeight: '700' }}>{busy ? 'Submitting…' : selected.status === 'returned' ? 'Resubmit for review' : 'Request completion'}</Text></TouchableOpacity></View>}
        {selected.status === 'requested' && <View style={card}><Text style={text}>Waiting for your company supervisor to confirm internship dates, hours and the completion certificate.</Text></View>}
        {selected.status === 'company_confirmed' && <View style={card}><Text style={text}>Your company has confirmed completion. Your coordinator will review the checklist and make the final decision.</Text></View>}
        {selected.company_confirmation && <View style={card}><Text style={[styles.subtitle, text]}>Company confirmation</Text><Text style={muted}>{selected.company_confirmation.start_date} – {selected.company_confirmation.end_date}</Text><Text style={text}>{selected.company_confirmation.hours} confirmed hours</Text>{!!selected.company_confirmation.note && <Text style={text}>{selected.company_confirmation.note}</Text>}<TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void certificate()} style={styles.back}><Text style={{ color: colors.accent }}>Open Certificate of Completion</Text></TouchableOpacity></View>}
        <View style={card}><Text style={[styles.subtitle, text]}>Final grade</Text>{selected.released_grade ? <><Text style={[styles.hours, { color: colors.accent }]}>{selected.released_grade.grade.toFixed(2)}</Text><Text style={text}>{selected.released_grade.notes}</Text><Text style={muted}>Released {selected.grade_released_at ? timestamp(selected.grade_released_at) : ''}</Text></> : <Text style={muted}>Your final grade will appear after your coordinator explicitly releases it.</Text>}</View>
        {selected.status === 'completed' && <View style={card}><Text style={[styles.subtitle, text]}>Archived records</Text>
          {selected.checklist?.records?.dtr.map(record => <View key={record.id} style={[styles.history, { borderColor: colors.border }]}><Text style={text}>{record.date.slice(0, 10)} · {record.hours}h</Text><Text style={muted}>{record.time_in} – {record.time_out}</Text>{!!record.tasks && <Text style={text}>{record.tasks}</Text>}</View>)}
          {selected.checklist?.records?.journals.map(record => <View key={record.id} style={[styles.history, { borderColor: colors.border }]}><Text style={text}>Week {record.week}: {record.title}</Text><Text style={muted}>{record.summary}</Text><TouchableOpacity disabled={busy} style={styles.back} onPress={() => void certificate('journals', record.id)}><Text style={{ color: colors.accent }}>Open journal PDF</Text></TouchableOpacity></View>)}
          {selected.checklist?.records?.documents?.map(record => <TouchableOpacity key={record.id} disabled={busy} style={styles.back} onPress={() => void certificate('documents', record.id, record.extension)}><Text style={{ color: colors.accent }}>Open {human(record.type)} · {record.status}</Text></TouchableOpacity>)}
<TouchableOpacity style={styles.back} onPress={() => router.push('/(student)/dtr')}><Text style={{ color: colors.accent }}>View DTR</Text></TouchableOpacity><TouchableOpacity style={styles.back} onPress={() => router.push('/(student)/journals')}><Text style={{ color: colors.accent }}>View journals</Text></TouchableOpacity><TouchableOpacity style={styles.back} onPress={() => router.push('/(student)/documents')}><Text style={{ color: colors.accent }}>View documents</Text></TouchableOpacity><Text style={muted}>These sections show the configured term. The completion snapshot and certificate above remain available across terms.</Text></View>}
        <View style={card}><Text style={[styles.subtitle, text]}>Decision history</Text>{selected.events?.length ? selected.events.map(event => <View style={[styles.history, { borderColor: colors.border }]} key={event.id}><Text style={[styles.badge, text]}>{human(event.action)}</Text><Text style={muted}>{event.actor_name} · {timestamp(event.created_at)}</Text>{!!event.reason && <Text style={[styles.paragraph, text]}>{event.reason}</Text>}</View>) : <Text style={muted}>No completion decisions yet.</Text>}</View>
      </>}
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  back: { paddingVertical: 12, paddingHorizontal: 4 }, kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1 }, title: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  content: { padding: 18, paddingBottom: 40, gap: 14 }, paragraph: { fontSize: 14, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 9 }, subtitle: { fontSize: 17, fontWeight: '700' }, hours: { fontSize: 28, fontWeight: '800', marginVertical: 8 },
  filters: { flexDirection: 'row', gap: 10 }, filter: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderTopWidth: 1, paddingTop: 14, marginTop: 5 }, checkText: { flex: 1, lineHeight: 21 },
  input: { borderWidth: 1, borderRadius: 10, minHeight: 96, padding: 12, textAlignVertical: 'top' },
  button: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 6 }, badge: { textTransform: 'capitalize', fontWeight: '700', fontSize: 13 },
  history: { borderTopWidth: 1, paddingVertical: 12, gap: 6 }, pagination: { flexDirection: 'row', justifyContent: 'space-between', padding: 10 },
})
