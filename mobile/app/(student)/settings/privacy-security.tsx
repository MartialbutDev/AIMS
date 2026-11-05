import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Alert, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';
import { AccountPage, AccountHero, Panel, SectionLabel, MenuRow, ActionButton, ui } from '../../../src/components/account/AccountUI';
import api from '../../../src/services/api';
import { authService } from '../../../src/services/auth.service';
import { registerPushDevice } from '../../../src/services/push.service';

interface Session { id: string; label: string; current: boolean; created_at: string; last_seen_at: string; expires_at: string }
const time = (value: string) => new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : value + 'Z').toLocaleString();
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
  return <AccountPage title="Privacy & security">
    <AccountHero icon="shield-checkmark-outline" title="Stay in control." description="Protect your account and review where you are signed in." label="ACCOUNT PROTECTION" />
    <SectionLabel title="Account security" />
    <Panel><MenuRow icon="key-outline" title="Change password" detail="Update the password you use to sign in." onPress={() => router.push('/(student)/profile/change-password')} /><MenuRow icon="notifications-outline" title="Notification preferences" detail="Choose how AIMS reaches you." onPress={() => router.push('/(student)/notifications/preferences')} /><MenuRow icon="shield-outline" title="Privacy policy" detail="Understand how your information is used." onPress={() => router.push('/(student)/settings/privacy-policy')} /></Panel>
    <SectionLabel title="Active sessions" hint="Each session is a sign-in. A phone or browser can have more than one." />
    {error ? <Panel><Text accessibilityRole="alert" style={[ui.description, { color: colors.error }]}>{error}</Text><ActionButton title="Try again" secondary disabled={busy} onPress={() => void load()} /></Panel> : null}
    {loading ? <Panel><ActivityIndicator color={colors.accent} /><Text style={[ui.description, { color: colors.textSecondary }]}>Checking active sign-ins…</Text></Panel> : sessions.map(session => <Panel key={session.id}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Ionicons name="phone-portrait-outline" color={colors.accent} size={24} /><View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{session.label}</Text>{session.current && <Text style={{ color: colors.approved, fontSize: 12, fontWeight: '600', marginTop: 4 }}>This session</Text>}</View></View>
      <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, gap: 6 }}><Text style={[ui.description, { color: colors.textSecondary }]}>Last active · {time(session.last_seen_at)}</Text><Text style={[ui.description, { color: colors.textSecondary }]}>Signed in · {time(session.created_at)}</Text><Text style={[ui.description, { color: colors.textSecondary }]}>Expires · {time(session.expires_at)}</Text></View>
      <ActionButton title={session.current ? 'Sign out this session' : 'End session'} danger disabled={busy} onPress={() => Alert.alert('End this session?', session.current ? 'You will be signed out of this app.' : 'This sign-in will lose access to AIMS.', [{ text: 'Cancel', style: 'cancel' }, { text: 'End session', style: 'destructive', onPress: () => void end(session.id, session.current) }])} />
    </Panel>)}
    {!loading && !error && !sessions.length && <Panel><Text style={[ui.description, { color: colors.textSecondary }]}>No active sessions were returned. Refresh to check again.</Text></Panel>}
    <ActionButton title="Refresh sessions" secondary disabled={busy || loading} onPress={() => void load()} />
    <ActionButton title="Sign out all other sessions" danger disabled={busy || loading || !sessions.some(s => !s.current)} onPress={() => Alert.alert('Sign out other sessions?', 'Other sign-ins will lose access. This session stays signed in.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out others', style: 'destructive', onPress: () => void end() }])} />
  </AccountPage>;
}
