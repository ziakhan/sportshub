import { useCallback, useEffect, useState } from "react"
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { apiJson } from "@/lib/api"
import { useRealtime } from "@/lib/realtime"
import { palette, ui } from "@/lib/theme"

/**
 * Home / Scores — live games, this week's finals, what's coming up.
 * game.update pings on the public scores room refetch immediately; polling
 * stays as the fallback (fast while a game is LIVE, slow otherwise).
 */

interface ScoreTeam {
  id: string | null
  name: string
  color: string | null
}
interface ScoreGame {
  id: string
  status: string
  scheduledAt: string
  homeScore: number | null
  awayScore: number | null
  homeTeam: ScoreTeam
  awayTeam: ScoreTeam
  venue: string | null
  league: string | null
}
interface Scoreboard {
  live: ScoreGame[]
  finals: ScoreGame[]
  upcoming: ScoreGame[]
}

const LIVE_POLL_MS = 15_000
const IDLE_POLL_MS = 60_000

function timeLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function GameCard({ game }: { game: ScoreGame }) {
  const isLive = game.status === "LIVE"
  const isFinal = game.status === "COMPLETED"
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {isLive ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : (
          <Text style={styles.statusText}>{isFinal ? "FINAL" : timeLabel(game.scheduledAt)}</Text>
        )}
        {game.league ? <Text style={styles.leagueText}>{game.league}</Text> : null}
      </View>
      {[
        { team: game.homeTeam, score: game.homeScore },
        { team: game.awayTeam, score: game.awayScore },
      ].map(({ team, score }, i) => (
        <View key={i} style={styles.teamRow}>
          <View style={[styles.teamDot, { backgroundColor: team.color ?? ui.border }]} />
          <Text style={styles.teamName} numberOfLines={1}>
            {team.name}
          </Text>
          {isLive || isFinal ? <Text style={styles.score}>{score ?? 0}</Text> : null}
        </View>
      ))}
      {game.venue ? <Text style={styles.venue}>{game.venue}</Text> : null}
    </View>
  )
}

function Section({ title, games }: { title: string; games: ScoreGame[] }) {
  if (games.length === 0) return null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {games.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </View>
  )
}

export default function ScoresScreen() {
  const [board, setBoard] = useState<Scoreboard | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      setBoard(await apiJson<Scoreboard>("/api/live"))
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const { connected } = useRealtime({
    rooms: ["scores"],
    events: { "game.update": () => void load() },
  })

  const hasLive = (board?.live.length ?? 0) > 0
  useEffect(() => {
    const timer = setInterval(
      load,
      connected ? 120_000 : hasLive ? LIVE_POLL_MS : IDLE_POLL_MS
    )
    return () => clearInterval(timer)
  }, [load, hasLive, connected])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {error && !board ? (
        <Text style={styles.empty}>Couldn’t reach SportsHub — pull to retry.</Text>
      ) : null}
      {board ? (
        <>
          <Section title="Live now" games={board.live} />
          <Section title="This week’s finals" games={board.finals} />
          <Section title="Coming up" games={board.upcoming} />
          {board.live.length + board.finals.length + board.upcoming.length === 0 ? (
            <Text style={styles.empty}>No games this week.</Text>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.background },
  content: { padding: 16, gap: 8 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: ui.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: ui.radius.md,
    padding: 12,
    marginBottom: 8,
    backgroundColor: ui.background,
    gap: 6,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ui.live },
  liveText: { color: palette.court[700], fontWeight: "800", fontSize: 12 },
  statusText: { color: ui.textMuted, fontSize: 12, fontWeight: "600" },
  leagueText: { color: ui.textMuted, fontSize: 12 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  teamDot: { width: 10, height: 10, borderRadius: 5 },
  teamName: { flex: 1, fontSize: 16, fontWeight: "600", color: ui.text },
  score: { fontSize: 18, fontWeight: "800", color: ui.text, minWidth: 32, textAlign: "right" },
  venue: { fontSize: 12, color: ui.textMuted },
  empty: { textAlign: "center", color: ui.textMuted, marginTop: 48, fontSize: 15 },
})
