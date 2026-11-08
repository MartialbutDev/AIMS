import { useState } from 'react';
import { router } from 'expo-router';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';
import { APP_VERSION, APP_BUILD } from '../../../src/constants/app';
import { AccountPage, AccountHero, Panel, SectionLabel, MenuRow, ui } from '../../../src/components/account/AccountUI';
const faqs = [
  {
    "id": "apply",
    "question": "How do I apply and submit the endorsement?",
    "answer": "Get orientation and current-term COR approved first. Use your current approved resume/CV and application letter when applying. Upload the school-issued endorsement through the steps in your application. It must be approved before your coordinator forwards the application to the company."
  },
  {
    "id": "deploy",
    "question": "Does company acceptance mean I can start DTR?",
    "answer": "No. Complete the Pre-deployment checklist and wait for coordinator deployment approval. DTR and journals require an active deployment in the configured academic term."
  },
  {
    "id": "replace",
    "question": "Will a new upload remove my approved document?",
    "answer": "No. The current approved version stays active while a replacement is reviewed. A rejected replacement does not replace it. An approved replacement becomes current; previous versions remain in history, and submitted application attachments keep their original versions."
  },
  {
    "id": "review",
    "question": "Does OCR or Verified authenticate a signature?",
    "answer": "No. OCR reads text and supports type/content checks. A type suggestion is not approval. Pending review means not approved yet. Verified / approved means accepted for the requirement by current checks or review; it does not authenticate signatures or guarantee the issuer is genuine."
  },
  {
    "id": "docs",
    "question": "Which forms should I use, and can I delete a file?",
    "answer": "Use Documents → Official forms for published versions, instructions and deadlines. Follow school instructions for physical originals. The three-dot menu shows allowed View, Hide or Delete actions. Linked academic records may not be deletable; hiding does not erase server history."
  },
  {
    "id": "location",
    "question": "Why is the captured location inaccurate?",
    "answer": "Device sensors, location permissions and available networks affect accuracy. Enable precise location and recapture if the position is wrong. AIMS warns about readings over 100 metres or unknown accuracy before submission. This is a caution, not a school geofence. Contact your coordinator if you cannot obtain a reliable reading."
  },
  {
    "id": "hours",
    "question": "Which attendance hours count?",
    "answer": "Only approved DTR hours count toward the configured requirement shown in the dashboard, DTR summary and Completion checklist. A submitted time correction does not update approved hours until the required reviews approve it."
  },
  {
    "id": "dtr",
    "question": "How do I correct my recorded attendance time?",
    "answer": "Open the DTR details and use Request a time correction. Enter the proposed times and reason. Your company supervisor reviews first, then the coordinator decides. Follow returned feedback. Archived completion records may need to be reopened before a correction."
  },
  {
    "id": "complete",
    "question": "How do I finish and see my grade?",
    "answer": "Open Profile → Completion & archive, or the dashboard Internship Progress shortcut. Complete the checklist and request completion. Your company confirms it; the coordinator makes final approval and releases the grade separately. Enough hours alone do not complete the process."
  },
  {
    "id": "retry",
    "question": "What should I do after a connection failure?",
    "answer": "Refresh the relevant list or record before retrying. A submission may have reached the server even when the phone did not receive confirmation. Check for the existing upload, application or DTR before submitting again."
  },
  {
    "id": "notify",
    "question": "How do I enable phone notifications?",
    "answer": "In an installed AIMS build, allow notifications in phone settings, enable Push Notifications in AIMS Notification preferences and tap Connect / reconnect this phone. Optional alerts can be delayed or disabled; check in-app updates and official instructions for deadlines."
  },
  {
    "id": "support",
    "question": "How do I report a problem?",
    "answer": "Contact your assigned coordinator or school administrator through official school channels. Include the version/build shown below, the screen, steps and exact error. Never send your password or OTP. AIMS does not provide private messaging or an in-app support-ticket service."
  }
];
const guides = [
  {
    "id": "1",
    "title": "Getting started",
    "detail": "Account, orientation/COR and the current academic term",
    "icon": "rocket-outline"
  },
  {
    "id": "2",
    "title": "Applying and deployment",
    "detail": "Endorsement, company acceptance and coordinator deployment",
    "icon": "briefcase-outline"
  },
  {
    "id": "3",
    "title": "Attendance and corrections",
    "detail": "Location accuracy, approved hours and the correction review route",
    "icon": "calendar-outline"
  },
  {
    "id": "4",
    "title": "Weekly journals",
    "detail": "PDF reports and coordinator review",
    "icon": "book-outline"
  },
  {
    "id": "5",
    "title": "Documents and replacements",
    "detail": "Pending, approved, replacements and retained history",
    "icon": "documents-outline"
  },
  {
    "id": "6",
    "title": "Completion and archive",
    "detail": "Checklist, company confirmation, final approval and grade release",
    "icon": "ribbon-outline"
  }
] as const;

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
    <Panel><MenuRow icon="sparkles-outline" title="Replay the welcome tour" detail="Prepare, track and complete your internship in three quick steps." onPress={() => router.push({ pathname: '/welcome', params: { replay: '1' } })} /></Panel>
    <SectionLabel title="Step-by-step guides" />
    <Panel>{guides.map(guide => <MenuRow key={guide.id} icon={guide.icon} title={guide.title} detail={guide.detail} onPress={() => router.push({ pathname: '/(student)/settings/guide-detail', params: { id: guide.id } })} />)}</Panel>
    <Panel><MenuRow icon="school-outline" title="Need school assistance?" detail="Contact your assigned coordinator or school administrator through official school channels." /><Text style={[ui.description, { color: colors.textSecondary }]}>When reporting a problem, include the screen, steps you took, exact error, and version below. Keep passwords and OTPs private.</Text><Text selectable style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>{APP_VERSION} · Build {APP_BUILD}</Text></Panel>
  </AccountPage>;
}
