import { useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native"
import Constants from "expo-constants"
import * as Updates from "expo-updates"
import { router } from "expo-router"
import { TopBar } from "@/components/top-bar"
import {
  Avatar,
  Card,
  ListRow,
  OutlineButton,
  PrimaryButton,
  SectionHeader,
} from "@/components/ui"
import { apiBaseUrl } from "@/lib/api"
import { useHome } from "@/lib/home"
import { useSession } from "@/lib/session"
import { ui } from "@/lib/theme"

/**
 * Account hub — the filing cabinet (§5.6.4): profile, kids, payments,
 * alerts, notification prefs, sign out. Anonymous users get sign-in/up.
 * Shows the OTA update id so "which version is on your phone" is answerable.
 */
export default function AccountScreen() {
  const { signedIn, user, signOut } = useSession()
  const { home } = useHome()
  const [busy, setBusy] = useState(false)

  function confirmSignOut() {
    Alert.alert("Sign out", "This signs this phone out of SportsHub.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setBusy(true)
          try {
            await signOut()
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  const updateLabel = Updates.updateId ? Updates.updateId.slice(0, 8) : "embedded"

  return (
    <View style={styles.root}>
      <TopBar unread={home?.unreadNotifications ?? 0} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {signedIn ? (
          <>
            <Card>
              <View style={styles.profileRow}>
                <Avatar name={user?.name ?? user?.email} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{user?.name || "Your account"}</Text>
                  {user?.email ? <Text style={styles.sub}>{user.email}</Text> : null}
                </View>
              </View>
              <ListRow
                icon="create-outline"
                text="Edit profile"
                onPress={() => router.push("/account/profile")}
              />
            </Card>

            <SectionHeader eyebrow="Family" title="My stuff" accent="play" />
            <Card>
              {/* Kids/offers rows only when the account has players — same
                  gating as the web account hub */}
              {home?.shape.hasKids ? (
                <ListRow icon="people-outline" text="My kids" onPress={() => router.push("/kids")} />
              ) : null}
              {home?.shape.hasKids ? (
                <ListRow
                  icon="document-text-outline"
                  text="Offers"
                  onPress={() => router.push("/offers")}
                />
              ) : null}
              <ListRow
                icon="card-outline"
                text="Payments & receipts"
                onPress={() => router.push("/account/payments")}
              />
              <ListRow
                icon="notifications-outline"
                text="Alerts"
                onPress={() => router.push("/alerts")}
              />
              <ListRow
                icon="moon-outline"
                text="Notification quiet hours"
                onPress={() => router.push("/account/notifications")}
              />
            </Card>

            <OutlineButton label={busy ? "Signing out…" : "Sign out"} onPress={confirmSignOut} />
          </>
        ) : (
          <>
            <Card>
              <Text style={styles.name}>You&apos;re browsing as a guest</Text>
              <Text style={styles.sub}>
                Sign in for team chat, RSVPs, offers, payments and your family&apos;s schedule.
              </Text>
            </Card>
            <PrimaryButton label="Sign in" onPress={() => router.push("/sign-in")} />
            <OutlineButton label="Create a free account" onPress={() => router.push("/sign-up")} />
          </>
        )}

        <Card>
          <Text style={styles.label}>App</Text>
          <Text style={styles.sub}>
            Version {Constants.expoConfig?.version ?? "dev"} · update {updateLabel}
            {Updates.channel ? ` · ${Updates.channel}` : ""}
          </Text>
          <Text style={styles.sub}>Server: {apiBaseUrl()}</Text>
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  name: { fontSize: 17, fontWeight: "800", color: ui.text },
  sub: { fontSize: 13, color: ui.textMuted, marginTop: 1 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: ui.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
})
