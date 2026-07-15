import { useCallback, useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, Loading, SectionHeader } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { palette, ui } from "@/lib/theme"

/**
 * League season — standings tables per division + recent/upcoming games.
 * Native twin of the public /league/[id] page. Anonymous.
 */

interface SeasonGame {
  id: string
  scheduledAt: string
  status: string
  homeScore: number | null
  awayScore: number | null
  homeTeam: { id: string; name: string }
  awayTeam: { id: string; name: string }
  venue: { name: string } | null
}

interface SeasonDetail {
  season: {
    id: string
    name: string
    status: string
    league: { id: string; name: string } | null
  }
  standings: {
    divisions: Array<{
      divisionId: string
      divisionName: string
      rows: Array<{
        teamId: string
        name: string
        wins: number
        losses: number
        pointsFor: number
        pointsAgainst: number
      }>
    }>
  } | null
  upcoming: SeasonGame[]
  recent: SeasonGame[]
}

function GameLine({ game }: { game: SeasonGame }) {
  const done = game.status === "COMPLETED"
  return (
    <View style={styles.gameLine}>
      <View style={{ flex: 1 }}>
        <Text style={styles.gameTeams} numberOfLines={1}>
          {game.homeTeam.name} vs {game.awayTeam.name}
        </Text>
        <Text style={styles.gameMeta}>
          {done
            ? `Final ${game.homeScore ?? 0}–${game.awayScore ?? 0}`
            : new Date(game.scheduledAt).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
          {game.venue ? ` · ${game.venue.name}` : ""}
        </Text>
      </View>
    </View>
  )
}

export default function SeasonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [data, setData] = useState<SeasonDetail | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await apiJson<SeasonDetail>(`/api/mobile/browse/seasons/${id}`))
    } catch {
      setError(true)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <View style={styles.root}>
        <SubHeader title="League" />
        <EmptyState icon="trophy-outline" title="Couldn't load this league" />
      </View>
    )
  }
  if (!data) {
    return (
      <View style={styles.root}>
        <SubHeader title="League" />
        <Loading />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <SubHeader title={data.season.league?.name ?? data.season.name} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.seasonName}>{data.season.name}</Text>

        {(data.standings?.divisions ?? []).map((division) => (
          <View key={division.divisionId} style={{ gap: 8 }}>
            <SectionHeader eyebrow="Standings" title={division.divisionName} accent="court" />
            <Card style={{ paddingVertical: 6 }}>
              <View style={[styles.standingsRow, styles.standingsHead]}>
                <Text style={[styles.standingsRank, styles.headText]}>#</Text>
                <Text style={[styles.standingsTeam, styles.headText]}>Team</Text>
                <Text style={[styles.standingsNum, styles.headText]}>W</Text>
                <Text style={[styles.standingsNum, styles.headText]}>L</Text>
                <Text style={[styles.standingsNum, styles.headText]}>PF</Text>
                <Text style={[styles.standingsNum, styles.headText]}>PA</Text>
              </View>
              {division.rows.map((row, idx) => (
                <View key={row.teamId} style={styles.standingsRow}>
                  <Text style={[styles.standingsRank, idx === 0 && styles.leader]}>{idx + 1}</Text>
                  <Text style={[styles.standingsTeam, idx === 0 && styles.leader]} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={styles.standingsNum}>{row.wins}</Text>
                  <Text style={styles.standingsNum}>{row.losses}</Text>
                  <Text style={styles.standingsNum}>{row.pointsFor}</Text>
                  <Text style={styles.standingsNum}>{row.pointsAgainst}</Text>
                </View>
              ))}
            </Card>
          </View>
        ))}

        {data.upcoming.length > 0 ? (
          <>
            <SectionHeader eyebrow="Schedule" title="Upcoming games" accent="play" />
            <Card>
              {data.upcoming.map((g) => (
                <GameLine key={g.id} game={g} />
              ))}
            </Card>
          </>
        ) : null}

        {data.recent.length > 0 ? (
          <>
            <SectionHeader eyebrow="Results" title="Recent games" accent="ink" />
            <Card>
              {data.recent.map((g) => (
                <GameLine key={g.id} game={g} />
              ))}
            </Card>
          </>
        ) : null}

        {(data.standings?.divisions ?? []).length === 0 &&
        data.upcoming.length === 0 &&
        data.recent.length === 0 ? (
          <EmptyState
            icon="trophy-outline"
            title="Season hasn't started yet"
            body="Standings and games appear once play begins."
          />
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  seasonName: { fontSize: 20, fontWeight: "800", color: ui.text },
  standingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.border,
  },
  standingsHead: { borderBottomWidth: 1 },
  headText: { color: ui.textFaint, fontWeight: "700", fontSize: 11, textTransform: "uppercase" },
  standingsRank: { width: 20, fontSize: 13, color: ui.textMuted, fontWeight: "700" },
  standingsTeam: { flex: 1, fontSize: 13, color: ui.text, fontWeight: "600" },
  standingsNum: { width: 32, fontSize: 13, color: ui.textMuted, textAlign: "right" },
  leader: { color: palette.gold[600] },
  gameLine: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  gameTeams: { fontSize: 13, fontWeight: "600", color: ui.text },
  gameMeta: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
})
