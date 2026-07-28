import { useCallback, useEffect, useState } from "react"
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Avatar, Card, EmptyState, Loading, Monogram, SectionHeader } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { tones, ui } from "@/lib/theme"
import { useTheme } from "@/lib/theme-context"

/**
 * Public player page — web /player/[id] parity via the pre-folded
 * /api/mobile/browse/player/[id] endpoint (same resolvers; privacy and
 * Family-Pass log depth fold server-side). The destination that makes
 * every roster name clickable (owner law #1).
 */

interface PlayerView {
  id: string
  name: string
  position: string | null
  jerseyNumber: number | null
  primaryColor: string | null
  team: {
    id: string
    name: string
    ageGroup: string | null
    clubName: string | null
    clubSlug: string | null
  } | null
  stats: {
    gamesPlayed: number
    ppg: number
    rpg: number
    apg: number
    spg: number
    bpg: number
  } | null
  gameLog: Array<{
    gameId: string
    dateISO: string
    opponent: string | null
    result: "W" | "L" | "T" | null
    teamScore: number | null
    opponentScore: number | null
    points: number
    rebounds: number
    assists: number
  }>
  logCapped: boolean
}

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const t = useTheme()
  const [data, setData] = useState<PlayerView | null>(null)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await apiJson<PlayerView>(`/api/mobile/browse/player/${id}`))
    } catch {
      setError(true)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  if (error) {
    return (
      <View style={styles.root}>
        <SubHeader title="Player" />
        <EmptyState icon="person-outline" title="Couldn't load this player" />
      </View>
    )
  }
  if (!data) {
    return (
      <View style={styles.root}>
        <SubHeader title="Player" />
        <Loading />
      </View>
    )
  }

  const s = data.stats
  const statBlocks: Array<{ label: string; value: string; fg: string; bg: string }> = s
    ? [
        { label: "PPG", value: s.ppg.toFixed(1), fg: tones.info.fg, bg: tones.info.bg },
        { label: "RPG", value: s.rpg.toFixed(1), fg: tones.danger.fg, bg: tones.danger.bg },
        { label: "APG", value: s.apg.toFixed(1), fg: tones.positive.fg, bg: tones.positive.bg },
        { label: "SPG", value: s.spg.toFixed(1), fg: tones.gold.fg, bg: tones.gold.bg },
        { label: "BPG", value: s.bpg.toFixed(1), fg: tones.neutral.fg, bg: tones.neutral.bg },
        { label: "Games", value: String(s.gamesPlayed), fg: ui.text, bg: ui.surfaceSunken },
      ]
    : []

  return (
    <View style={styles.root}>
      <SubHeader title={data.name} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card>
          <View style={styles.heroRow}>
            <Avatar name={data.name} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{data.name}</Text>
              <Text style={styles.meta}>
                {[
                  data.jerseyNumber != null ? `#${data.jerseyNumber}` : null,
                  data.position,
                  data.team?.ageGroup,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Player"}
              </Text>
            </View>
          </View>
          {data.team ? (
            <Pressable
              style={({ pressed }) => [styles.teamRow, pressed && { backgroundColor: ui.surfaceSunken }]}
              onPress={() => router.push(`/browse/team/${data.team!.id}`)}
            >
              <Monogram name={data.team.name} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={styles.teamName}>{data.team.name}</Text>
                {data.team.clubName ? (
                  <Text
                    style={[styles.clubLink, { color: t.brand }]}
                    onPress={
                      data.team.clubSlug
                        ? () => router.push(`/browse/club/${data.team!.clubSlug}`)
                        : undefined
                    }
                  >
                    {data.team.clubName}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ) : null}
        </Card>

        {statBlocks.length > 0 ? (
          <>
            <SectionHeader eyebrow="This season" title="Averages" accent="energy" />
            <View style={styles.statGrid}>
              {statBlocks.map((b) => (
                <View key={b.label} style={[styles.statBlock, { backgroundColor: b.bg }]}>
                  <Text style={[styles.statValue, { color: b.fg }]}>{b.value}</Text>
                  <Text style={[styles.statLabel, { color: b.fg }]}>{b.label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <EmptyState
            icon="stats-chart-outline"
            title="No stats yet"
            body="Season numbers appear after the first completed game."
          />
        )}

        {data.gameLog.length > 0 ? (
          <>
            <SectionHeader eyebrow="Recent" title="Game log" accent="brand" />
            <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
              <View style={[styles.logRow, styles.logHead]}>
                <Text style={[styles.logDate, styles.logHeadText]}>DATE</Text>
                <Text style={[styles.logMatch, styles.logHeadText]}>MATCHUP</Text>
                <Text style={[styles.logNum, styles.logHeadText]}>PTS</Text>
                <Text style={[styles.logNum, styles.logHeadText]}>REB</Text>
                <Text style={[styles.logNum, styles.logHeadText]}>AST</Text>
              </View>
              {data.gameLog.map((g) => (
                <Pressable
                  key={g.gameId}
                  style={({ pressed }) => [styles.logRow, pressed && { backgroundColor: ui.surfaceSunken }]}
                  onPress={() => router.push(`/browse/game/${g.gameId}`)}
                >
                  <Text style={styles.logDate}>
                    {new Date(g.dateISO).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </Text>
                  <Text style={styles.logMatch} numberOfLines={1}>
                    {g.result ? `${g.result} ` : ""}
                    {g.teamScore != null && g.opponentScore != null
                      ? `${g.teamScore}–${g.opponentScore} `
                      : ""}
                    {g.opponent ? `vs ${g.opponent}` : ""}
                  </Text>
                  <Text style={styles.logNum}>{g.points}</Text>
                  <Text style={styles.logNum}>{g.rebounds}</Text>
                  <Text style={styles.logNum}>{g.assists}</Text>
                </Pressable>
              ))}
              {data.logCapped ? (
                <Text style={styles.capNote}>Recent games shown — full log on the website.</Text>
              ) : null}
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
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  name: { fontSize: 20, fontWeight: "800", color: ui.text },
  meta: { fontSize: 13, color: ui.textMuted, marginTop: 2 },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    padding: 8,
    marginHorizontal: -8,
    borderRadius: ui.radius.md,
  },
  teamName: { fontSize: 14.5, fontWeight: "700", color: ui.text },
  clubLink: { fontSize: 12.5, fontWeight: "600", marginTop: 1 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statBlock: {
    flexBasis: "30%",
    flexGrow: 1,
    borderRadius: ui.radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8, marginTop: 2 },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.border,
  },
  logHead: { borderTopWidth: 0, backgroundColor: ui.surfaceSunken, paddingVertical: 6 },
  logHeadText: { fontSize: 10, fontWeight: "800", color: ui.textMuted, letterSpacing: 0.8 },
  logDate: { width: 52, fontSize: 12.5, color: ui.textMuted, fontWeight: "600" },
  logMatch: { flex: 1, fontSize: 13, color: ui.text, fontWeight: "600" },
  logNum: {
    width: 34,
    textAlign: "right",
    fontSize: 13.5,
    fontWeight: "700",
    color: ui.text,
    fontVariant: ["tabular-nums"],
  },
  capNote: { fontSize: 11.5, color: ui.textFaint, padding: 10, textAlign: "center" },
})
