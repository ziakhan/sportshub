import { useMemo, useState } from "react"
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { SubHeader } from "@/components/top-bar"
import { Card, PrimaryButton } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { useMyCalendar } from "@/lib/calendar"
import { ui } from "@/lib/theme"
import { useTheme } from "@/lib/theme-context"

/**
 * Staff create a practice or typed team event natively (was web-only).
 * Practice → POST /api/teams/[id]/practices; typed events →
 * POST /api/team-events (WORKOUT/TRAINING/SCRIMMAGE/MEETING/OTHER). Both
 * notify every attached family, same as the web forms. Scheduling UI is
 * chip-based (next 30 days + 15-min time stepper) — no native date-picker
 * module, so this screen rides OTA to existing binaries.
 */

const TYPES = [
  { key: "PRACTICE", label: "Practice", icon: "basketball-outline" },
  { key: "WORKOUT", label: "Workout", icon: "barbell-outline" },
  { key: "TRAINING", label: "Training", icon: "fitness-outline" },
  { key: "SCRIMMAGE", label: "Scrimmage", icon: "people-outline" },
  { key: "MEETING", label: "Meeting", icon: "chatbubbles-outline" },
  { key: "OTHER", label: "Other", icon: "calendar-outline" },
] as const

type EventKey = (typeof TYPES)[number]["key"]

const DAY_COUNT = 30
const MIN_TIME = 6 * 60 // 6:00 AM
const MAX_TIME = 22 * 60 + 45 // 10:45 PM

function fmtTime(mins: number): string {
  const h24 = Math.floor(mins / 60)
  const m = mins % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`
}

export default function NewTeamEventScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>()
  const t = useTheme()
  const { calendar, refresh } = useMyCalendar()
  const teamName = calendar?.teams.find((x) => x.teamId === teamId)?.teamName ?? "Team"

  const [type, setType] = useState<EventKey>("PRACTICE")
  const [title, setTitle] = useState("")
  const [dayIndex, setDayIndex] = useState(0)
  const [time, setTime] = useState(18 * 60) // 6:00 PM
  const [duration, setDuration] = useState(90)
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const days = useMemo(() => {
    const out: { label: string; sub: string; date: Date }[] = []
    const today = new Date()
    for (let i = 0; i < DAY_COUNT; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
      out.push({
        label: i === 0 ? "Today" : i === 1 ? "Tmrw" : d.toLocaleDateString("en-CA", { weekday: "short" }),
        sub: d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
        date: d,
      })
    }
    return out
  }, [])

  async function create() {
    if (busy || !teamId) return
    if (type !== "PRACTICE" && !title.trim()) {
      setError("Give the event a title.")
      return
    }
    const when = new Date(days[dayIndex].date)
    when.setHours(Math.floor(time / 60), time % 60, 0, 0)
    if (when.getTime() < Date.now()) {
      setError("That time is already in the past.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (type === "PRACTICE") {
        await apiJson(`/api/teams/${teamId}/practices`, {
          method: "POST",
          body: JSON.stringify({
            scheduledAt: when.toISOString(),
            durationMinutes: duration,
            ...(location.trim() ? { location: location.trim() } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          }),
        })
      } else {
        await apiJson(`/api/team-events`, {
          method: "POST",
          body: JSON.stringify({
            teamIds: [teamId],
            title: title.trim(),
            startAt: when.toISOString(),
            durationMinutes: duration,
            eventType: type,
            ...(location.trim() ? { location: location.trim() } : {}),
            ...(notes.trim() ? { description: notes.trim() } : {}),
          }),
        })
      }
      void refresh()
      Alert.alert("On the calendar 📅", "The team has been notified.", [
        { text: "Done", onPress: () => router.back() },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the event")
    } finally {
      setBusy(false)
    }
  }

  const chip = (selected: boolean) => [
    styles.chip,
    selected && { backgroundColor: t.brandSoft, borderColor: t.brand },
  ]
  const chipText = (selected: boolean) => [
    styles.chipText,
    selected && { color: t.brandInk, fontWeight: "800" as const },
  ]

  return (
    <View style={styles.root}>
      <SubHeader title={`New event · ${teamName}`} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.label}>What kind?</Text>
          <View style={styles.chipWrap}>
            {TYPES.map((tp) => (
              <Pressable key={tp.key} style={chip(type === tp.key)} onPress={() => setType(tp.key)}>
                <Ionicons
                  name={tp.icon}
                  size={14}
                  color={type === tp.key ? t.brandInk : ui.textMuted}
                />
                <Text style={chipText(type === tp.key)}>{tp.label}</Text>
              </Pressable>
            ))}
          </View>
          {type !== "PRACTICE" ? (
            <TextInput
              style={styles.input}
              placeholder="Title (e.g. Film session, Open gym)"
              placeholderTextColor={ui.textFaint}
              value={title}
              onChangeText={setTitle}
              maxLength={150}
            />
          ) : null}
        </Card>

        <Card>
          <Text style={styles.label}>When?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {days.map((d, i) => (
              <Pressable
                key={d.sub}
                style={[styles.dayChip, i === dayIndex && { backgroundColor: t.brand, borderColor: t.brand }]}
                onPress={() => setDayIndex(i)}
              >
                <Text style={[styles.dayChipLabel, i === dayIndex && { color: t.brandOn }]}>{d.label}</Text>
                <Text style={[styles.dayChipSub, i === dayIndex && { color: t.brandOn }]}>{d.sub}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setTime((v) => Math.max(MIN_TIME, v - 15))}
            >
              <Ionicons name="remove" size={18} color={ui.text} />
            </Pressable>
            <View style={styles.stepValue}>
              <Text style={styles.stepValueText}>{fmtTime(time)}</Text>
            </View>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setTime((v) => Math.min(MAX_TIME, v + 15))}
            >
              <Ionicons name="add" size={18} color={ui.text} />
            </Pressable>
          </View>
          <View style={styles.chipWrap}>
            {[60, 90, 120].map((d) => (
              <Pressable key={d} style={chip(duration === d)} onPress={() => setDuration(d)}>
                <Text style={chipText(duration === d)}>{d} min</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.label}>Details</Text>
          <TextInput
            style={styles.input}
            placeholder="Location (gym, court, address)"
            placeholderTextColor={ui.textFaint}
            value={location}
            onChangeText={setLocation}
            maxLength={200}
          />
          <TextInput
            style={[styles.input, styles.notes]}
            placeholder={type === "PRACTICE" ? "Notes for families (optional)" : "Description (optional)"}
            placeholderTextColor={ui.textFaint}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={type === "PRACTICE" ? "Add practice" : "Add event"}
          onPress={create}
          busy={busy}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: ui.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: ui.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: ui.surface,
  },
  chipText: { fontSize: 13.5, fontWeight: "600", color: ui.text },
  dayRow: { gap: 8, paddingVertical: 2 },
  dayChip: {
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.md,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: ui.surface,
    minWidth: 64,
  },
  dayChipLabel: { fontSize: 13, fontWeight: "800", color: ui.text },
  dayChipSub: { fontSize: 11.5, color: ui.textMuted, marginTop: 1 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ui.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ui.surface,
  },
  stepValue: {
    flex: 1,
    alignItems: "center",
    borderRadius: ui.radius.md,
    backgroundColor: ui.surfaceSunken,
    paddingVertical: 10,
  },
  stepValueText: { fontSize: 17, fontWeight: "800", color: ui.text, fontVariant: ["tabular-nums"] },
  input: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: ui.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: ui.text,
    backgroundColor: ui.surface,
    marginTop: 6,
  },
  notes: { minHeight: 72, textAlignVertical: "top" },
  error: { color: ui.danger, fontSize: 14, textAlign: "center" },
})
