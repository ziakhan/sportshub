import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Card, TonePill } from "@/components/ui"
import {
  putRsvp,
  rsvpKeyOf,
  type CalItem,
  type MyCalendar,
  type RsvpStatus,
} from "@/lib/calendar"
import { palette, ui } from "@/lib/theme"

/**
 * One calendar item with inline RSVP (Going / Maybe / Not going) per family
 * player — the web calendar's row, native. Optimistic: taps update locally
 * and PUT /api/rsvp in the background.
 */

const STATUS_LABEL: Record<RsvpStatus, string> = {
  GOING: "Going",
  MAYBE: "Maybe",
  NOT_GOING: "Out",
}

export function EventCard({
  item,
  calendar,
  playerFilter,
}: {
  item: CalItem
  calendar: MyCalendar
  /** Limit RSVP rows to one player (kid detail screen). */
  playerFilter?: string
}) {
  const key = rsvpKeyOf(item)
  const [local, setLocal] = useState<Record<string, RsvpStatus>>({})
  const [failed, setFailed] = useState(false)

  // Family players on this item's teams — the people who can RSVP.
  const seen = new Set<string>()
  const players: Array<{ id: string; name: string }> = []
  for (const teamId of item.teamIds) {
    for (const p of calendar.rsvp.playersByTeam[teamId] ?? []) {
      if (seen.has(p.id) || (playerFilter && p.id !== playerFilter)) continue
      seen.add(p.id)
      players.push(p)
    }
  }

  const when = new Date(item.at)
  const end = new Date(when.getTime() + (item.durationMinutes ?? 0) * 60_000)
  const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  const startStr = fmt(when)
  const endStr = fmt(end)
  const samePeriod = startStr.slice(-2) === endStr.slice(-2)
  // "6:30 – 8:00 PM" — drop the start's AM/PM when it matches the end's
  const timeRange = `${samePeriod ? startStr.replace(/\s?[AP]M$/i, "") : startStr} – ${endStr}`
  const label =
    item.kind === "practice"
      ? "Practice"
      : item.kind === "game"
        ? item.opponent
          ? `vs ${item.opponent}`
          : item.title
        : item.title
  const teamName =
    calendar.teams.length > 1 && item.teamIds.length === 1
      ? calendar.teams.find((t) => t.teamId === item.teamIds[0])?.teamName
      : null
  const cancelled = item.status === "CANCELLED"

  async function setStatus(playerId: string, status: RsvpStatus) {
    setLocal((cur) => ({ ...cur, [playerId]: status }))
    setFailed(false)
    try {
      await putRsvp(item, playerId, status)
    } catch {
      setLocal((cur) => {
        const next = { ...cur }
        delete next[playerId]
        return next
      })
      setFailed(true)
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.when}>{timeRange}</Text>
        <TonePill
          tone={item.kind === "game" ? "info" : item.kind === "practice" ? "positive" : "gold"}
          label={
            item.kind === "event" && item.eventType && item.eventType !== "OTHER"
              ? item.eventType.toLowerCase().replace("workout", "workout/lift")
              : item.kind
          }
        />
      </View>
      <Text style={[styles.title, cancelled && styles.cancelled]}>{label}</Text>
      {item.location || teamName ? (
        <Text style={styles.meta}>{[item.location, teamName].filter(Boolean).join(" · ")}</Text>
      ) : null}
      {item.detail ? <Text style={styles.meta}>{item.detail}</Text> : null}
      {cancelled ? <TonePill tone="danger" label="Cancelled" /> : null}

      {!cancelled &&
        players.map((p) => {
          const current: RsvpStatus | undefined =
            local[p.id] ?? calendar.rsvp.byItem[key]?.[p.id]?.status
          return (
            <View key={p.id} style={styles.rsvpRow}>
              <Text style={styles.playerName} numberOfLines={1}>
                {p.name.split(" ")[0]}
              </Text>
              <View style={styles.rsvpButtons}>
                {(Object.keys(STATUS_LABEL) as RsvpStatus[]).map((status) => {
                  const on = current === status
                  return (
                    <Pressable
                      key={status}
                      style={[
                        styles.rsvpButton,
                        on && status === "GOING" && styles.going,
                        on && status === "MAYBE" && styles.maybe,
                        on && status === "NOT_GOING" && styles.notGoing,
                      ]}
                      onPress={() => void setStatus(p.id, status)}
                    >
                      <Text style={[styles.rsvpText, on && styles.rsvpTextOn]}>
                        {STATUS_LABEL[status]}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          )
        })}
      {failed ? <Text style={styles.error}>Couldn’t save — tap again.</Text> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: 3 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  when: { fontSize: 16.5, fontWeight: "800", color: ui.text, fontVariant: ["tabular-nums"] },
  title: { fontSize: 15.5, fontWeight: "800", color: ui.text, marginTop: 1 },
  cancelled: { textDecorationLine: "line-through", color: ui.textMuted },
  meta: { fontSize: 13, color: palette.ink[600] },
  rsvpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    gap: 8,
  },
  playerName: { fontSize: 13, fontWeight: "600", color: ui.text, flexShrink: 1 },
  rsvpButtons: { flexDirection: "row", gap: 6 },
  rsvpButton: {
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  going: { backgroundColor: palette.court[600], borderColor: palette.court[600] },
  maybe: { backgroundColor: palette.gold[500], borderColor: palette.gold[500] },
  notGoing: { backgroundColor: palette.hoop[600], borderColor: palette.hoop[600] },
  rsvpText: { fontSize: 12, fontWeight: "700", color: ui.textMuted },
  rsvpTextOn: { color: "#fff" },
  error: { fontSize: 12, color: palette.hoop[600], marginTop: 4 },
})
