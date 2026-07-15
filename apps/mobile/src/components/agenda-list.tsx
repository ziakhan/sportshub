import { useMemo } from "react"
import { SectionList, StyleSheet, Text, View, type RefreshControlProps } from "react-native"
import { EventCard } from "@/components/event-card"
import { EmptyState } from "@/components/ui"
import type { CalItem, MyCalendar } from "@/lib/calendar"
import { palette, ui } from "@/lib/theme"

/**
 * TeamSnap-style agenda (owner 2026-07-15): a clear DATE BLOCK on the left
 * of each day's events and a STICKY day header that pins while that day
 * scrolls — mirroring the mobile-web calendar.
 */

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function relativeLabel(date: Date): string | null {
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86_400_000)
  if (dayKey(date.toISOString()) === dayKey(today.toISOString())) return "Today"
  if (dayKey(date.toISOString()) === dayKey(tomorrow.toISOString())) return "Tomorrow"
  return null
}

interface Section {
  key: string
  date: Date
  data: CalItem[]
}

export function AgendaList({
  items,
  calendar,
  playerFilter,
  refreshControl,
  emptyTitle = "Nothing scheduled",
  emptyBody = "Practices, games and team events land here.",
  header,
}: {
  items: CalItem[]
  calendar: MyCalendar
  playerFilter?: string
  refreshControl?: React.ReactElement<RefreshControlProps>
  emptyTitle?: string
  emptyBody?: string
  header?: React.ReactElement | null
}) {
  const sections = useMemo<Section[]>(() => {
    const byDay = new Map<string, CalItem[]>()
    for (const item of items) {
      const key = dayKey(item.at)
      byDay.set(key, [...(byDay.get(key) ?? []), item])
    }
    return [...byDay.entries()].map(([key, data]) => ({
      key,
      date: new Date(data[0].at),
      data,
    }))
  }, [items])

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => `${item.kind}:${item.id}`}
      stickySectionHeadersEnabled
      refreshControl={refreshControl}
      ListHeaderComponent={header}
      contentContainerStyle={sections.length === 0 ? styles.emptyWrap : styles.content}
      ListEmptyComponent={<EmptyState icon="calendar-outline" title={emptyTitle} body={emptyBody} />}
      renderSectionHeader={({ section }) => {
        const rel = relativeLabel(section.date)
        return (
          <View style={styles.dayHeader}>
            <Text style={[styles.dayHeaderText, rel === "Today" && styles.todayText]}>
              {rel ? `${rel} · ` : ""}
              {section.date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
        )
      }}
      renderItem={({ item, index, section }) => {
        const isToday = relativeLabel(section.date) === "Today"
        return (
          <View style={styles.row}>
            <View style={styles.dateGutter}>
              {index === 0 ? (
                <View style={[styles.dateBlock, isToday && styles.dateBlockToday]}>
                  <Text style={[styles.dateWeekday, isToday && styles.dateTextToday]}>
                    {section.date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}
                  </Text>
                  <Text style={[styles.dateNumber, isToday && styles.dateTextToday]}>
                    {section.date.getDate()}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardWrap}>
              <EventCard item={item} calendar={calendar} playerFilter={playerFilter} />
            </View>
          </View>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  emptyWrap: { flexGrow: 1, justifyContent: "center" },
  dayHeader: {
    backgroundColor: ui.background,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  dayHeaderText: {
    fontSize: 13,
    fontWeight: "800",
    color: ui.text,
  },
  todayText: { color: palette.play[700] },
  row: { flexDirection: "row", paddingHorizontal: 12, paddingTop: 10 },
  dateGutter: { width: 52, alignItems: "center" },
  dateBlock: {
    width: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ui.border,
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 6,
  },
  dateBlockToday: { backgroundColor: ui.primary, borderColor: ui.primary },
  dateWeekday: { fontSize: 10, fontWeight: "800", color: ui.textMuted, letterSpacing: 0.5 },
  dateNumber: { fontSize: 18, fontWeight: "800", color: ui.text, marginTop: 1 },
  dateTextToday: { color: "#fff" },
  cardWrap: { flex: 1 },
})
