import { getStudentReminderRoute } from '../utils/studentReminderRoute'
import { notificationsChanged } from './notification.service'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'
import api from './api'

const TOKEN_KEY = 'aims_push_token'
export async function registerPushDevice(requestPermission = true): Promise<string> {
  const session = await SecureStore.getItemAsync('access_token')
  if (!session) return 'Please sign in to connect this phone.'
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return 'Push requires an AIMS development or production build.'
  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID
  if (!projectId) return 'Expo project is not configured yet.'
  const {data: preferences} = await api.get('/notifications/settings')
  if (!preferences.push_enabled) { await unregisterPushDevice(); return 'Push is disabled in your preferences.' }
  const Notifications = await import('expo-notifications')
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('aims',{name:'AIMS updates',importance:Notifications.AndroidImportance.DEFAULT})
  let permission = await Notifications.getPermissionsAsync()
  if (!permission.granted && requestPermission) permission = await Notifications.requestPermissionsAsync()
  if (!permission.granted) { await unregisterPushDevice(); return 'Allow notifications for AIMS in your phone settings, then reconnect this phone.' }
  const token = (await Notifications.getExpoPushTokenAsync({projectId})).data
  if (session !== await SecureStore.getItemAsync('access_token')) return 'Sign-in changed. Reconnect this phone after signing in.'
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
    const id = response.notification.request.content.data?.notification_id
    try {
      // Verify inbox ownership before following a notification from a shared phone.
      if (typeof id !== 'string') return
      const {data: notice} = await api.get(`/notifications/detail/${encodeURIComponent(id)}`)
      await api.put(`/notifications/${encodeURIComponent(id)}/read`)
      notificationsChanged()
      const route = getStudentReminderRoute(notice.data) ?? '/(student)/notifications'
      router.push(route as never)
    } catch { router.push('/(student)/notifications') }
    finally { await Notifications.clearLastNotificationResponseAsync() }
  }
  const last = await Notifications.getLastNotificationResponseAsync()
  if (last) await navigate(last)
  const subscription = Notifications.addNotificationResponseReceivedListener(response=>{void navigate(response)})
  const received = Notifications.addNotificationReceivedListener(() => notificationsChanged())
  const tokenChanged = Notifications.addPushTokenListener(() => { void registerPushDevice(false).catch(() => {}) })
  return ()=>{subscription.remove(); received.remove(); tokenChanged.remove()}
}
