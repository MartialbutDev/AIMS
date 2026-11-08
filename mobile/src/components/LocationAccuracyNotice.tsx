import { Alert, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { assessLocationAccuracy } from '../utils/locationAccuracy';

export function LocationAccuracyNotice({ accuracy }: { accuracy: number | null | undefined }) {
  const { colors } = useTheme();
  const notice = assessLocationAccuracy(accuracy);
  return <View accessibilityLiveRegion="polite" style={{ padding: 14, marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 8 }}>
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Ionicons name={notice.caution ? 'warning-outline' : 'information-circle-outline'} size={19} color={notice.caution ? colors.warning : colors.accent} /><Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1 }}>{notice.label}</Text></View>
    <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 19 }}>{notice.message}</Text>
    {notice.caution && <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 19 }}>You will be asked to confirm before submitting this reading. Location alone does not verify attendance.</Text>}
  </View>;
}

export function confirmAttendanceLocation(accuracy: number | null | undefined): Promise<boolean> {
  const notice = assessLocationAccuracy(accuracy);
  if (!notice.caution) return Promise.resolve(true);
  return new Promise(resolve => Alert.alert('Check location accuracy', `${notice.label}. ${notice.message}\n\nOnly continue if you have checked this position. You can return to capture again or contact your coordinator for guidance.`, [
    { text: 'Go back', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Submit this reading', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}
