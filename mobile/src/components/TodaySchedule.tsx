import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { useTodaySchedule } from '../hooks/useTodaySchedule';
import type { TodayAttendanceSchedule } from '../services/dtr.service';

const labels: Record<TodayAttendanceSchedule['status'], string> = {
  regular_shift: 'Regular shift',
  shift_change: 'Adjusted shift',
  holiday: 'Holiday',
  approved_absence: 'Approved absence',
  company_holiday: 'Company holiday',
  day_off: 'Scheduled day off',
  no_schedule: 'Your company has not set a schedule yet.',
  not_started: 'Your internship has not started yet.',
  not_deployed: 'Your schedule will appear after deployment approval.',
};

export function TodaySchedule({ today, formatTime }: { today: ReturnType<typeof useTodaySchedule>; formatTime: (time: string) => string }) {
  const { colors } = useTheme();
  const { schedule, failed, retry } = today;

  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Today’s schedule</Text>
    {schedule ? <>
      <Text style={{ color: colors.textSecondary }}>
        {new Date(schedule.date + 'T00:00:00Z').toLocaleDateString('en-PH', {
          timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
        })} · Philippine time
      </Text>
      <Text style={[styles.status, { color: colors.textPrimary }]}>{labels[schedule.status]}</Text>
      {schedule.clock_in_block_reason && <Text style={{ color: colors.textSecondary }}>{schedule.clock_in_block_reason}</Text>}
      {schedule.clock_in_at && schedule.clock_out_at && <View style={styles.times}>
        <View>
          <Text style={{ color: colors.textSecondary }}>Expected clock-in</Text>
          <Text style={[styles.time, { color: colors.textPrimary }]}>{formatTime(schedule.clock_in_at)}</Text>
        </View>
        <View>
          <Text style={{ color: colors.textSecondary }}>Expected clock-out</Text>
          <Text style={[styles.time, { color: colors.textPrimary }]}>{formatTime(schedule.clock_out_at)}</Text>
        </View>
      </View>}
    </> : <>
      <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>
        {failed ? 'Could not load today’s schedule.' : 'Loading schedule…'}
      </Text>
      {failed && <Pressable accessibilityRole="button" style={styles.retry} onPress={retry}>
        <Text style={[styles.status, { color: colors.textPrimary }]}>Retry schedule</Text>
      </Pressable>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, marginBottom: 12, padding: 16, gap: 6 },
  title: { fontSize: 17, fontWeight: '700' },
  status: { fontSize: 14, fontWeight: '600' },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 },
  time: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
