import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import {
  Card,
  EmptyState,
  Loading,
  OutlineButton,
  PrimaryButton,
  SectionHeader,
  TonePill,
} from "@/components/ui"
import { apiJson } from "@/lib/api"
import { useMyCalendar } from "@/lib/calendar"
import { ui } from "@/lib/theme"

/**
 * Referee kit — assigned games (from the personal calendar's referee lens)
 * plus shift requests with native accept/decline. Replaces the /referee
 * web punt.
 */

interface ShiftRequest {
  id: string
  leagueName: string
  date: string
  sessionLabel: string
  seasonLabel: string
  window: string
  message: string | null
  status: string
  broadcast: boolean
  mine: boolean
}

export default function RefereeScreen() {
  const { calendar, refresh: refreshCalendar } = useMyCalendar()
  const [requests, setRequests] = useState<ShiftRequest[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ requests: ShiftRequest[] }>("/api/referee/requests")
      setRequests(data.requests)
    } catch {
      setRequests((cur) => cur ?? [])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([load(), refreshCalendar()])
    setRefreshing(false)
  }, [load, refreshCalendar])

  const myGames = useMemo(() => {
    if (!calendar) return []
    const refLenses = new Set(
      calendar.lenses.filter((l) => l.kind === "referee").map((l) => l.key)
    )
    if (refLenses.size === 0) return []
    const now = Date.now()
    return calendar.items
      .filter(
        (i) => i.lensKeys.some((k) => refLenses.has(k)) && new Date(i.at).getTime() >= now - 3 * 3600_000
      )
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .slice(0, 15)
  }, [calendar])

  async function resolve(id: string, action: "accept" | "decline") {
    setBusyId(id)
    try {
      await apiJson(`/api/referee-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      })
      await load()
      if (action === "accept") Alert.alert("You're on it 🏀", "Games were assigned to you.")
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Try again.")
    } finally {
      setBusyId(null)
    }
  }

  const open = requests?.filter((r) => r.status === "PENDING") ?? []
  const accepted = requests?.filter((r) => r.status === "ACCEPTED" && r.mine) ?? []

  return (
    <View style={styles.root}>
      <SubHeader title="Refereeing" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {requests === null ? <Loading /> : null}

        {open.length > 0 ? (
          <>
            <SectionHeader eyebrow="Needs an answer" title="Shift requests" accent="hoop" />
            {open.map((r) => (
              <Card key={r.id}>
                <View style={styles.top}>
                  <TonePill tone={r.broadcast ? "info" : "warning"} label={r.broadcast ? "Open shift" : "For you"} />
                  <Text style={styles.window}>{r.window}</Text>
                </View>
                <Text style={styles.title}>
                  {r.leagueName} · {r.sessionLabel}
                </Text>
                <Text style={styles.meta}>
                  {new Date(r.date).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {r.seasonLabel}
                </Text>
                {r.message ? <Text style={styles.meta}>{r.message}</Text> : null}
                <View style={styles.actions}>
                  <PrimaryButton
                    label="Accept"
                    onPress={() => void resolve(r.id, "accept")}
                    busy={busyId === r.id}
                    style={{ flex: 1 }}
                  />
                  <OutlineButton
                    label="Decline"
                    onPress={() => void resolve(r.id, "decline")}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        <SectionHeader eyebrow="Assigned" title="My games" accent="court" />
        {calendar && myGames.length === 0 ? (
          <EmptyState
            icon="flag-outline"
            title="No games assigned"
            body="Accepted shifts and assigned games land here."
          />
        ) : null}
        {myGames.map((g) => (
          <Card
            key={`${g.kind}:${g.id}`}
            onPress={g.kind === "game" ? () => router.push(`/browse/game/${g.id}`) : undefined}
          >
            <View style={styles.top}>
              <TonePill tone="positive" label="Assigned" />
              <Text style={styles.window}>
                {new Date(g.at).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <Text style={styles.title}>{g.title}</Text>
            {g.location ? <Text style={styles.meta}>{g.location}</Text> : null}
          </Card>
        ))}

        {accepted.length > 0 ? (
          <>
            <SectionHeader eyebrow="Booked" title="Accepted shifts" accent="play" />
            {accepted.map((r) => (
              <Card key={r.id}>
                <Text style={styles.title}>
                  {r.leagueName} · {r.sessionLabel}
                </Text>
                <Text style={styles.meta}>
                  {new Date(r.date).toLocaleDateString()} · {r.window}
                </Text>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  window: { fontSize: 12, fontWeight: "800", color: ui.primaryInk },
  title: { fontSize: 15, fontWeight: "700", color: ui.text, marginTop: 2 },
  meta: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
})
