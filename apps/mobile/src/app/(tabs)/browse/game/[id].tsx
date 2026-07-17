import { useCallback, useEffect, useState } from "react"
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { EmptyState, Loading } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { useRealtime } from "@/lib/realtime"
import { palette, ui } from "@/lib/theme"
import { useTheme } from "@/lib/theme-context"

/**
 * Game page — web parity (owner 2026-07-16): broadcast-dark hero with stacked
 * teams, then Game | Stats | Plays. All numbers arrive PRE-FOLDED from
 * /api/mobile/browse/game/[id] (the server runs the same fold engine as the
 * web page), so app and web can never disagree.
 */


interface LeaderCell {
  jersey: string
  name: string
  value: number
  unit: string
  sub: string
}
interface GameView {
  game: {
    id: string
    homeTeamId: string
    awayTeamId: string
    live: boolean
    final: boolean
    scheduledAt: string
    periodLabel: string
    homeName: string
    awayName: string
    homeShort: string
    awayShort: string
    homeMonogram: string
    awayMonogram: string
    homeColor: string | null
    awayColor: string | null
    homeRecord: string | null
    awayRecord: string | null
    homeScore: number
    awayScore: number
    venueName: string | null
    leagueName: string | null
    seasonName: string | null
  }
  hasStats: boolean
  linescore: {
    periods: Array<{ label: string; played: boolean }>
    rows: Array<{ short: string; color: string | null; cells: Array<number | null>; total: number }>
  }
  leaders: Array<{ label: string; home: LeaderCell | null; away: LeaderCell | null }>
  teamStats: Array<{
    label: string
    home: string
    away: string
    homeWins: boolean
    awayWins: boolean
    homeShare: number
  }>
  box: Array<{
    teamId: string
    short: string
    color: string | null
    total: number
    rows: Array<{ playerId?: string; jersey: string; name: string; starter?: boolean; onCourt?: boolean; pts: number; reb: number; ast: number; stl: number; to: number }>
  }>
  plays: Array<{ key: number; marker: boolean; text: string; score: string | null; teamId: string | null }>
}

type Tab = "game" | "stats" | "plays"

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const t = useTheme()
  const [data, setData] = useState<GameView | null>(null)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>("game")
  const [boxSide, setBoxSide] = useState(0)

  const load = useCallback(async () => {
    try {
      setData(await apiJson<GameView>(`/api/mobile/browse/game/${id}`))
      setError(false)
    } catch {
      setError(true)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const isLive = !!data?.game.live
  const { connected } = useRealtime({
    rooms: [`game:${id}`],
    events: { "game.update": () => void load() },
  })
  useEffect(() => {
    if (!isLive) return
    const timer = setInterval(load, connected ? 20_000 : 12_000)
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
  const homeWins = g.final && g.homeScore > g.awayScore
  const awayWins = g.final && g.awayScore > g.homeScore

  const teamCol = (side: "home" | "away") => {
    const color = (side === "home" ? g.homeColor : g.awayColor) ?? ui.primary
    const wins = side === "home" ? homeWins : awayWins
    const lost = side === "home" ? awayWins : homeWins
    return (
      <View style={styles.teamCol}>
        <View style={[styles.crest, { backgroundColor: color }]}>
          <Text style={styles.crestText}>{side === "home" ? g.homeMonogram : g.awayMonogram}</Text>
        </View>
        <Text style={styles.teamShort}>{side === "home" ? g.homeShort : g.awayShort}</Text>
        {(side === "home" ? g.homeRecord : g.awayRecord) ? (
          <Text style={styles.teamRecord}>{side === "home" ? g.homeRecord : g.awayRecord}</Text>
        ) : null}
        <Text
          style={[
            styles.bigScore,
            wins && { color: t.highlight },
            lost && { color: "rgba(255,255,255,0.55)" },
          ]}
        >
          {side === "home" ? g.homeScore : g.awayScore}
        </Text>
      </View>
    )
  }

  const statBar = (s: GameView["teamStats"][number]) => (
    <View key={s.label} style={styles.statRow}>
      <View style={styles.statTop}>
        <Text style={[styles.statVal, s.homeWins ? styles.statWin : styles.statLose]}>{s.home}</Text>
        <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
        <Text style={[styles.statVal, s.awayWins ? styles.statWin : styles.statLose, { textAlign: "right" }]}>
          {s.away}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={{
            flex: Math.max(s.homeShare, 0.04),
            backgroundColor: g.homeColor ?? ui.primary,
            opacity: s.homeWins ? 1 : 0.3,
            borderRadius: 3,
          }}
        />
        <View style={{ width: 2 }} />
        <View
          style={{
            flex: Math.max(1 - s.homeShare, 0.04),
            backgroundColor: g.awayColor ?? palette.court[600],
            opacity: s.awayWins ? 1 : 0.3,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  )

  const leaderHalf = (cell: LeaderCell | null, color: string | null, right: boolean) => (
    <View style={[styles.leaderHalf, right && { flexDirection: "row-reverse" }]}>
      {cell ? (
        <>
          <View style={[styles.jerseyTile, { backgroundColor: color ?? ui.primary }]}>
            <Text style={styles.jerseyText}>#{cell.jersey}</Text>
          </View>
          <View style={[{ flex: 1 }, right && { alignItems: "flex-end" }]}>
            <Text style={styles.leaderName} numberOfLines={1}>
              {cell.name}
            </Text>
            <Text style={styles.leaderValue}>
              {cell.value} <Text style={styles.leaderUnit}>{cell.unit}</Text>
            </Text>
            <Text style={styles.leaderSub} numberOfLines={1}>
              {cell.sub}
            </Text>
          </View>
        </>
      ) : (
        <Text style={styles.leaderSub}>—</Text>
      )}
    </View>
  )

  const box = data.box[boxSide]

  return (
    <View style={styles.root}>
      <SubHeader title={g.leagueName ?? "Game"} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* broadcast-dark hero (web parity) */}
        <View style={[styles.hero, { backgroundColor: t.stage }]}>
          <Text style={[styles.heroLeague, { color: t.highlight }]}>
            {[g.leagueName, g.seasonName].filter(Boolean).join(" · ")}
          </Text>
          <View style={styles.heroRow}>
            {teamCol("home")}
            <View style={styles.heroCenter}>
              {g.live ? (
                <>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.livePillText}>LIVE</Text>
                  </View>
                  <Text style={styles.heroPeriod}>{g.periodLabel}</Text>
                </>
              ) : g.final ? (
                <View style={[styles.finalPill, { backgroundColor: t.energy }]}>
                  <Text style={[styles.finalPillText, { color: t.energyOn }]}>FINAL</Text>
                </View>
              ) : (
                <Text style={styles.heroWhen}>
                  {new Date(g.scheduledAt).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              )}
            </View>
            {teamCol("away")}
          </View>
          {g.venueName ? <Text style={styles.heroVenue}>{g.venueName}</Text> : null}
        </View>

        {data.hasStats ? (
          <>
            {/* Game | Stats | Plays */}
            <View style={styles.tabs}>
              {(
                [
                  ["game", "Game"],
                  ["stats", "Stats"],
                  ["plays", "Plays"],
                ] as Array<[Tab, string]>
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  style={[styles.tabBtn, tab === key && styles.tabBtnOn]}
                >
                  <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {tab === "game" && (
              <>
                {/* linescore: fixed 4 quarters, dash for unplayed */}
                <View style={styles.card}>
                  <View style={styles.lineHead}>
                    <View style={{ flex: 1 }} />
                    {data.linescore.periods.map((p, i) => (
                      <Text key={i} style={styles.lineHeadCell}>
                        {p.label}
                      </Text>
                    ))}
                    <Text style={[styles.lineHeadCell, styles.lineTotHead]}>Tot</Text>
                  </View>
                  {data.linescore.rows.map((r, i) => (
                    <View key={i} style={[styles.lineRow, i === 0 && styles.lineRowBorder]}>
                      <View style={styles.lineTeam}>
                        <View style={[styles.lineChip, { backgroundColor: r.color ?? ui.primary }]} />
                        <Text style={styles.lineTeamText} numberOfLines={1}>
                          {r.short}
                        </Text>
                      </View>
                      {r.cells.map((c, j) => (
                        <Text key={j} style={styles.lineCell}>
                          {c == null ? "–" : c}
                        </Text>
                      ))}
                      <Text style={[styles.lineCell, styles.lineTot]}>{r.total}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.sectionHead}>GAME LEADERS</Text>
                <View style={styles.card}>
                  {data.leaders.map((sec) => (
                    <View key={sec.label} style={styles.leaderSection}>
                      <Text style={styles.leaderLabel}>{sec.label.toUpperCase()}</Text>
                      <View style={styles.leaderRow}>
                        {leaderHalf(sec.home, g.homeColor, false)}
                        {leaderHalf(sec.away, g.awayColor, true)}
                      </View>
                    </View>
                  ))}
                </View>

                <Text style={styles.sectionHead}>TEAM STATS</Text>
                <View style={styles.card}>
                  <View style={styles.statTeams}>
                    <Text style={[styles.statTeamName, { color: g.homeColor ?? ui.primary }]}>
                      {g.homeShort}
                    </Text>
                    <Text style={[styles.statTeamName, { color: g.awayColor ?? palette.court[600] }]}>
                      {g.awayShort}
                    </Text>
                  </View>
                  {data.teamStats.map(statBar)}
                </View>
              </>
            )}

            {tab === "stats" && (
              <>
                <View style={styles.tabs}>
                  {data.box.map((b, i) => (
                    <Pressable
                      key={b.teamId}
                      onPress={() => setBoxSide(i)}
                      style={[
                        styles.tabBtn,
                        boxSide === i && { backgroundColor: b.color ?? ui.primary, borderRadius: 10 },
                      ]}
                    >
                      <Text style={[styles.tabText, boxSide === i && styles.tabTextOn]} numberOfLines={1}>
                        {b.short} · {b.total}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.card}>
                  <View style={styles.boxHead}>
                    <Text style={[styles.boxHeadCell, styles.boxPlayer]}>PLAYER</Text>
                    {["PTS", "REB", "AST", "STL", "TO"].map((h) => (
                      <Text key={h} style={styles.boxHeadCell}>
                        {h}
                      </Text>
                    ))}
                  </View>
                  {/* Starters stay starters (owner rule); green dot = on the
                      floor right now. Bench under its own strip, web parity. */}
                  {[...box.rows.filter((r) => r.starter), null, ...box.rows.filter((r) => !r.starter)].map(
                    (r, i) =>
                      r === null ? (
                        box.rows.some((x) => !x.starter) && box.rows.some((x) => x.starter) ? (
                          <View key="bench" style={styles.benchStrip}>
                            <Text style={styles.benchStripText}>BENCH</Text>
                          </View>
                        ) : null
                      ) : (
                        <View key={i} style={styles.boxRow}>
                          <Pressable
                            style={[styles.boxPlayer, styles.boxPlayerCell]}
                            disabled={!r.playerId}
                            onPress={() =>
                              r.playerId && router.push(`/browse/player/${r.playerId}`)
                            }
                          >
                            {r.onCourt ? <View style={styles.onCourtDot} /> : null}
                            <Text style={styles.boxJersey}>#{r.jersey}</Text>
                            <Text style={[styles.boxName, r.playerId ? styles.boxNameLink : null]} numberOfLines={1}>
                              {r.name}
                            </Text>
                          </Pressable>
                          <Text style={[styles.boxCell, styles.boxPts, { color: t.energyInk }]}>{r.pts}</Text>
                          <Text style={styles.boxCell}>{r.reb}</Text>
                          <Text style={styles.boxCell}>{r.ast}</Text>
                          <Text style={styles.boxCell}>{r.stl}</Text>
                          <Text style={styles.boxCell}>{r.to}</Text>
                        </View>
                      )
                  )}
                </View>
              </>
            )}

            {tab === "plays" && (
              <View style={styles.card}>
                {data.plays.map((p) =>
                  p.marker ? (
                    <View key={p.key} style={styles.playMarker}>
                      <Text style={styles.playMarkerText}>{p.text.toUpperCase()}</Text>
                    </View>
                  ) : (
                    <View key={p.key} style={styles.playRow}>
                      <View
                        style={[
                          styles.playStripe,
                          {
                            backgroundColor:
                              p.teamId === g.homeTeamId
                                ? (g.homeColor ?? ui.primary)
                                : (g.awayColor ?? palette.court[600]),
                          },
                        ]}
                      />
                      <Text style={[styles.playText, p.score && styles.playTextScoring]}>
                        {p.text}
                      </Text>
                      {p.score ? <Text style={styles.playScore}>{p.score}</Text> : null}
                    </View>
                  )
                )}
                {data.plays.length === 0 ? (
                  <Text style={styles.leaderSub}>No plays yet.</Text>
                ) : null}
              </View>
            )}
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.pregameTitle}>This game hasn&apos;t started yet</Text>
            <Text style={styles.pregameBody}>
              Live score, leaders and the box score appear here automatically at tip-off.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { paddingBottom: 32 },

  hero: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16 },
  heroLeague: { textAlign: "center", fontSize: 12, fontWeight: "700" },
  heroRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 12 },
  teamCol: { flex: 1, alignItems: "center" },
  crest: {
    width: 54,
    height: 54,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  crestText: { color: "#fff", fontSize: 19, fontWeight: "900" },
  teamShort: { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 6 },
  teamRecord: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600" },
  bigScore: { color: "#fff", fontSize: 46, fontWeight: "800", marginTop: 2, fontVariant: ["tabular-nums"] },
  heroCenter: { width: 104, alignItems: "center", justifyContent: "center", paddingTop: 26 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#dc2626",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  livePillText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  heroPeriod: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 6 },
  finalPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  finalPillText: { fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  heroWhen: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "700", textAlign: "center" },
  heroVenue: { textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 11.5, marginTop: 10 },

  tabs: {
    flexDirection: "row",
    backgroundColor: palette.ink[100],
    borderRadius: 12,
    padding: 3,
    marginHorizontal: 12,
    marginTop: 12,
  },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 8 },
  tabBtnOn: { backgroundColor: ui.primary, borderRadius: 10 },
  tabText: { fontSize: 13.5, fontWeight: "800", color: ui.textMuted },
  tabTextOn: { color: "#fff" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ui.border,
    marginHorizontal: 12,
    marginTop: 10,
    paddingVertical: 4,
  },
  sectionHead: {
    marginHorizontal: 14,
    marginTop: 18,
    fontSize: 16,
    fontWeight: "900",
    color: ui.text,
    letterSpacing: 0.3,
  },

  lineHead: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 7 },
  lineHeadCell: { width: 36, textAlign: "center", fontSize: 11, fontWeight: "800", color: ui.textFaint },
  lineTotHead: { color: ui.text },
  lineRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9 },
  lineRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.ink[50] },
  lineTeam: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  lineChip: { width: 15, height: 15, borderRadius: 4 },
  lineTeamText: { fontSize: 14.5, fontWeight: "800", color: ui.text, flexShrink: 1 },
  lineCell: { width: 36, textAlign: "center", fontSize: 15, fontWeight: "700", color: ui.textMuted, fontVariant: ["tabular-nums"] },
  lineTot: { fontWeight: "900", color: ui.text },

  leaderSection: { paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: palette.ink[50] },
  leaderLabel: { textAlign: "center", fontSize: 10, fontWeight: "900", color: ui.textFaint, letterSpacing: 1.2, marginBottom: 6 },
  leaderRow: { flexDirection: "row", gap: 10 },
  leaderHalf: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  jerseyTile: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  jerseyText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  leaderName: { fontSize: 13, fontWeight: "800", color: ui.text },
  leaderValue: { fontSize: 17, fontWeight: "900", color: ui.text, fontVariant: ["tabular-nums"] },
  leaderUnit: { fontSize: 10, fontWeight: "900", color: ui.textFaint },
  leaderSub: { fontSize: 11, color: ui.textMuted },

  statTeams: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.ink[50],
  },
  statTeamName: { fontSize: 13, fontWeight: "900" },
  statRow: { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.ink[50] },
  statTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  statVal: { fontSize: 15, fontVariant: ["tabular-nums"], minWidth: 90 },
  statWin: { fontWeight: "900", color: ui.text },
  statLose: { fontWeight: "600", color: ui.textMuted },
  statLabel: { fontSize: 10.5, fontWeight: "900", color: ui.textMuted, letterSpacing: 0.8 },
  barTrack: { flexDirection: "row", height: 6, marginTop: 6, borderRadius: 3, overflow: "hidden" },

  boxHead: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8 },
  boxHeadCell: { width: 40, textAlign: "right", fontSize: 10.5, fontWeight: "900", color: ui.textMuted },
  boxPlayer: { flex: 1, textAlign: "left" },
  boxPlayerCell: { flexDirection: "row", alignItems: "center", gap: 6 },
  boxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: palette.ink[50],
  },
  onCourtDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.court[500] },
  benchStrip: { backgroundColor: palette.ink[50], paddingVertical: 3, alignItems: "center" },
  benchStripText: { fontSize: 9.5, fontWeight: "900", color: ui.textMuted, letterSpacing: 1.5 },
  boxJersey: { fontSize: 12, color: ui.textFaint, fontWeight: "700" },
  boxName: { fontSize: 14.5, fontWeight: "700", color: ui.text, flexShrink: 1 },
  boxNameLink: { textDecorationLine: "underline", textDecorationColor: ui.borderStrong },
  boxCell: { width: 40, textAlign: "right", fontSize: 15, fontWeight: "600", color: ui.text, fontVariant: ["tabular-nums"] },
  boxPts: { fontWeight: "900", fontSize: 15.5 },

  playMarker: { backgroundColor: palette.ink[50], paddingVertical: 4, alignItems: "center" },
  playMarkerText: { fontSize: 10, fontWeight: "900", color: ui.textMuted, letterSpacing: 1.5 },
  playRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingVertical: 7, borderTopWidth: 1, borderTopColor: palette.ink[50] },
  playStripe: { width: 3, alignSelf: "stretch", borderRadius: 2 },
  playText: { flex: 1, fontSize: 13, color: ui.textMuted },
  playTextScoring: { color: ui.text, fontWeight: "700" },
  playScore: { fontSize: 12.5, fontWeight: "800", color: ui.text, fontVariant: ["tabular-nums"] },

  pregameTitle: { fontSize: 14.5, fontWeight: "700", color: ui.text, textAlign: "center", paddingTop: 14 },
  pregameBody: { fontSize: 12.5, color: ui.textMuted, textAlign: "center", padding: 12 },
})
