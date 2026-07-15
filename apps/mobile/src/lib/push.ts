import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import * as SecureStore from "expo-secure-store"
import Constants from "expo-constants"
import { Platform } from "react-native"
import { router } from "expo-router"
import { apiFetch } from "./api"
import { nativeRouteForLink } from "./nav-links"

/**
 * Push: registration (POST /api/devices, upserted every launch while signed
 * in) + the notification runtime the app was missing (audit v2 §4):
 * foreground pushes show a banner, and TAPS deep-link — the sidecar sends
 * data:{link,type} with every push; routePushResponses() reads it on both
 * warm taps (response listener) and cold starts (last-response check).
 */

const PUSH_TOKEN_KEY = "sportshub.expoPushToken"

// Foreground pushes were previously dropped silently — show them.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

function followPush(response: Notifications.NotificationResponse | null): void {
  const data = response?.notification.request.content.data as
    | { link?: string | null }
    | undefined
  const route = nativeRouteForLink(data?.link)
  if (route) router.push(route as any)
  else if (data?.link) router.push("/alerts") // it's in the inbox at least
}

let coldStartHandled = false

/**
 * Wire tap-routing. Called once from the root layout after mount; returns
 * the unsubscribe for the warm-tap listener. Handled responses are cleared
 * so a stale "last response" can't re-route a later normal launch.
 */
export function routePushResponses(): () => void {
  // Cold start: the tap that LAUNCHED the app fires no listener event.
  if (!coldStartHandled) {
    coldStartHandled = true
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          followPush(response)
          Notifications.clearLastNotificationResponse()
        }
      })
      .catch(() => {})
  }
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    followPush(response)
    Notifications.clearLastNotificationResponse()
  })
  return () => sub.remove()
}

export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice) return // simulators have no push tokens

    const { status } = await Notifications.getPermissionsAsync()
    let granted = status === "granted"
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync()
      granted = req.status === "granted"
    }
    if (!granted) return

    if (Platform.OS === "android") {
      // HIGH importance = heads-up banners. Channel settings are sticky per
      // install, so this is a NEW channel id — "default" (DEFAULT importance,
      // silent tray-only) predates it on existing installs.
      await Notifications.setNotificationChannelAsync("alerts", {
        name: "SportsHub alerts",
        importance: Notifications.AndroidImportance.HIGH,
      })
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    )
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token)

    await apiFetch("/api/devices", {
      method: "POST",
      body: JSON.stringify({
        token,
        platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
        appVersion: Constants.expoConfig?.version ?? undefined,
      }),
    })
  } catch (err) {
    // Push is never worth blocking the app over
    console.warn("push registration failed:", err)
  }
}

/** Revoke this device's push row on sign-out. */
export async function unregisterDevice(): Promise<void> {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY).catch(() => null)
  if (!token) return
  await apiFetch("/api/devices", { method: "DELETE", body: JSON.stringify({ token }) })
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY)
}
