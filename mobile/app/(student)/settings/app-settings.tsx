import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../../src/context/ThemeContext';
import { APP_VERSION, APP_BUILD } from '../../../src/constants/app';

export default function AppSettingsScreen() {
  const { colors } = useTheme();
  const [clearing, setClearing] = useState(false);
  const card = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, padding: 20, borderRadius: 16, gap: 12 } as const;
  const text = { color: colors.textPrimary }, muted = { color: colors.textSecondary, lineHeight: 22 };
  async function clearCache() {
    setClearing(true);
    try {
      const root = FileSystem.cacheDirectory;
      if (!root) throw new Error('Temporary storage is unavailable on this device.');
      const files = await FileSystem.readDirectoryAsync(root);
      for (const file of files) await FileSystem.deleteAsync(root + file, { idempotent: true });
      Alert.alert('Cache cleared', 'Temporary app files were cleared. Your sign-in, settings and submitted records are unchanged.');
    } catch { Alert.alert('Unable to clear cache', 'Some temporary files could not be removed. Please try again.'); }
    finally { setClearing(false); }
  }
  const link = (label: string, action: () => void) => <TouchableOpacity accessibilityRole="button" onPress={action} style={{ paddingVertical: 12 }}><Text style={{ color: colors.accent, fontWeight: '700' }}>{label}</Text></TouchableOpacity>;
  return <SafeAreaView edges={['top','bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 18 }}>{link('Back', () => router.back())}<Text style={{ ...text, fontWeight: '800', fontSize: 23 }}>App settings</Text></View>
    <ScrollView contentContainerStyle={{ padding: 18, gap: 18 }}>
      <View style={card}><Text style={{ ...text, fontWeight: '700', fontSize: 18 }}>Language</Text><Text style={text}>English</Text></View>
      <View style={card}><Text style={{ ...text, fontWeight: '700', fontSize: 18 }}>Temporary files</Text><Text style={muted}>Remove cached images and downloaded temporary files from this phone. Files can be downloaded again when needed.</Text>
        <TouchableOpacity accessibilityRole="button" disabled={clearing} onPress={() => Alert.alert('Clear temporary files?', 'Your account, sign-in, theme and server records will stay available.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear cache', onPress: () => void clearCache() }])} style={{ paddingVertical: 12, opacity: clearing ? .5 : 1 }}><Text style={{ color: colors.accent, fontWeight: '700' }}>{clearing ? 'Clearing…' : 'Clear cache'}</Text></TouchableOpacity>{clearing && <ActivityIndicator color={colors.accent} />}
      </View>
      <View style={card}><Text style={{ ...text, fontWeight: '700', fontSize: 18 }}>Information</Text>{link('Help & guides', () => router.push('/(student)/settings/help-support'))}{link('Privacy policy', () => router.push('/(student)/settings/privacy-policy'))}{link('Terms & conditions', () => router.push('/(student)/settings/terms'))}{link('About AIMS', () => router.push('/(student)/about'))}<Text style={muted}>{APP_VERSION} · Build {APP_BUILD}</Text></View>
    </ScrollView>
  </SafeAreaView>;
}
