import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { onNotificationsChanged } from '../services/notification.service';

/** Refresh only while the screen and app are active; release every listener. */
export function useNotificationRefresh(refresh: () => void | Promise<void>) {
  const latest = useRef(refresh); latest.current = refresh;
  useFocusEffect(useCallback(() => {
    let active = true;
    const run = () => { if (active && AppState.currentState === 'active') void latest.current(); };
    run();
    const timer = setInterval(run, 30000), remove = onNotificationsChanged(run);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') run(); });
    return () => { active = false; clearInterval(timer); remove(); subscription.remove(); };
  }, []));
}
