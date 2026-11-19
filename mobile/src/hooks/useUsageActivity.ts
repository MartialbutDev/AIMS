import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

export function useUsageActivity(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let pending = false;
    let lastSent = 0;
    async function report() {
      if (AppState.currentState !== 'active' || pending || Date.now() - lastSent < 30000) return;
      pending = true;
      try {
        if (!await SecureStore.getItemAsync('access_token') || controller.signal.aborted) return;
        await api.post('/analytics/activity', { platform: 'mobile' }, { signal: controller.signal });
        lastSent = Date.now();
      } catch {
        // Usage reporting retries later without interrupting the current task.
      } finally {
        pending = false;
      }
    }
    void report();
    const timer = setInterval(() => void report(), 60000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void report(); });
    return () => {
      controller.abort();
      clearInterval(timer);
      subscription.remove();
    };
  }, [enabled]);
}
