import { useCallback, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, Pressable, View } from "react-native"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"
import { apiBaseUrl } from "@/lib/api"
import { useHome } from "@/lib/home"
import { palette, ui } from "@/lib/theme"

/**
 * Calendar (stage 1) — the personal week across every lens, from the same
 * resolver as the web home band. Month/list views live on the web calendar;
 * a native month grid is the stage-2 follow-up.
 */

export default function CalendarScreen() {
  const { home, refresh } = useHome()
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const events = home?.contexts.weekEvents ?? []

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.heading}>Next 7 days</Text>
      {events.length === 0 ? (
        <Text style={styles.muted}>Nothing scheduled this week.</Text>
      ) : (
        events.map((e) => (
          <View key={e.item.id} style={styles.card}>
            <Text style={styles.when}>
              {new Date(e.item.startsAt).toLocaleString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
            <Text style={styles.title}>{e.item.title}</Text>
            {e.item.location ? <Text style={styles.muted}>{e.item.location}</Text> : null}
            <View style={styles.chipRow}>
              {e.chips.map((chip) => (
                <Text key={chip} style={styles.chip}>
                  {chip}
                </Text>
              ))}
              {e.awaitingRsvp.length > 0 ? (
                <Text style={[styles.chip, styles.chipWarn]}>RSVP: {e.awaitingRsvp.join(", ")}</Text>
              ) : null}
            </View>
          </View>
        ))
      )}
      <Pressable
        style={({ pressed }) => [styles.webButton, pressed && { opacity: 0.7 }]}
        onPress={() => void WebBrowser.openBrowserAsync(`${apiBaseUrl()}/calendar`)}
      >
        <Ionicons name="calendar-outline" size={16} color="#fff" />
        <Text style={styles.webButtonText}>Open full calendar</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.background },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  heading: { fontSize: 18, fontWeight: "800", color: ui.text },
  card: {
    backgroundColor: ui.surface,
    borderRadius: ui.radius.md,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 12,
    gap: 2,
  },
  when: { fontSize: 12, fontWeight: "700", color: palette.play[700] },
  title: { fontSize: 15, color: ui.text, fontWeight: "600" },
  muted: { fontSize: 13, color: ui.textMuted },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chip: {
    fontSize: 11,
    color: ui.textMuted,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  chipWarn: { color: "#9a3412", borderColor: "#fdba74", backgroundColor: "#fff7ed" },
  webButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ui.primary,
    borderRadius: ui.radius.md,
    paddingVertical: 12,
    marginTop: 8,
  },
  webButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
})
