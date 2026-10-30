import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/context/ThemeContext';
import { APP_VERSION, APP_BUILD } from '../../../src/constants/app';

const faqs = [
  { id: 'apply', question: 'How do I apply for an internship?', answer: 'Complete the account-verification requirements first. Upload your resume/CV and application letter and have them verified. In Applications, create an application for an available company and select those verified documents. Your coordinator reviews the application before it reaches the company.' },
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
  const card = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 18, gap: 10 } as const;
  return <SafeAreaView edges={['top','bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, gap: 18 }}><TouchableOpacity accessibilityRole="button" onPress={() => router.back()} style={{ paddingVertical: 12 }}><Text style={{ color: colors.accent }}>Back</Text></TouchableOpacity><Text style={{ color: colors.textPrimary, fontSize: 23, fontWeight: '800' }}>Help & guides</Text></View>
    <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
      <TextInput accessibilityLabel="Search help" value={search} onChangeText={setSearch} placeholder="Search applications, DTR, completion…" placeholderTextColor={colors.textTertiary} style={{ ...card, color: colors.textPrimary, padding: 15 }} />
      {filtered.map(item => <View key={item.id} style={card}><TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: expanded === item.id }} onPress={() => setExpanded(expanded === item.id ? null : item.id)} style={{ paddingVertical: 6 }}><Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16 }}>{item.question} {expanded === item.id ? '−' : '+'}</Text></TouchableOpacity>{expanded === item.id && <Text style={{ color: colors.textSecondary, lineHeight: 23 }}>{item.answer}</Text>}</View>)}
      {!filtered.length && <Text style={{ color: colors.textSecondary }}>No matching help topics. Try another search.</Text>}
      <Text style={{ color: colors.textPrimary, fontSize: 19, fontWeight: '700', marginTop: 12 }}>Step-by-step guides</Text>
      {guides.map(guide => <TouchableOpacity key={guide.id} accessibilityRole="button" style={card} onPress={() => router.push({ pathname: '/(student)/settings/guide-detail', params: { id: guide.id } })}><Text style={{ color: colors.accent, fontWeight: '700' }}>{guide.title} →</Text><Text style={{ color: colors.textSecondary }}>{guide.detail}</Text></TouchableOpacity>)}
      <View style={card}><Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Need school assistance?</Text><Text style={{ color: colors.textSecondary, lineHeight: 23 }}>Contact your assigned coordinator or school administrator through your school’s official channels. Include these details when reporting an issue:</Text><Text selectable style={{ color: colors.textPrimary }}>{APP_VERSION} · Build {APP_BUILD}</Text></View>
    </ScrollView>
  </SafeAreaView>;
}
