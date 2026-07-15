import { useCallback, useMemo, useState } from "react"
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { TopBar } from "@/components/top-bar"
import { AgendaList } from "@/components/agenda-list"
import { Loading } from "@/components/ui"
import { useMyCalendar } from "@/lib/calendar"
import { useHome } from "@/lib/home"
import { ui } from "@/lib/theme"

/**
 * Calendar — TeamSnap-style agenda (owner 2026-07-15): sticky day headers
 * with a clear date block beside each day's events, mirroring the mobile
 * web. Same /api/calendar/mine feed, lens filter chips, inline RSVP.
 */
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

  const items = useMemo(() => {
    if (!calendar) return []
    const now = Date.now()
    return calendar.items
      .filter((i) => (showPast ? true : new Date(i.at).getTime() >= now - 3 * 60 * 60 * 1000))
      .filter((i) => (lensFilter ? i.lensKeys.includes(lensFilter) : true))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
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

      {!loaded || !calendar ? (
        <Loading />
      ) : (
        <AgendaList
          items={items}
          calendar={calendar}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          header={
            <Pressable onPress={() => setShowPast((v) => !v)} hitSlop={8}>
              <Text style={styles.pastToggle}>
                {showPast ? "Hide past events ▴" : "Show past events ▾"}
              </Text>
            </Pressable>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
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
  pastToggle: {
    textAlign: "center",
    color: ui.primary,
    fontWeight: "700",
    fontSize: 12,
    paddingVertical: 8,
  },
})
