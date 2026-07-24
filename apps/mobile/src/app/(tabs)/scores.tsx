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
import { useSession } from "@/lib/session"
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
  /** Signed-in only — absent/empty for anonymous callers (server parity). */
  yourGames?: ScoreGame[]
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

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Web DayGroups twin: "Today" for the current day, else "Weekday, Month d". */
function dayLabel(d: Date): string {
  if (isSameDay(d, new Date())) return "Today"
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
}

/** Bucket games by calendar day, in the given chronological order (web parity). */
function groupByDay(games: ScoreGame[], order: "asc" | "desc"): Array<{ label: string; games: ScoreGame[] }> {
  const sorted = [...games].sort((a, b) =>
    order === "asc"
      ? +new Date(a.scheduledAt) - +new Date(b.scheduledAt)
      : +new Date(b.scheduledAt) - +new Date(a.scheduledAt)
  )
  const days: Array<{ date: Date; games: ScoreGame[] }> = []
  for (const g of sorted) {
    const d = new Date(g.scheduledAt)
    const bucket = days.find((x) => isSameDay(x.date, d))
    if (bucket) bucket.games.push(g)
    else days.push({ date: d, games: [g] })
  }
  return days.map((d) => ({ label: dayLabel(d.date), games: d.games }))
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

/**
 * A section of games — flat (Live now) or day-grouped (Upcoming/Recent
 * results, web DayGroups twin: "Today" then "Weekday, Month d" headers)
 * depending on whether `order` is passed.
 */
function Section({
  title,
  games,
  accent,
  order,
  subtitle,
  showCount,
}: {
  title: string
  games: ScoreGame[]
  accent: "danger" | "neutral" | "info" | "gold"
  /** Present → day-grouped with date headers; absent → one flat list. */
  order?: "asc" | "desc"
  /** Web SectionHeader twin — "Your games" explains what pinned it here. */
  subtitle?: string
  /** Web's "Your games"/"Live now" Badge count — Upcoming/Recent don't have one. */
  showCount?: boolean
}) {
  if (games.length === 0) return null
  const groups = order ? groupByDay(games, order) : [{ label: null, games }]
  return (
    <View style={styles.section}>
      <View style={styles.sectionBar}>
        <View style={[styles.sectionDot, { backgroundColor: tones[accent].fg }]} />
        <Text style={[styles.sectionTitle, { color: tones[accent].fg }]}>{title}</Text>
        {showCount ? <TonePill tone={accent} label={String(games.length)} /> : null}
      </View>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      {groups.map((group, i) => (
        <View key={group.label ?? i}>
          {group.label ? <Text style={styles.dayLabel}>{group.label}</Text> : null}
          {group.games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </View>
      ))}
    </View>
  )
}

export default function ScoresScreen() {
  const { signedIn } = useSession()
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

  // Guests see exactly today's screen — the server only ever sends
  // yourGames for a recognized session, but gate here too so a stale board
  // held across a sign-out can't flash a personal section.
  const yourGames = signedIn ? board?.yourGames ?? [] : []
  const myGameIds = new Set(yourGames.map((g) => g.id))
  const notMine = (games: ScoreGame[]) =>
    myGameIds.size === 0 ? games : games.filter((g) => !myGameIds.has(g.id))

  return (
    <View style={styles.root}>
      <SubHeader title="Scores" />
      <View style={styles.intro}>
        <Text style={styles.introEyebrow}>Around the hub</Text>
        <Text style={styles.introBody}>
          Live games, this week’s finals and what’s coming up — across every league.
        </Text>
      </View>
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
            {/* Web section order: Your games, Live now, Upcoming, Recent results. */}
            <Section
              title="Your games"
              games={yourGames}
              accent="gold"
              showCount
              subtitle="Games for your kids’ teams and teams you follow."
            />
            <Section title="Live now" games={notMine(board.live)} accent="danger" showCount />
            <Section title="Upcoming" games={notMine(board.upcoming)} accent="info" order="asc" />
            <Section title="Recent results" games={notMine(board.finals)} accent="neutral" order="desc" />
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
  // Web SectionHeader twin ("Around the hub" eyebrow + description) — page
  // header copy parity (five-tab visual-parity pass 2026-07-24).
  intro: {
    padding: 12,
    paddingBottom: 14,
    gap: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
  },
  introEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: ui.primary,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  introBody: { fontSize: 12.5, color: ui.textMuted, lineHeight: 17 },
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
  // Web SectionHeader's "Your games" description line.
  sectionSubtitle: {
    fontSize: 12.5,
    color: ui.textMuted,
    marginTop: -4,
    marginBottom: 8,
  },
  // Web DayGroups' day header ("Today" / "Wednesday, July 22").
  dayLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: ui.textMuted,
    marginTop: 4,
    marginBottom: 6,
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
