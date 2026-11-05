import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../../src/context/ThemeContext';
import { APP_VERSION, APP_BUILD } from '../../../src/constants/app';
import { AccountPage, AccountHero, Panel, SectionLabel, MenuRow, ActionButton, ui } from '../../../src/components/account/AccountUI';

export default function AppSettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const [clearing, setClearing] = useState(false);
  async function clearCache() {
    setClearing(true);
    try {
      const root = FileSystem.cacheDirectory;
      if (!root) throw new Error('Temporary storage unavailable');
      for (const file of await FileSystem.readDirectoryAsync(root)) await FileSystem.deleteAsync(root + file, { idempotent: true });
      Alert.alert('Cache cleared', 'Temporary files were removed. Your sign-in, preferences and submitted records are unchanged.');
    } catch { Alert.alert('Unable to clear cache', 'Some temporary files could not be removed. Please try again.'); }
    finally { setClearing(false); }
  }
  return <AccountPage title="App settings">
    <AccountHero icon="options-outline" title="Make AIMS feel like you." description="Choose your appearance and manage this app on your phone." label="APP PREFERENCES" />
    <SectionLabel title="Appearance" hint="Choose the display that feels most comfortable." />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {(['light', 'dark'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ selected: mode === value }} accessibilityLabel={`${value} theme`} onPress={() => setMode(value)} style={{ flex: 1, padding: 16, borderRadius: 18, borderWidth: 2, borderColor: mode === value ? colors.accent : colors.border, backgroundColor: colors.card, gap: 12 }}>
        <View style={{ backgroundColor: value === 'dark' ? '#0B0D1B' : '#EDF0F8', height: 64, borderRadius: 10, padding: 10, gap: 7 }}><View style={{ width: 30, height: 7, borderRadius: 3, backgroundColor: '#FFC629' }} /><View style={{ height: 24, borderRadius: 5, backgroundColor: value === 'dark' ? '#27324B' : '#FFFFFF' }} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ color: colors.textPrimary, fontWeight: '600', flex: 1 }}>{value === 'dark' ? 'Dark' : 'Light'}</Text><Ionicons name={mode === value ? 'radio-button-on' : 'radio-button-off'} color={colors.accent} size={20} /></View>
      </TouchableOpacity>)}
    </View>
    <Panel><MenuRow icon="language-outline" title="Language" detail="English" /></Panel>
    <SectionLabel title="Storage" />
    <Panel><MenuRow icon="folder-open-outline" title="Temporary files" detail="Clear cached images and temporary downloads. Your account and submitted records stay available." /><ActionButton title={clearing ? 'Clearing temporary files…' : 'Clear cache'} secondary busy={clearing} onPress={() => Alert.alert('Clear temporary files?', 'Downloaded files can be downloaded again. Your account and server records will stay available.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear cache', onPress: () => void clearCache() }])} /></Panel>
    <SectionLabel title="Resources & information" />
    <Panel><MenuRow icon="help-buoy-outline" title="Help & support" onPress={() => router.push('/(student)/settings/help-support')} /><MenuRow icon="shield-checkmark-outline" title="Privacy policy" onPress={() => router.push('/(student)/settings/privacy-policy')} /><MenuRow icon="document-text-outline" title="Terms & conditions" onPress={() => router.push('/(student)/settings/terms')} /><MenuRow icon="information-circle-outline" title="About AIMS" onPress={() => router.push('/(student)/about')} /></Panel>
    <Text style={[ui.description, { color: colors.textTertiary, textAlign: 'center' }]}>{APP_VERSION} · Build {APP_BUILD}</Text>
  </AccountPage>;
}
