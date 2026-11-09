import { useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useTheme } from '../context/ThemeContext';
import { dtrService, type DTR } from '../services/dtr.service';

export default function AttendanceBreakControls({ record, onChange }: { record: DTR; onChange: (record: DTR) => void }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const sending = useRef(false), requestId = useRef('');
  if (record.time_out || record.status !== 'pending') return null;
  const active = record.break_periods?.find(period => !period.ended_at);
  async function changeBreak() {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError('');
    if (!active && !requestId.current) requestId.current = Crypto.randomUUID();
    try {
      const updated = await dtrService.recordBreak(record.id, active ? 'end' : 'start', active?.id || requestId.current);
      requestId.current = ''; onChange(updated);
    } catch (e: any) {
      setError(typeof e.response?.data?.detail === 'string' ? e.response.data.detail : 'Break could not be saved. Check your connection and reopen this record before retrying.');
    } finally { sending.current = false; setBusy(false); }
  }
  return <View style={{ padding: 20, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
    <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700' }}>{active ? 'On break · working time paused' : 'Working · break controls'}</Text>
    <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>Lunch and recorded breaks are excluded from working hours. Changes take effect when saved by the server. {active ? 'End this break before clocking out.' : 'Start a break when you stop working.'}</Text>
    <Text style={{ color: colors.textSecondary }}>Completed breaks: {Math.round((record.break_seconds || 0) / 6) / 10} minutes</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>{error}</Text>}
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void changeBreak()} style={{ padding: 14, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', opacity: busy ? .6 : 1 }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{busy ? 'Saving…' : active ? 'End break' : 'Start break'}</Text>
    </TouchableOpacity>
  </View>;
}
