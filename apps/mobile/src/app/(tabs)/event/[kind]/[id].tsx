import { useMemo, useState } from "react"
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, Loading, SectionHeader, TonePill } from "@/components/ui"
import { apiBaseUrl } from "@/lib/api"
import { putRsvp, rsvpKeyOf, useMyCalendar, type CalTeam, type RsvpStatus } from "@/lib/calendar"
import { palette, ui } from "@/lib/theme"

/**
 * Lightweight practice/team-event detail (native-parity gap 2) — practices
 * and team events used to be dead taps everywhere except the staff cancel
 * sheet. Pulled from the same /api/calendar/mine payload the rest of the
 * app already has loaded (no new endpoint): title/type, date/time, venue
 * (tappable to the web venue page when there's a venueId), notes, RSVP,
 * and a link back to the team. Games keep their own /browse/game screen.
 */

const STATUS_LABEL: Record<RsvpStatus, string> = {
  GOING: "Going",
  MAYBE: "Maybe",
  NOT_GOING: "Out",
}

export default function EventDetailScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>()
  const { calendar, loaded } = useMyCalendar()
  const [local, setLocal] = useState<Record<string, RsvpStatus>>({})
  const [failed, setFailed] = useState(false)

  const item = useMemo(
    () => calendar?.items.find((i) => i.kind === kind && i.id === id) ?? null,
    [calendar, kind, id]
  )

  const isPractice = kind === "practice"
  const fallbackTitle = isPractice ? "Practice" : "Event"

  if (!loaded) {
    return (
      <View style={styles.root}>
        <SubHeader title={fallbackTitle} />
        <Loading />
      </View>
    )
  }
  if (!item) {
    return (
      <View style={styles.root}>
        <SubHeader title={fallbackTitle} />
        <EmptyState
          icon="calendar-outline"
          title="Couldn't find this on your calendar"
          body="It may be outside the current schedule window."
        />
      </View>
    )
  }

  const teams = item.teamIds
    .map((tid) => calendar!.teams.find((t) => t.teamId === tid))
    .filter((t): t is CalTeam => !!t)

  const title = item.kind === "practice" ? "Practice" : item.title
  const cancelled = item.status === "CANCELLED"
  const when = new Date(item.at)
  const end = new Date(when.getTime() + (item.durationMinutes ?? 0) * 60_000)
  const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  const key = rsvpKeyOf(item)
  const players = item.teamIds.flatMap((tid) => calendar!.rsvp.playersByTeam[tid] ?? [])
  const seen = new Set<string>()
  const uniquePlayers = players.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))

  const typeLabel =
    item.kind === "event" && item.eventType && item.eventType !== "OTHER"
      ? item.eventType.toLowerCase().replace("workout", "workout/lift")
      : item.kind

  async function setStatus(playerId: string, status: RsvpStatus) {
    setLocal((cur) => ({ ...cur, [playerId]: status }))
    setFailed(false)
    try {
      await putRsvp(item!, playerId, status)
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
    <View style={styles.root}>
      <SubHeader title={title} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.top}>
            <TonePill tone={isPractice ? "positive" : "gold"} label={typeLabel} />
            {cancelled ? <TonePill tone="danger" label="Cancelled" /> : null}
          </View>
          <Text style={[styles.title, cancelled && styles.cancelled]}>{title}</Text>
          <Text style={styles.when}>
            {when.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          <Text style={styles.when}>
            {fmtTime(when)} – {fmtTime(end)}
          </Text>
          {item.location ? (
            <Pressable
              disabled={!item.venueId}
              onPress={() =>
                item.venueId ? void Linking.openURL(`${apiBaseUrl()}/venues/${item.venueId}`) : undefined
              }
              style={styles.venueRow}
            >
              <Ionicons name="location-outline" size={15} color={item.venueId ? ui.primary : ui.textMuted} />
              <Text style={[styles.venue, item.venueId && styles.venueLink]}>{item.location}</Text>
              {item.venueId ? <Ionicons name="chevron-forward" size={13} color={ui.primary} /> : null}
            </Pressable>
          ) : null}
          {teams.map((t) => (
            <Pressable
              key={t.teamId}
              style={styles.teamRow}
              onPress={() => router.push(`/team/${t.teamId}`)}
            >
              <Ionicons name="people-outline" size={15} color={ui.primary} />
              <Text style={styles.teamLink}>{t.teamName}</Text>
              <Ionicons name="chevron-forward" size={13} color={ui.primary} />
            </Pressable>
          ))}
        </Card>

        {item.detail ? (
          <>
            <SectionHeader eyebrow="Details" title="Notes" accent="ink" />
            <Card>
              <Text style={styles.notes}>{item.detail}</Text>
            </Card>
          </>
        ) : null}

        {!cancelled && uniquePlayers.length > 0 ? (
          <>
            <SectionHeader eyebrow="Your family" title="RSVP" accent="play" />
            <Card>
              {uniquePlayers.map((p) => {
                const current: RsvpStatus | undefined = local[p.id] ?? calendar!.rsvp.byItem[key]?.[p.id]?.status
                return (
                  <View key={p.id} style={styles.rsvpRow}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {p.name}
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
                            <Text style={[styles.rsvpText, on && styles.rsvpTextOn]}>{STATUS_LABEL[status]}</Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>
                )
              })}
              {failed ? <Text style={styles.error}>Couldn&apos;t save — tap again.</Text> : null}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  top: { flexDirection: "row", gap: 8 },
  title: { fontSize: 19, fontWeight: "800", color: ui.text, marginTop: 8 },
  cancelled: { textDecorationLine: "line-through", color: ui.textMuted },
  when: { fontSize: 13.5, color: ui.textMuted, marginTop: 3, fontWeight: "600" },
  venueRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  venue: { fontSize: 13.5, color: ui.text, fontWeight: "600", flexShrink: 1 },
  venueLink: { color: ui.primary },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  teamLink: { fontSize: 13.5, color: ui.primary, fontWeight: "700" },
  notes: { fontSize: 14, color: ui.text, lineHeight: 20 },
  rsvpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 8,
  },
  playerName: { fontSize: 14, fontWeight: "600", color: ui.text, flexShrink: 1 },
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
  rsvpText: { fontSize: 13, fontWeight: "700", color: ui.textMuted },
  rsvpTextOn: { color: "#fff" },
  error: { fontSize: 12, color: palette.hoop[600], marginTop: 4 },
})
