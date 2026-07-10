import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import * as SecureStore from "expo-secure-store"
import Constants from "expo-constants"
import { Platform } from "react-native"
import { apiFetch } from "./api"

/**
 * Push registration (M3 server side is live): ask permission, fetch the
 * Expo push token, register it with POST /api/devices. Called on every
 * launch while signed in — the server upserts by token and refreshes
 * lastSeenAt. Sign-out revokes the device row.
 */

const PUSH_TOKEN_KEY = "sportshub.expoPushToken"

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
      await Notifications.setNotificationChannelAsync("default", {
        name: "SportsHub",
        importance: Notifications.AndroidImportance.DEFAULT,
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
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY)
  if (!token) return
  await apiFetch("/api/devices", { method: "DELETE", body: JSON.stringify({ token }) })
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY)
}
