import Constants from 'expo-constants'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'
import api from './api'

const TOKEN_KEY = 'aims_push_token'
const allowedRoutes = new Set(['/(student)/completion','/(student)/documents','/(student)/dtr','/(student)/journals','/(student)/applications','/(student)/notifications'])
export async function registerPushDevice(): Promise<string> {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return 'Push requires an AIMS development or production build.'
  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID
  if (!projectId) return 'Expo project is not configured yet.'
  const {data: preferences} = await api.get('/notifications/settings')
  if (!preferences.push_enabled) { await unregisterPushDevice(); return 'Push is disabled in your preferences.' }
  const Notifications = await import('expo-notifications')
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('aims',{name:'AIMS updates',importance:Notifications.AndroidImportance.DEFAULT})
  let permission = await Notifications.getPermissionsAsync()
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync()
  if (!permission.granted) { await unregisterPushDevice(); return 'Phone notification permission was not granted.' }
  const token = (await Notifications.getExpoPushTokenAsync({projectId})).data
  await api.put('/push/device',{token})
  await SecureStore.setItemAsync(TOKEN_KEY,token)
  return 'This device is registered for AIMS notifications.'
}

export async function unregisterPushDevice(): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY)
  if (!token) return
  try { await api.delete('/push/device',{data:{token}}); await SecureStore.deleteItemAsync(TOKEN_KEY) }
  catch { /* Keep the token so the next authenticated registration can retry. */ }
}

export async function listenForPushNavigation(): Promise<()=>void> {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return ()=>{}
  const Notifications = await import('expo-notifications')
  Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})})
  const navigate = async (response:import('expo-notifications').NotificationResponse) => {
    if (!await SecureStore.getItemAsync('access_token')) return
    const route = response.notification.request.content.data?.route
    router.push((typeof route === 'string' && allowedRoutes.has(route) ? route : '/(student)/notifications') as never)
    await Notifications.clearLastNotificationResponseAsync()
  }
  const last = await Notifications.getLastNotificationResponseAsync()
  if (last) await navigate(last)
  const subscription = Notifications.addNotificationResponseReceivedListener(response=>{void navigate(response)})
  return ()=>subscription.remove()
}
