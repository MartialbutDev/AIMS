import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { dtrService, type TodayAttendanceSchedule } from '../services/dtr.service';

export function useTodaySchedule(revision = 0) {
  const focused = useIsFocused();
  const [schedule, setSchedule] = useState<TodayAttendanceSchedule | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!focused) return;
    const controller = new AbortController();
    setSchedule(null);
    setFailed(false);
    void dtrService.getTodaySchedule(controller.signal).then(result => {
      if (!controller.signal.aborted) setSchedule(result);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [focused, revision, retryCount]);

  return { schedule, failed, retry: () => setRetryCount(value => value + 1) };
}
