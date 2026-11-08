import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

export default function AuthLegalLinks({ disabled = false }: { disabled?: boolean }) {
  const { colors } = useTheme();
  return <View style={styles.links}>
    <TouchableOpacity accessibilityRole="link" accessibilityLabel="Read Terms and Conditions" accessibilityState={{ disabled }} disabled={disabled} onPress={() => router.push('/(auth)/terms')} style={styles.link}>
      <Text style={[styles.text, { color: colors.accent }]}>Terms & Conditions</Text>
    </TouchableOpacity>
    <TouchableOpacity accessibilityRole="link" accessibilityLabel="Read Privacy Policy" accessibilityState={{ disabled }} disabled={disabled} onPress={() => router.push('/(auth)/privacy-policy')} style={styles.link}>
      <Text style={[styles.text, { color: colors.accent }]}>Privacy Policy</Text>
    </TouchableOpacity>
  </View>;
}

export function goBackFromLegal() {
  if (router.canGoBack()) router.back();
  else router.replace('/(auth)/login');
}

export function PublicLegalPage({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 12, width: '100%' },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 8, maxWidth: '100%' },
  text: { fontSize: 12, lineHeight: 19, fontWeight: '600', textDecorationLine: 'underline', textAlign: 'center' },
});
