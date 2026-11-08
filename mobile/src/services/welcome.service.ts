import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const WELCOME_SEEN_KEY = '@AIMS_welcome_seen_v1';
export type LaunchDestination = '/welcome' | '/onboarding' | '/(auth)/login';

async function rememberWelcome(): Promise<void> {
  try { await AsyncStorage.setItem(WELCOME_SEEN_KEY, 'seen'); }
  catch { /* A tour preference must never block account access. */ }
}

export async function resolveLaunchDestination(): Promise<LaunchDestination> {
  try {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
      // Existing signed-in users keep the normal server-checked onboarding path.
      await rememberWelcome();
      return '/onboarding';
    }
    return await AsyncStorage.getItem(WELCOME_SEEN_KEY) === 'seen' ? '/(auth)/login' : '/welcome';
  } catch {
    return '/(auth)/login';
  }
}

export async function finishWelcome(): Promise<'/onboarding' | '/(auth)/login'> {
  await rememberWelcome();
  try { return await SecureStore.getItemAsync('access_token') ? '/onboarding' : '/(auth)/login'; }
  catch { return '/(auth)/login'; }
}
