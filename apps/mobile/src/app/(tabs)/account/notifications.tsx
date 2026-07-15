import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SubHeader } from "@/components/top-bar"
import { Card } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { palette, ui } from "@/lib/theme"

/**
 * Notification preferences — push quiet hours (server-side columns the M3
 * worker reads at send time).
 */

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/

export default function NotificationsScreen() {
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    apiJson<{ pushQuietStart: string | null; pushQuietEnd: string | null }>("/api/user/push-prefs")
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
    <View style={styles.root}>
      <SubHeader title="Notifications" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.label}>Push quiet hours</Text>
          <Text style={styles.sub}>
            No notifications between these times (leave both empty to turn off).
          </Text>
          <View style={styles.quietRow}>
            <TextInput
              style={styles.quietInput}
              placeholder="22:00"
              placeholderTextColor={ui.textFaint}
              value={start}
              onChangeText={setStart}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.quietDash}>to</Text>
            <TextInput
              style={styles.quietInput}
              placeholder="08:00"
              placeholderTextColor={ui.textFaint}
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
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: ui.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sub: { fontSize: 13, color: ui.textMuted, marginTop: 2 },
  quietRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  quietInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: ui.text,
    backgroundColor: ui.surfaceSunken,
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
  note: { fontSize: 13, color: palette.court[700], marginTop: 8 },
})
