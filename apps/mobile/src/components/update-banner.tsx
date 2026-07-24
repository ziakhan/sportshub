import { Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Updates from "expo-updates"
import { palette } from "@/lib/theme"

/**
 * OTA update banner (owner 2026-07-25): kills the "relaunch twice and hope"
 * dance. expo-updates downloads new bundles in the background but only
 * applies them on the NEXT cold launch — so a finished download now surfaces
 * as a one-tap restart instead of an invisible maybe.
 */
export function UpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates()
  const insets = useSafeAreaInsets()

  if (!isUpdatePending) return null

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 62 }]} pointerEvents="box-none">
      <Pressable style={styles.banner} onPress={() => Updates.reloadAsync().catch(() => {})}>
        <Text style={styles.text}>Update ready</Text>
        <Text style={styles.action}>Restart now</Text>
      </Pressable>
    </View>
  )
}

/** Short id + built-at of the RUNNING bundle — shown on the Account screen. */
export function runningUpdateLabel(): string {
  const id = Updates.updateId ? Updates.updateId.slice(0, 8) : "embedded"
  const at = Updates.createdAt
    ? new Date(Updates.createdAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null
  return at ? `Update ${id} · ${at}` : `Update ${id}`
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 60 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.ink[950],
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  text: { color: "#fff", fontSize: 13, fontWeight: "600" },
  action: { color: palette.gold[400], fontSize: 13, fontWeight: "800" },
})
