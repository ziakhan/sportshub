import { useCallback, useEffect, useState } from "react"
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Monogram, TonePill } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { useRealtime } from "@/lib/realtime"
import { fonts, tones, ui } from "@/lib/theme"

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
  const decided = isFinal
  const homeWon = decided && (game.homeScore ?? 0) > (game.awayScore ?? 0)
  const awayWon = decided && (game.awayScore ?? 0) > (game.homeScore ?? 0)
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
      onPress={() => router.push(`/browse/game/${game.id}`)}
    >
      <View style={styles.cardHeader}>
        <TonePill
          tone={isLive ? "danger" : isFinal ? "neutral" : "info"}
          label={isLive ? "Live" : isFinal ? "Final" : timeLabel(game.scheduledAt)}
        />
        {game.league ? (
          <Text style={styles.leagueText} numberOfLines={1}>
            {game.league}
          </Text>
        ) : null}
      </View>
      {[
        { team: game.homeTeam, score: game.homeScore, won: homeWon, lost: decided && !homeWon },
        { team: game.awayTeam, score: game.awayScore, won: awayWon, lost: decided && !awayWon },
      ].map(({ team, score, won, lost }, i) => (
        <View key={i} style={styles.teamRow}>
          <Monogram name={team.name} color={team.color} size={28} />
          <Text
            style={[styles.teamName, won && styles.teamNameWon, lost && styles.teamNameLost]}
            numberOfLines={1}
          >
            {team.name}
          </Text>
          {isLive || isFinal ? (
            <Text style={[styles.score, won && styles.scoreWon, lost && styles.scoreLost]}>
              {score ?? 0}
            </Text>
          ) : null}
        </View>
      ))}
      {game.venue ? <Text style={styles.venue}>{game.venue}</Text> : null}
    </Pressable>
  )
}

function Section({
  title,
  games,
  accent,
}: {
  title: string
  games: ScoreGame[]
  accent: "danger" | "neutral" | "info"
}) {
  if (games.length === 0) return null
  return (
    <View style={styles.section}>
      <View style={styles.sectionBar}>
        <View style={[styles.sectionDot, { backgroundColor: tones[accent].fg }]} />
        <Text style={[styles.sectionTitle, { color: tones[accent].fg }]}>{title}</Text>
      </View>
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
    <View style={styles.root}>
      <SubHeader title="Live scores" />
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
            <Section title="Live now" games={board.live} accent="danger" />
            <Section title="This week’s finals" games={board.finals} accent="neutral" />
            <Section title="Coming up" games={board.upcoming} accent="info" />
            {board.live.length + board.finals.length + board.upcoming.length === 0 ? (
              <Text style={styles.empty}>No games this week.</Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, gap: 8 },
  section: { marginBottom: 16 },
  sectionBar: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  sectionDot: { width: 7, height: 7, borderRadius: 3.5 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: ui.radius.md,
    padding: 12,
    marginBottom: 8,
    backgroundColor: ui.surface,
    gap: 8,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  leagueText: { flex: 1, color: ui.textMuted, fontSize: 12.5, fontWeight: "600", textAlign: "right", marginLeft: 8 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  teamName: { flex: 1, fontSize: 15.5, fontWeight: "600", color: ui.text },
  teamNameWon: { fontWeight: "800", color: ui.text },
  teamNameLost: { color: ui.textMuted },
  score: {
    fontSize: 24,
    fontFamily: fonts.condensed,
    color: ui.textMuted,
    minWidth: 36,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  scoreWon: { color: ui.text },
  scoreLost: { color: ui.textFaint },
  venue: { fontSize: 12.5, color: ui.textFaint, marginTop: 2 },
  empty: { textAlign: "center", color: ui.textMuted, marginTop: 48, fontSize: 15 },
})
