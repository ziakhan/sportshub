import { useCallback, useEffect, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, Loading, TonePill } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { useRealtime } from "@/lib/realtime"
import { palette, ui } from "@/lib/theme"

/**
 * Game detail — hero score + status from GET /api/live/[gameId] (public).
 * Live games re-fetch on game.update pings, with polling fallback. This is
 * where push taps for game finals land.
 */

interface GameDetail {
  game: {
    id: string
    status: string
    scheduledAt: string
    homeScore: number | null
    awayScore: number | null
    homeTeamName: string
    awayTeamName: string
    homeColor: string | null
    awayColor: string | null
    homeRecord: { record: string; rank: number; divisionName: string } | null
    awayRecord: { record: string; rank: number; divisionName: string } | null
    venueName: string | null
    leagueName: string | null
    seasonName: string | null
  }
}

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [data, setData] = useState<GameDetail | null>(null)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await apiJson<GameDetail>(`/api/live/${id}`))
      setError(false)
    } catch {
      setError(true)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const isLive = data?.game.status === "LIVE"
  const { connected } = useRealtime({
    rooms: [`game:${id}`],
    events: { "game.update": () => void load() },
  })

  useEffect(() => {
    if (!isLive) return
    const timer = setInterval(load, connected ? 60_000 : 15_000)
    return () => clearInterval(timer)
  }, [isLive, connected, load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  if (error && !data) {
    return (
      <View style={styles.root}>
        <SubHeader title="Game" />
        <EmptyState icon="basketball-outline" title="Couldn't load this game" body="Pull to retry." />
      </View>
    )
  }
  if (!data) {
    return (
      <View style={styles.root}>
        <SubHeader title="Game" />
        <Loading />
      </View>
    )
  }

  const g = data.game
  const done = g.status === "COMPLETED"

  return (
    <View style={styles.root}>
      <SubHeader title={g.leagueName ?? "Game"} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card style={styles.hero}>
          {isLive ? (
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : (
            <TonePill
              tone={done ? "neutral" : "info"}
              label={
                done
                  ? "Final"
                  : new Date(g.scheduledAt).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
              }
            />
          )}

          {[
            { name: g.homeTeamName, score: g.homeScore, color: g.homeColor, record: g.homeRecord },
            { name: g.awayTeamName, score: g.awayScore, color: g.awayColor, record: g.awayRecord },
          ].map((team, i) => (
            <View key={i} style={styles.teamRow}>
              <View style={[styles.teamDot, { backgroundColor: team.color ?? ui.borderStrong }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.teamName} numberOfLines={1}>
                  {team.name}
                </Text>
                {team.record ? (
                  <Text style={styles.record}>
                    {team.record.record} · #{team.record.rank} {team.record.divisionName}
                  </Text>
                ) : null}
              </View>
              {isLive || done ? <Text style={styles.score}>{team.score ?? 0}</Text> : null}
            </View>
          ))}

          <Text style={styles.meta}>
            {[g.seasonName, g.venueName].filter(Boolean).join(" · ")}
          </Text>
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  hero: { gap: 10, padding: 18 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ui.live },
  liveText: { color: palette.court[700], fontWeight: "800", fontSize: 12 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  teamDot: { width: 12, height: 12, borderRadius: 6 },
  teamName: { fontSize: 17, fontWeight: "700", color: ui.text },
  record: { fontSize: 12, color: ui.textMuted },
  score: { fontSize: 26, fontWeight: "800", color: ui.text, minWidth: 44, textAlign: "right" },
  meta: { fontSize: 12, color: ui.textMuted, marginTop: 4 },
})
