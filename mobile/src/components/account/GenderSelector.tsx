import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GENDER_OPTIONS, type Gender } from '../../constants/profile';
import { useTheme } from '../../context/ThemeContext';

export function GenderSelector({ value, onChange, disabled }: {
  value: Gender | null; onChange: (value: Gender | null) => void; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const options = [[null, 'Not specified'], ...GENDER_OPTIONS] as const;
  return <View style={styles.field}>
    <Text style={[styles.label, { color: colors.textSecondary }]}>Gender (optional)</Text>
    <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Gender (optional)">
      {options.map(([key, label]) => <TouchableOpacity key={key ?? 'not-specified'}
        accessibilityRole="radio" accessibilityLabel={label}
        accessibilityState={{ checked: value === key, disabled: !!disabled }} disabled={disabled}
        onPress={() => onChange(key)} style={[styles.option, { borderColor: value === key ? colors.accent : colors.border,
          backgroundColor: colors.background, opacity: disabled ? 0.6 : 1 }]}>
        <Ionicons name={value === key ? 'radio-button-on' : 'radio-button-off'} size={20} color={value === key ? colors.accent : colors.textSecondary} />
        <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{label}</Text>
      </TouchableOpacity>)}
    </View>
    <Text style={[styles.hint, { color: colors.textSecondary }]}>Optional. Used for aggregate internship reporting.</Text>
  </View>;
}
const styles = StyleSheet.create({
  field: { gap: 8, marginBottom: 16 }, label: { fontSize: 13, fontWeight: '500' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, maxWidth: '100%', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  optionLabel: { fontSize: 14, flexShrink: 1 }, hint: { fontSize: 12, lineHeight: 18 },
});
