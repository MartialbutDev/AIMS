import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Alert, ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';
import api from '../../../src/services/api';
import { authService } from '../../../src/services/auth.service';
import { registerPushDevice } from '../../../src/services/push.service';

interface Session { id: string; label: string; current: boolean; created_at: string; last_seen_at: string; expires_at: string }
const time = (text: string) => new Date(text.endsWith('Z') ? text : text + 'Z').toLocaleString();
function message(error: unknown) {
  const e = error as { response?: { data?: { detail?: string } }; message?: string };
  return e.response?.data?.detail || e.message || 'Unable to update sessions. Please try again.';
}

export default function PrivacySecurityScreen() {
  const { colors } = useTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setSessions((await api.get('/auth/sessions')).data.items); }
    catch (e) { setError(message(e)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const card = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 18, gap: 12 } as const;
  const text = { color: colors.textPrimary }, muted = { color: colors.textSecondary, lineHeight: 22 };
  async function end(id?: string, current = false) {
    setBusy(true); setError('');
    try {
      if (id) await api.delete('/auth/sessions/' + encodeURIComponent(id));
      else await api.post('/auth/sessions/revoke-others');
      if (current) { await authService.logout(); router.replace('/(auth)/login'); return; }
      await registerPushDevice(false).catch(() => {});
      await load();
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  const link = (label: string, action: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={action} style={{ paddingVertical: 12, opacity: disabled ? .45 : 1 }}><Text style={{ color: colors.accent, fontWeight: '700' }}>{label}</Text></TouchableOpacity>;
  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12 }}>{link('Back', () => router.back())}<Text style={{ ...text, fontWeight: '800', fontSize: 23 }}>Privacy & security</Text></View>
    <ScrollView contentContainerStyle={{ padding: 18, gap: 18 }}>
      <View style={card}><Ionicons name="lock-closed-outline" size={28} color={colors.accent} /><Text style={{ ...text, fontSize: 19, fontWeight: '700' }}>Your account</Text><Text style={muted}>Manage your password, phone alerts and active sign-ins.</Text>
        {link('Change password', () => router.push('/(student)/profile/change-password'))}
        {link('Notification preferences', () => router.push('/(student)/notifications/preferences'))}
        {link('Privacy policy', () => router.push('/(student)/settings/privacy-policy'))}
      </View>
      <View style={card}><Text style={{ ...text, fontSize: 19, fontWeight: '700' }}>Active sessions</Text><Text style={muted}>A session is a sign-in, not necessarily a separate physical device. Older sign-ins appear when they next connect. Ending a session requires that user to sign in again.</Text>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.rejected }}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.accent} /> : sessions.map(session => <View key={session.id} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 14, gap: 6 }}>
          <Text style={{ ...text, fontWeight: '700' }}>{session.label}{session.current ? ' · This session' : ''}</Text>
          <Text style={muted}>Started {time(session.created_at)}</Text><Text style={muted}>Last active {time(session.last_seen_at)}</Text><Text style={muted}>Expires {time(session.expires_at)}</Text>
          {link('End session', () => Alert.alert('End this session?', session.current ? 'You will be signed out of this app.' : 'This sign-in will lose access to AIMS.', [{ text: 'Cancel', style: 'cancel' }, { text: 'End session', style: 'destructive', onPress: () => void end(session.id, session.current) }]), busy)}
        </View>)}
        {link('Refresh sessions', () => void load(), busy || loading)}
        {link('Sign out all other sessions', () => Alert.alert('Sign out other sessions?', 'Other sign-ins will lose access. This session stays signed in. Phone registrations will be refreshed for this phone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out others', style: 'destructive', onPress: () => void end() }]), busy || loading)}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
