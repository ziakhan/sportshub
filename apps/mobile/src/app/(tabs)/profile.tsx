import { useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import Constants from "expo-constants"
import { useSession } from "@/lib/session"
import { apiBaseUrl } from "@/lib/api"
import { ui } from "@/lib/theme"

/**
 * Profile & settings v1 — who's signed in, where the app points, sign out
 * (revokes this device's tokens + push registration). Kids, push prefs and
 * quiet hours join in the next pass.
 */

export default function ProfileScreen() {
  const { user, signOut } = useSession()
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{user?.name || user?.email || "This device"}</Text>
        {user?.email ? <Text style={styles.subValue}>{user.email}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>App</Text>
        <Text style={styles.subValue}>Version {Constants.expoConfig?.version ?? "dev"}</Text>
        <Text style={styles.subValue}>Server: {apiBaseUrl()}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.signOut, (pressed || busy) && { opacity: 0.7 }]}
        onPress={confirmSignOut}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={ui.danger} />
        ) : (
          <Text style={styles.signOutText}>Sign out</Text>
        )}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.background },
  content: { padding: 16, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: ui.radius.md,
    padding: 14,
    gap: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: ui.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  value: { fontSize: 17, fontWeight: "700", color: ui.text },
  subValue: { fontSize: 14, color: ui.textMuted },
  signOut: {
    borderWidth: 1,
    borderColor: ui.danger,
    borderRadius: ui.radius.md,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 12,
  },
  signOutText: { color: ui.danger, fontSize: 16, fontWeight: "700" },
})
