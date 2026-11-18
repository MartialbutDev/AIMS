import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { submissionErrorMessage } from '../services/submissionRecovery';

const absenceTypeLabels = { planned: 'Planned absence', emergency: 'Emergency absence' } as const;
type AbsenceType = keyof typeof absenceTypeLabels;
type AbsenceDraft = { kind: AbsenceType | ''; workday: string; reason: string };
type Absence = Omit<AbsenceDraft, 'kind'> & { kind: AbsenceType } & { id: string; status: 'pending' | 'approved' | 'declined' };
const statusLabels = { pending: 'Pending supervisor review', approved: 'Approved', declined: 'Declined' };
const philippines = 'Asia/Manila';

function dateInPhilippines(value: Date) {
  const fields = new Intl.DateTimeFormat('en', {
    timeZone: philippines, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const get = (field: string) => fields.find(part => part.type === field)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function StudentAbsenceRequests({ active, revision }: { active: boolean; revision: number }) {
  const { colors } = useTheme();
  const focused = useIsFocused();
  const [items, setItems] = useState<Absence[] | null>(null);
  const [draft, setDraft] = useState<AbsenceDraft | null>(null);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [retry, setRetry] = useState(0);
  const sending = useRef(false);
  const pickerColors = { borderColor: colors.textSecondary, backgroundColor: colors.surfaceSecondary };
  const dateLabel = draft && Platform.OS !== 'web' ? new Date(draft.workday + 'T00:00:00Z').toLocaleDateString('en-PH', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  }) : '';

  useEffect(() => {
    if (!focused) return;
    const controller = new AbortController();
    setFeedback('');
    void api.get<Absence[]>('/attendance-absences/mine', { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted && !sending.current) setItems(data);
    }).catch(() => {
      if (!controller.signal.aborted && !sending.current) setFeedback('Could not load absence requests.');
    });
    return () => controller.abort();
  }, [focused, revision, retry]);

  function chooseDate() {
    if (!draft) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: new Date(draft.workday + 'T12:00:00+08:00'), mode: 'date', timeZoneName: philippines,
        onChange: (event, value) => {
          if (event.type === 'set' && value) setDraft(current => current && { ...current, workday: dateInPhilippines(value) });
        },
      });
    } else {
      setShowPicker(value => !value);
    }
  }

  async function submit() {
    if (!draft?.kind || sending.current) return;
    if (draft.reason.trim().length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(draft.workday)) {
      setFeedback('Choose a date and enter a brief reason.');
      return;
    }
    sending.current = true;
    setBusy(true);
    setFeedback('');
    try {
      const { data } = await api.post<Absence>('/attendance-absences/mine', { ...draft, reason: draft.reason.trim() });
      setItems(current => [data, ...(current ?? []).filter(item => item.id !== data.id)]
        .sort((a, b) => b.workday.localeCompare(a.workday)));
      setDraft(null);
      setShowTypes(false);
      setShowPicker(false);
      setFeedback('Absence request sent to your company supervisor.');
    } catch (error) {
      setFeedback(submissionErrorMessage(error, 'Could not send this absence request. Please try again.'));
    } finally {
      setBusy(false);
      sending.current = false;
    }
  }

  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Text style={[styles.title, { color: colors.textPrimary }]} accessibilityRole="header">Absence requests</Text>
    {items && active && !draft && <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
      setDraft({ kind: '', workday: dateInPhilippines(new Date()), reason: '' });
      setFeedback('');
    }}><Text style={[styles.strong, { color: colors.textPrimary }]}>Request absence</Text></Pressable>}
    {draft && <>
      <Text style={{ color: colors.textSecondary }}>Use Emergency absence for illness or a missed shift you could not report earlier.</Text>
      <Text style={[styles.strong, { color: colors.textPrimary }]}>Absence type</Text>
      <Pressable accessibilityRole="button"
        accessibilityLabel={draft.kind ? `Absence type, ${absenceTypeLabels[draft.kind]}` : 'Select absence type'}
        accessibilityState={{ expanded: showTypes, disabled: busy }}
        disabled={busy} onPress={() => setShowTypes(value => !value)}
        style={({ pressed }) => [styles.input, styles.pickerRow, pickerColors,
          (pressed || showTypes) && { borderColor: colors.accent }]}>
        <Text style={[styles.pickerValue, { color: draft.kind ? colors.textPrimary : colors.textSecondary }]}>
          {draft.kind ? absenceTypeLabels[draft.kind] : 'Select absence type'}
        </Text>
        <Ionicons name={showTypes ? 'chevron-up' : 'chevron-down'} size={18} color={colors.accent} />
      </Pressable>
      {showTypes && <View style={styles.options}>
        {(['planned', 'emergency'] as const).map(kind => <Pressable key={kind}
          accessibilityRole="radio" accessibilityState={{ checked: draft.kind === kind, disabled: busy }}
          disabled={busy} style={({ pressed }) => [styles.input, styles.pickerRow, pickerColors,
            (pressed || draft.kind === kind) && { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}
          onPress={() => {
            setDraft({ ...draft, kind });
            setShowTypes(false);
          }}>
          <Ionicons name={draft.kind === kind ? 'radio-button-on-outline' : 'radio-button-off-outline'}
            size={19} color={draft.kind === kind ? colors.accent : colors.textSecondary} />
          <Text style={[styles.pickerValue, { color: colors.textPrimary }]}>{absenceTypeLabels[kind]}</Text>
        </Pressable>)}
      </View>}
      <Text style={[styles.strong, { color: colors.textPrimary }]}>Absence date</Text>
      {Platform.OS === 'web' ? <TextInput accessibilityLabel="Absence date" placeholder="YYYY-MM-DD" value={draft.workday}
        editable={!busy} style={[styles.input, pickerColors, { color: colors.textPrimary }]}
        onChangeText={workday => setDraft({ ...draft, workday })} /> :
        <Pressable accessibilityRole="button" accessibilityLabel={`Absence date, ${dateLabel}`}
          accessibilityHint="Opens the date picker"
          accessibilityState={{ disabled: busy, expanded: Platform.OS === 'ios' ? showPicker : undefined }}
          disabled={busy} onPress={chooseDate}
          style={({ pressed }) => [styles.input, styles.pickerRow, pickerColors,
            (pressed || showPicker) && { borderColor: colors.accent }]}>
          <Ionicons name="calendar-outline" size={19} color={colors.accent} />
          <Text style={[styles.pickerValue, { color: colors.textPrimary }]}>{dateLabel}</Text>
          <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.accent} />
        </Pressable>}
      {Platform.OS === 'ios' && showPicker && <DateTimePicker mode="date" value={new Date(draft.workday + 'T12:00:00+08:00')}
        timeZoneName={philippines} onChange={(_, value) => {
          if (value) setDraft({ ...draft, workday: dateInPhilippines(value) });
        }} />}
      <Text style={[styles.strong, { color: colors.textPrimary }]}>Brief reason</Text>
      <TextInput accessibilityLabel="Brief reason" multiline maxLength={300} value={draft.reason} editable={!busy}
        onChangeText={reason => setDraft({ ...draft, reason })}
        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !draft.kind }}
          disabled={busy || !draft.kind} onPress={() => void submit()}
          style={({ pressed }) => [styles.button, styles.submitButton, { backgroundColor: colors.accent },
            (pressed || busy || !draft.kind) && styles.disabled]}>
          <Text style={[styles.strong, { color: colors.onAccent }]}>{busy ? 'Sending…' : 'Send request'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.button} disabled={busy} onPress={() => {
          setDraft(null);
          setShowTypes(false);
          setShowPicker(false);
          setFeedback('');
        }}><Text style={{ color: colors.textSecondary }}>Cancel</Text></Pressable>
      </View>
    </>}
    {feedback ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textPrimary }}>{feedback}</Text> : null}
    {!items && (feedback ? <Pressable accessibilityRole="button" style={styles.button} onPress={() => setRetry(value => value + 1)}>
      <Text style={{ color: colors.textPrimary }}>Retry absence requests</Text>
    </Pressable> : <Text style={{ color: colors.textSecondary }}>Loading absence requests…</Text>)}
    {items?.length === 0 && !draft && <Text style={{ color: colors.textSecondary }}>No absence requests yet.</Text>}
    {items?.map(item => <View key={item.id} style={[styles.record, { borderColor: colors.border }]}>
      <Text style={[styles.strong, { color: colors.textPrimary }]}>{item.workday} · {absenceTypeLabels[item.kind]}</Text>
      <Text style={{ color: colors.textPrimary }}>{statusLabels[item.status]}</Text>
      <Text style={{ color: colors.textSecondary }}>{item.reason}</Text>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, marginBottom: 12, padding: 16, gap: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  strong: { fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  pickerValue: { flex: 1, fontWeight: '600' },
  options: { gap: 6 },
  submitButton: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  disabled: { opacity: 0.5 },
  input: { borderWidth: 1, borderRadius: 8, minHeight: 44, padding: 10 },
  record: { paddingTop: 10, borderTopWidth: 1, gap: 4 },
});
