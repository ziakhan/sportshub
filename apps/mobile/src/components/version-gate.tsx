import { useMemo, useState } from "react"
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Constants from "expo-constants"
import Ionicons from "@expo/vector-icons/Ionicons"
import { Card, PrimaryButton } from "@/components/ui"
import { palette, ui } from "@/lib/theme"
import type { AppVersionConfig } from "@/lib/config"

/**
 * Binary version gate (owner 2026-07-25): server-driven "update available /
 * update required" for STORE BUILDS. This is deliberately separate from the
 * OTA JS gate (update-banner.tsx, which restarts an already-downloaded JS
 * bundle) and from the semver ForcedUpgrade screen in _layout.tsx — store
 * binaries live for months, and a JS-only gate can't hard-block a binary
 * whose NATIVE code needs replacing (new permissions, SDK bumps, etc).
 *
 * Reads /api/mobile/config's `appVersion` (fetched once at boot by
 * useMobileConfig in _layout.tsx and passed down as a prop — no second
 * fetch). Compares the running binary's build number against server
 * min/latest per platform:
 *   - build < min    → full-screen blocking view, can't be dismissed.
 *   - build < latest → dismissible top notice, once per app session.
 * All-zero server defaults (owner hasn't set the envs yet) mean both
 * checks are skipped — same as any fetch/parse failure upstream, this
 * fails open and renders nothing.
 */

let dismissedThisSession = false

/**
 * The running native binary's build number. iOS: `Constants.platform.ios
 * .buildNumber` reads the embedded Info.plist's CFBundleVersion directly —
 * a true native value that can't drift with an OTA update. Android has no
 * equivalent in expo-constants (`Constants.platform.android` is always
 * empty at runtime in this SDK; the real native accessor lives in
 * expo-application, which isn't installed and the task disallows adding
 * new native modules for this) — falls back to the build-time
 * `expoConfig.android.versionCode`, i.e. the versionCode baked into
 * app.json for that build.
 */
function runningBuildNumber(): number {
  if (Platform.OS === "ios") {
    const raw = Constants.platform?.ios?.buildNumber ?? Constants.expoConfig?.ios?.buildNumber
    return parseInt(String(raw ?? ""), 10) || 0
  }
  if (Platform.OS === "android") {
    const raw = Constants.expoConfig?.android?.versionCode
    return typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10) || 0
  }
  return 0
}

export function VersionGate({
  appVersion,
}: {
  appVersion: AppVersionConfig | null | undefined
}) {
  const insets = useSafeAreaInsets()
  const [dismissed, setDismissed] = useState(dismissedThisSession)

  const { minBuild, latestBuild, updateUrl } = useMemo(() => {
    if (!appVersion) return { minBuild: 0, latestBuild: 0, updateUrl: "" }
    if (Platform.OS === "ios") {
      return {
        minBuild: appVersion.iosMinBuild,
        latestBuild: appVersion.iosLatestBuild,
        updateUrl: appVersion.iosUpdateUrl,
      }
    }
    if (Platform.OS === "android") {
      return {
        minBuild: appVersion.androidMinBuild,
        latestBuild: appVersion.androidLatestBuild,
        updateUrl: appVersion.androidUpdateUrl,
      }
    }
    return { minBuild: 0, latestBuild: 0, updateUrl: "" }
  }, [appVersion])

  if (!appVersion || (minBuild <= 0 && latestBuild <= 0)) return null

  const build = runningBuildNumber()
  if (build <= 0) return null // can't read a build number — fail open

  const openUpdate = () => {
    if (updateUrl) Linking.openURL(updateUrl).catch(() => {})
  }

  if (minBuild > 0 && build < minBuild) {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.blockingScreen,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Card style={styles.blockingCard}>
          <View style={styles.icon}>
            <Ionicons name="cloud-download-outline" size={26} color={ui.primary} />
          </View>
          <Text style={styles.title}>Update required</Text>
          <Text style={styles.body}>
            {appVersion.message ||
              "This version of SportsHub is no longer supported. Update to keep everything working."}
          </Text>
          <PrimaryButton label="Update now" onPress={openUpdate} style={styles.button} />
          <Text style={styles.hint}>
            {Platform.OS === "ios"
              ? "Opens TestFlight. Install the update, then come back."
              : "Opens the update link. Install the update, then come back."}
          </Text>
        </Card>
      </View>
    )
  }

  if (latestBuild > 0 && build < latestBuild && !dismissed) {
    return (
      <View style={[styles.noticeWrap, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.notice}>
          <Text style={styles.noticeText} numberOfLines={1}>
            A new version is available
          </Text>
          <Pressable onPress={openUpdate} hitSlop={8}>
            <Text style={styles.noticeAction}>Update</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              dismissedThisSession = true
              setDismissed(true)
            }}
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </Pressable>
        </View>
      </View>
    )
  }

  return null
}

const styles = StyleSheet.create({
  blockingScreen: {
    zIndex: 100,
    backgroundColor: ui.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  blockingCard: { width: "100%", maxWidth: 380, alignItems: "center", gap: 6, padding: 24 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: "800", color: ui.text },
  body: { fontSize: 14.5, color: ui.textMuted, textAlign: "center", lineHeight: 21, marginBottom: 8 },
  button: { alignSelf: "stretch" },
  hint: { fontSize: 12.5, color: ui.textFaint, textAlign: "center", marginTop: 10 },
  noticeWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 90 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.ink[950],
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: "92%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  noticeText: { color: "#fff", fontSize: 13, fontWeight: "600", flexShrink: 1 },
  noticeAction: { color: palette.gold[400], fontSize: 13, fontWeight: "800" },
})
