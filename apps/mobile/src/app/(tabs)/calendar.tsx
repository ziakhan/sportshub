import { useCallback, useMemo, useState } from "react"
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { TopBar } from "@/components/top-bar"
import { EventCard } from "@/components/event-card"
import { EmptyState, Loading } from "@/components/ui"
import { useMyCalendar, type CalItem } from "@/lib/calendar"
import { useHome } from "@/lib/home"
import { ui } from "@/lib/theme"

/**
 * Calendar — the FULL personal agenda (same /api/calendar/mine feed as the
 * web calendar): every practice/game/event across every lens, grouped by
 * day, lens filter chips, inline RSVP. Native replaces the old "open full
 * calendar on the web" punt.
 */

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today"
  if (dayKey(iso) === dayKey(tomorrow.toISOString())) return "Tomorrow"
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
}

export default function CalendarScreen() {
  const { calendar, loaded, refresh } = useMyCalendar()
  const { home } = useHome()
  const [refreshing, setRefreshing] = useState(false)
  const [lensFilter, setLensFilter] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const groups = useMemo(() => {
    if (!calendar) return []
    const now = Date.now()
    const items = calendar.items
      .filter((i) => (showPast ? true : new Date(i.at).getTime() >= now - 3 * 60 * 60 * 1000))
      .filter((i) => (lensFilter ? i.lensKeys.includes(lensFilter) : true))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    const byDay = new Map<string, CalItem[]>()
    for (const item of items) {
      const key = dayKey(item.at)
      byDay.set(key, [...(byDay.get(key) ?? []), item])
    }
    return [...byDay.entries()]
  }, [calendar, lensFilter, showPast])

  return (
    <View style={styles.root}>
      <TopBar unread={home?.unreadNotifications ?? 0} />
      {calendar && calendar.lenses.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.lensRow}
          contentContainerStyle={styles.lensRowContent}
        >
          <Pressable
            style={[styles.lensChip, lensFilter === null && styles.lensChipOn]}
            onPress={() => setLensFilter(null)}
          >
            <Text style={[styles.lensText, lensFilter === null && styles.lensTextOn]}>All</Text>
          </Pressable>
          {calendar.lenses.map((lens) => (
            <Pressable
              key={lens.key}
              style={[styles.lensChip, lensFilter === lens.key && styles.lensChipOn]}
              onPress={() => setLensFilter((cur) => (cur === lens.key ? null : lens.key))}
            >
              <Text style={[styles.lensText, lensFilter === lens.key && styles.lensTextOn]}>
                {lens.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!loaded ? <Loading /> : null}
        {loaded && groups.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="Nothing scheduled"
            body="Practices, games and team events land here."
          />
        ) : null}
        {groups.map(([key, items]) => (
          <View key={key} style={styles.dayGroup}>
            <Text style={styles.dayHeading}>{dayLabel(items[0].at)}</Text>
            {items.map((item) => (
              <EventCard key={`${item.kind}:${item.id}`} item={item} calendar={calendar!} />
            ))}
          </View>
        ))}
        {loaded && calendar ? (
          <Pressable onPress={() => setShowPast((v) => !v)} hitSlop={8}>
            <Text style={styles.pastToggle}>
              {showPast ? "Hide past events" : "Show past events"}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  lensRow: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    flexGrow: 0,
  },
  lensRowContent: { gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  lensChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ui.borderStrong,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  lensChipOn: { backgroundColor: ui.primary, borderColor: ui.primary },
  lensText: { fontSize: 12, fontWeight: "600", color: ui.textMuted },
  lensTextOn: { color: "#fff" },
  dayGroup: { gap: 8 },
  dayHeading: { fontSize: 14, fontWeight: "800", color: ui.text, marginTop: 4 },
  pastToggle: {
    textAlign: "center",
    color: ui.primary,
    fontWeight: "700",
    fontSize: 13,
    paddingVertical: 8,
  },
})
