import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import Constants from "expo-constants"
import { useSession } from "@/lib/session"
import { apiBaseUrl, apiJson } from "@/lib/api"
import { palette, ui } from "@/lib/theme"

/**
 * Profile & settings — who's signed in, push quiet hours (server-side
 * columns the M3 worker reads at send time), sign out (revokes this
 * device's tokens + push registration). Kids management joins later.
 */

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/

function QuietHours() {
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    apiJson<{ pushQuietStart: string | null; pushQuietEnd: string | null }>(
      "/api/user/push-prefs"
    )
      .then((p) => {
        setStart(p.pushQuietStart ?? "")
        setEnd(p.pushQuietEnd ?? "")
      })
      .catch(() => {})
  }, [])

  async function save() {
    const clearing = !start.trim() && !end.trim()
    if (!clearing && (!HHMM.test(start.trim()) || !HHMM.test(end.trim()))) {
      setNote("Times must look like 22:00 and 08:00")
      return
    }
    setSaving(true)
    setNote(null)
    try {
      await apiJson("/api/user/push-prefs", {
        method: "PATCH",
        body: JSON.stringify({
          pushQuietStart: clearing ? null : start.trim(),
          pushQuietEnd: clearing ? null : end.trim(),
        }),
      })
      setNote(clearing ? "Quiet hours off" : "Saved — no pushes in that window")
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn't save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Push quiet hours</Text>
      <Text style={styles.subValue}>
        No notifications between these times (leave both empty to turn off).
      </Text>
      <View style={styles.quietRow}>
        <TextInput
          style={styles.quietInput}
          placeholder="22:00"
          placeholderTextColor={ui.textMuted}
          value={start}
          onChangeText={setStart}
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.quietDash}>to</Text>
        <TextInput
          style={styles.quietInput}
          placeholder="08:00"
          placeholderTextColor={ui.textMuted}
          value={end}
          onChangeText={setEnd}
          keyboardType="numbers-and-punctuation"
        />
        <Pressable
          style={({ pressed }) => [styles.quietSave, (pressed || saving) && { opacity: 0.7 }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.quietSaveText}>Save</Text>
          )}
        </Pressable>
      </View>
      {note ? <Text style={styles.quietNote}>{note}</Text> : null}
    </View>
  )
}

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

      <QuietHours />

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
  quietRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  quietInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: ui.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: ui.text,
    backgroundColor: ui.surface,
    textAlign: "center",
  },
  quietDash: { color: ui.textMuted, fontSize: 14 },
  quietSave: {
    backgroundColor: ui.primary,
    borderRadius: ui.radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  quietSaveText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  quietNote: { fontSize: 13, color: palette.court[700], marginTop: 6 },
})
