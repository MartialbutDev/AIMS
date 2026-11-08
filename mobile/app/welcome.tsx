import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AppLogo from '../src/components/common/AppLogo';
import { useTheme } from '../src/context/ThemeContext';
import { finishWelcome } from '../src/services/welcome.service';

const slides = [
  {
    title: 'Prepare & apply',
    description: 'Start with your orientation and COR. Keep your documents together, then apply to a partner company.',
    icon: 'documents-outline',
    steps: [
      { icon: 'school-outline', label: 'Orientation & COR' },
      { icon: 'document-text-outline', label: 'Required documents' },
      { icon: 'briefcase-outline', label: 'Internship applications' },
    ],
    note: 'Get your required documents approved before your application advances.',
  },
  {
    title: 'Track your internship',
    description: 'Once your coordinator approves deployment, record your attendance and share what you learn.',
    icon: 'time-outline',
    steps: [
      { icon: 'checkmark-circle-outline', label: 'Deployment approval' },
      { icon: 'calendar-outline', label: 'Attendance & approved hours' },
      { icon: 'book-outline', label: 'Weekly journals' },
    ],
    note: 'Only approved attendance counts toward your required internship hours.',
  },
  {
    title: 'Complete your journey',
    description: 'Meet your checklist, request completion and follow your final reviews in one place.',
    icon: 'ribbon-outline',
    steps: [
      { icon: 'business-outline', label: 'Company confirmation' },
      { icon: 'people-outline', label: 'Coordinator final approval' },
      { icon: 'school-outline', label: 'Released grades & archive' },
    ],
    note: 'Completion approval and final grade release are separate steps.',
  },
] as const;

export default function WelcomeScreen() {
  const { colors, isDark } = useTheme();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const replaying = replay === '1';
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(0), [busy, setBusy] = useState(false);
  const finishing = useRef(false), scroll = useRef<ScrollView>(null);
  const slide = slides[index], last = index === slides.length - 1;

  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [index]);

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    setBusy(true);
    try {
      const destination = await finishWelcome();
      if (replaying && router.canGoBack()) router.back();
      else router.replace(destination);
    } finally {
      finishing.current = false;
      setBusy(false);
    }
  }

  return <SafeAreaView edges={['top', 'bottom']} style={[styles.page, { backgroundColor: colors.background }]}>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <View style={styles.topbar}>
      <View style={styles.brand}><AppLogo size={38} decorative /><View style={styles.brandCopy}><Text style={[styles.brandName, { color: colors.textPrimary }]}>AIMS</Text><Text style={[styles.brandCaption, { color: colors.textSecondary }]}>CITC · USTP Cagayan de Oro</Text></View></View>
      <TouchableOpacity accessibilityRole="button" onPress={() => void finish()} disabled={busy} style={styles.skip}><Text style={[styles.skipText, { color: colors.textSecondary }]}>{replaying ? 'Close tour' : 'Skip'}</Text></TouchableOpacity>
    </View>
    <ScrollView ref={scroll} showsVerticalScrollIndicator contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.illustration, { minHeight: Math.max(140, Math.min(215, height * .24)) }]}>
          <View style={styles.orbit} /><View style={styles.orbitInner} />
          <View style={styles.heroIcon}><Ionicons name={slide.icon} size={52} color="#FFC629" /></View>
          <View style={styles.symbols}>{slide.steps.map(step => <View key={step.label} style={styles.symbol}><Ionicons name={step.icon} size={21} color="#FFFFFF" /></View>)}</View>
          <Text style={styles.illustrationCaption}>LEARNING WITH PURPOSE</Text>
        </View>
        <Text style={[styles.eyebrow, { color: colors.accent }]} accessibilityLiveRegion="polite">YOUR INTERNSHIP JOURNEY · {index + 1} OF 3</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{slide.title}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{slide.description}</Text>
        <View style={[styles.steps, { backgroundColor: colors.card, borderColor: colors.border }]}>{slide.steps.map(step => <View key={step.label} style={styles.step}><Ionicons name={step.icon} size={20} color={colors.accent} /><Text style={[styles.stepText, { color: colors.textPrimary }]}>{step.label}</Text></View>)}</View>
        <Text style={[styles.note, { color: colors.textSecondary }]}>{slide.note}</Text>
      </View>
    </ScrollView>
    <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
      <View style={styles.dots} accessible accessibilityLabel={`Welcome tour, step ${index + 1} of 3`}>{slides.map((item, position) => <View key={item.title} style={[styles.dot, { width: position === index ? 26 : 7, backgroundColor: position === index ? colors.accent : colors.border }]} />)}</View>
      <View style={styles.controls}>
        {index > 0 && <TouchableOpacity accessibilityRole="button" disabled={busy} style={[styles.back, { borderColor: colors.border }]} onPress={() => setIndex(value => value - 1)}><Ionicons name="arrow-back" size={18} color={colors.textPrimary} /><Text style={[styles.backText, { color: colors.textPrimary }]}>Back</Text></TouchableOpacity>}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={last ? replaying ? 'Back to Help' : 'Get Started' : 'Next'} accessibilityState={{ disabled: busy, busy }} disabled={busy} style={[styles.next, { opacity: busy ? .65 : 1 }]} onPress={() => { if (last) void finish(); else setIndex(value => Math.min(value + 1, slides.length - 1)); }}>
          {busy ? <ActivityIndicator color="#0b0b2f" /> : <><Text style={styles.nextText}>{last ? replaying ? 'Back to Help' : 'Get Started' : 'Next'}</Text><Ionicons name="arrow-forward" size={18} color="#0b0b2f" /></>}
        </TouchableOpacity>
      </View>
      <Text style={[styles.footerNote, { color: colors.textSecondary }]}>{replaying ? 'Revisit this tour any time from Help & support.' : 'Next, sign in or create your student account.'}</Text>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  topbar: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 },
  brandCopy: { flex: 1, minWidth: 0 },
  brandName: { fontSize: 17, fontWeight: '800', letterSpacing: 1 },
  brandCaption: { fontSize: 10, lineHeight: 15 },
  skip: { minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 13, fontWeight: '600' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20 },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  illustration: { backgroundColor: '#0b0b2f', borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 20 },
  orbit: { position: 'absolute', width: 270, height: 270, borderRadius: 135, borderColor: '#30305b', borderWidth: 1, top: -100, right: -65 },
  orbitInner: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderColor: '#45415a', borderWidth: 1, left: -80, bottom: -120 },
  heroIcon: { width: 78, height: 78, borderRadius: 24, backgroundColor: '#242448', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  symbols: { flexDirection: 'row', gap: 15 },
  symbol: { width: 33, height: 33, borderRadius: 12, backgroundColor: '#ffffff12', justifyContent: 'center', alignItems: 'center' },
  illustrationCaption: { color: '#D5D5E8', fontSize: 8, letterSpacing: 2, fontWeight: '600', marginTop: 12 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.3, marginTop: 22, lineHeight: 16 },
  title: { fontSize: 30, lineHeight: 37, fontWeight: '800', letterSpacing: -.8, marginTop: 7 },
  description: { fontSize: 14, lineHeight: 22, marginTop: 10 },
  steps: { borderRadius: 17, borderWidth: 1, padding: 16, gap: 14, marginTop: 18 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  stepText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '500' },
  note: { fontSize: 12, lineHeight: 19, marginTop: 12 },
  footer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 12, borderTopWidth: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 },
  dot: { height: 7, borderRadius: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  backText: { fontSize: 14, fontWeight: '600' },
  next: { minHeight: 50, borderRadius: 14, backgroundColor: '#FFC629', paddingHorizontal: 18, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  nextText: { fontSize: 15, fontWeight: '700', color: '#0b0b2f' },
  footerNote: { fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 10 },
});
