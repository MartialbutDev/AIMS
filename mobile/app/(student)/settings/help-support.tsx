import { useState } from 'react';
import { router } from 'expo-router';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';
import { APP_VERSION, APP_BUILD } from '../../../src/constants/app';
import { AccountPage, AccountHero, Panel, SectionLabel, MenuRow, ui } from '../../../src/components/account/AccountUI';
const faqs = [
  { id: 'apply', question: 'How do I apply for an internship?', answer: 'Complete your onboarding document requirements first. Upload your resume/CV and application letter and have them verified. In Applications, create an application for an available company and select those verified documents. Your coordinator reviews the application before it reaches the company.' },
  { id: 'deploy', question: 'Why can’t I record DTR or submit a journal?', answer: 'Company acceptance comes before deployment. Open Pre-deployment from your dashboard, complete its checklist, and wait for your assigned coordinator to confirm deployment. DTR and journal submissions are available only during an active deployment in the configured academic term.' },
  { id: 'docs', question: 'Which forms and documents should I use?', answer: 'Use the requirements shown in your Documents and Pre-deployment screens. Open Official forms in Documents for forms published by your coordinator, including their instructions, version and deadline. Follow your coordinator’s instructions for physical originals.' },
  { id: 'hours', question: 'How many internship hours are required?', answer: 'Your dashboard, DTR summary and Completion & archive checklist show the configured required hours. Approved hours count toward that requirement. Follow the requirement and instructions for your academic term rather than an older sample form.' },
  { id: 'dtr', question: 'What if my DTR is rejected or needs correction?', answer: 'Read the coordinator’s feedback in the DTR details. Contact your assigned coordinator through your school’s official channels for correction instructions. A pending record can receive a time-out; completed internship records require the coordinator to reopen completion before corrections.' },
  { id: 'complete', question: 'Do enough hours automatically complete my internship?', answer: 'No. In Completion & archive, finish the checklist and request completion. Your company supervisor confirms the internship and supplies a completion certificate. Your coordinator makes the final approval and releases the final grade separately.' },
  { id: 'notify', question: 'How do I enable phone notifications?', answer: 'Use an installed AIMS APK. Allow AIMS notifications in your phone settings, then open Settings → Notification preferences, enable Push Notifications and tap Connect / reconnect this phone. Tap a phone alert to view its details inside AIMS. Your in-app inbox remains available when optional alerts are muted.' },
  { id: 'support', question: 'How do I get help with an app problem?', answer: 'Contact your assigned coordinator or school administrator through your school’s official channels. Include the app version/build shown below, the screen you opened, the steps you took and the exact error. Do not share your password or OTP. The app does not submit support tickets or offer private messaging.' },
];
const guides = [
  { id: '1', title: 'Getting started', detail: 'Account verification, profile and the dashboard' },
  { id: '2', title: 'Applying and deployment', detail: 'Verified documents, applications and school-arranged placements' },
  { id: '3', title: 'Daily time records', detail: 'Clock-in, clock-out and coordinator review' },
  { id: '4', title: 'Weekly journals', detail: 'PDF uploads, review and corrections' },
];


export default function HelpSupportScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState(''), [expanded, setExpanded] = useState<string | null>(null);
  const filtered = faqs.filter(item => `${item.question} ${item.answer}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <AccountPage title="Help & support">
    <AccountHero icon="help-buoy-outline" title="A little guidance, every step." description="Find answers and practical guides for your internship journey." label="STUDENT SUPPORT" />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14 }}>
      <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
      <TextInput accessibilityLabel="Search help topics" value={search} onChangeText={setSearch} placeholder="Search help topics…" placeholderTextColor={colors.textTertiary} style={{ flex: 1, minHeight: 52, fontSize: 14, color: colors.textPrimary }} />
      {!!search && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} style={{ padding: 12 }}><Ionicons name="close-circle" size={19} color={colors.textSecondary} /></TouchableOpacity>}
    </View>
    <SectionLabel title="Frequently asked questions" hint="Tap a question to see the answer." />
    {filtered.map(item => <Panel key={item.id}><TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: expanded === item.id }} onPress={() => setExpanded(expanded === item.id ? null : item.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <Text style={{ flex: 1, color: colors.textPrimary, fontWeight: '600', fontSize: 14, lineHeight: 21 }}>{item.question}</Text><Ionicons name={expanded === item.id ? 'remove' : 'add'} size={21} color={colors.accent} />
    </TouchableOpacity>{expanded === item.id && <Text style={[ui.description, { color: colors.textSecondary, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }]}>{item.answer}</Text>}</Panel>)}
    {!filtered.length && <Panel><Ionicons name="search-outline" size={26} color={colors.textTertiary} /><Text style={{ color: colors.textPrimary, fontWeight: '600' }}>No matching topics</Text><Text style={[ui.description, { color: colors.textSecondary }]}>Try a shorter phrase, such as documents or DTR.</Text></Panel>}
    <SectionLabel title="Step-by-step guides" />
    <Panel>{guides.map((guide, index) => <MenuRow key={guide.id} icon={(['compass-outline', 'briefcase-outline', 'time-outline', 'book-outline'] as const)[index]} title={guide.title} detail={guide.detail} onPress={() => router.push({ pathname: '/(student)/settings/guide-detail', params: { id: guide.id } })} />)}</Panel>
    <Panel><MenuRow icon="school-outline" title="Need school assistance?" detail="Contact your assigned coordinator or school administrator through official school channels." /><Text style={[ui.description, { color: colors.textSecondary }]}>When reporting a problem, include the screen, steps you took, exact error, and version below. Keep passwords and OTPs private.</Text><Text selectable style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>{APP_VERSION} · Build {APP_BUILD}</Text></Panel>
  </AccountPage>;
}
