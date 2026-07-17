import { useState } from "react"
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { apiJson } from "@/lib/api"
import { Card, TonePill } from "@/components/ui"
import {
  putRsvp,
  rsvpKeyOf,
  type CalItem,
  type MyCalendar,
  type RsvpStatus,
} from "@/lib/calendar"
import { palette, ui } from "@/lib/theme"
import { useTheme } from "@/lib/theme-context"

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
  onChanged,
}: {
  item: CalItem
  calendar: MyCalendar
  /** Limit RSVP rows to one player (kid detail screen). */
  playerFilter?: string
  /** Called after a cancel/restore so the parent list refreshes. */
  onChanged?: () => void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
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

  const t = useTheme()
  const kindEdge =
    item.kind === "game" ? t.energy : item.kind === "practice" ? ui.primary : palette.gold[500]

  // Role-gated actions (web parity): staff cancel practices/events; league
  // managers postpone/cancel games. Server re-checks — these only gate UI.
  const isStaff = item.teamIds.some((tid) => calendar.teams.find((t) => t.teamId === tid)?.staff)
  const isLeagueMgr = item.lensKeys.some((k) => k.startsWith("lg:"))
  const runAction = async (verb: "cancel" | "restore" | "postpone") => {
    setActionBusy(true)
    try {
      if (item.kind === "practice") {
        await apiJson(`/api/teams/${item.teamIds[0]}/practices/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: verb === "cancel" ? "cancel" : "restore" }),
        })
      } else if (item.kind === "event") {
        await apiJson(`/api/team-events/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: verb === "cancel" ? "CANCELLED" : "SCHEDULED" }),
        })
      } else {
        await apiJson(`/api/games/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: verb === "postpone" ? "POSTPONED" : verb === "cancel" ? "CANCELLED" : "SCHEDULED",
          }),
        })
      }
      setSheetOpen(false)
      onChanged?.()
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Try again.")
    } finally {
      setActionBusy(false)
    }
  }
  const confirmAction = (verb: "cancel" | "postpone") => {
    const noun = item.kind === "game" ? "game" : item.kind
    Alert.alert(
      `${verb === "postpone" ? "Postpone" : "Cancel"} this ${noun}?`,
      "Everyone affected is notified.",
      [
        { text: "Back", style: "cancel" },
        { text: verb === "postpone" ? "Postpone" : `Cancel ${noun}`, style: "destructive", onPress: () => void runAction(verb) },
      ]
    )
  }
  const hasActions = item.kind === "game" ? true : isStaff


  return (
    <Card
      style={[styles.card, { borderLeftWidth: 4, borderLeftColor: kindEdge }]}
      onPress={hasActions ? () => setSheetOpen(true) : undefined}
    >
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

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {item.kind === "game" ? "Game" : item.kind === "practice" ? "Practice" : item.title}
            </Text>
            <Text style={styles.sheetSub}>
              {timeRange}
              {item.location ? ` · ${item.location}` : ""}
            </Text>
            {item.kind === "game" ? (
              <Pressable
                style={styles.sheetAction}
                onPress={() => {
                  setSheetOpen(false)
                  router.push(`/browse/game/${item.id}`)
                }}
              >
                <Text style={styles.sheetActionText}>Open game page →</Text>
              </Pressable>
            ) : null}
            {item.kind !== "game" && isStaff && !cancelled ? (
              <Pressable style={[styles.sheetAction, styles.sheetDanger]} disabled={actionBusy} onPress={() => confirmAction("cancel")}>
                <Text style={styles.sheetDangerText}>
                  Cancel {item.kind === "practice" ? "practice" : "event"}
                </Text>
              </Pressable>
            ) : null}
            {item.kind !== "game" && isStaff && cancelled ? (
              <Pressable style={[styles.sheetAction, styles.sheetPositive]} disabled={actionBusy} onPress={() => void runAction("restore")}>
                <Text style={styles.sheetPositiveText}>
                  Restore {item.kind === "practice" ? "practice" : "event"}
                </Text>
              </Pressable>
            ) : null}
            {item.kind === "game" && isLeagueMgr && item.status === "SCHEDULED" ? (
              <>
                <Pressable style={[styles.sheetAction, styles.sheetWarn]} disabled={actionBusy} onPress={() => confirmAction("postpone")}>
                  <Text style={styles.sheetWarnText}>Postpone game</Text>
                </Pressable>
                <Pressable style={[styles.sheetAction, styles.sheetDanger]} disabled={actionBusy} onPress={() => confirmAction("cancel")}>
                  <Text style={styles.sheetDangerText}>Cancel game</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable style={styles.sheetAction} onPress={() => setSheetOpen(false)}>
              <Text style={styles.sheetCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 34,
    gap: 8,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: ui.text },
  sheetSub: { fontSize: 13, color: ui.textMuted, marginBottom: 6 },
  sheetAction: {
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: 13,
    paddingVertical: 12,
    alignItems: "center",
  },
  sheetActionText: { fontSize: 14.5, fontWeight: "800", color: ui.text },
  sheetDanger: { borderColor: palette.hoop[200], backgroundColor: palette.hoop[50] },
  sheetDangerText: { fontSize: 14.5, fontWeight: "800", color: palette.hoop[700] },
  sheetWarn: { borderColor: "#fcd34d", backgroundColor: "#fffbeb" },
  sheetWarnText: { fontSize: 14.5, fontWeight: "800", color: "#b45309" },
  sheetPositive: { borderColor: palette.court[200], backgroundColor: palette.court[50] },
  sheetPositiveText: { fontSize: 14.5, fontWeight: "800", color: palette.court[700] },
  sheetCloseText: { fontSize: 14.5, fontWeight: "700", color: ui.textMuted },
})
