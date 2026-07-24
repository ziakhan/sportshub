import { useCallback, useEffect, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, Loading, Monogram, SectionHeader, TonePill } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { ui } from "@/lib/theme"

/**
 * Public team page — native twin of web (public)/team/[id]
 * (getTeamPublicData), fixing native-parity gap 1: anonymous/public
 * contexts (club roster, standings, article tags) used to dead-end on the
 * members-only /team screen. Practices stay out unless the API says the
 * bearer is a member (owner privacy ruling 2026-07-24) — never a teaser.
 */

interface TeamGame {
  id: string
  scheduledAt: string
  status: string
  homeScore: number | null
  awayScore: number | null
  homeTeam: { id: string; name: string }
  awayTeam: { id: string; name: string }
  venue: { name: string } | null
}

interface TeamPublic {
  team: {
    id: string
    name: string
    ageGroup: string | null
    gender: string | null
    season: string | null
    playerCount: number
    tenant: {
      id: string
      name: string
      slug: string
      city: string | null
      state: string | null
      primaryColor: string | null
      logoUrl: string | null
    } | null
  }
  record: { wins: number; losses: number; ties: number }
  seasonInfo: { id: string; label: string; leagueId: string; leagueName: string } | null
  roster: { committed: number; cap: number } | null
  isMember: boolean
  practiceSummary: string | null
  upcoming: TeamGame[]
  recent: TeamGame[]
}

function GameRow({ game }: { game: TeamGame }) {
  const live = game.status === "LIVE"
  const done = game.status === "COMPLETED"
  return (
    <Pressable
      style={({ pressed }) => [styles.gameRow, pressed && { backgroundColor: ui.surfaceSunken }]}
      onPress={() => router.push(`/browse/game/${game.id}`)}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.gameTop}>
          <TonePill
            tone={live ? "danger" : done ? "neutral" : "info"}
            label={live ? "Live" : done ? "Final" : "Upcoming"}
          />
          {game.venue ? (
            <Text style={styles.gameVenue} numberOfLines={1}>
              {game.venue.name}
            </Text>
          ) : null}
        </View>
        <Text style={styles.gameTeams} numberOfLines={1}>
          {game.homeTeam.name} vs {game.awayTeam.name}
        </Text>
        <Text style={styles.gameMeta}>
          {done || live
            ? `${game.homeScore ?? 0}–${game.awayScore ?? 0}`
            : new Date(game.scheduledAt).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={ui.textFaint} />
    </Pressable>
  )
}

export default function PublicTeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [data, setData] = useState<TeamPublic | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await apiJson<TeamPublic>(`/api/mobile/browse/team/${id}`))
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
        <SubHeader title="Team" />
        <EmptyState icon="people-outline" title="Couldn't load this team" body="Pull back and retry." />
      </View>
    )
  }
  if (!data) {
    return (
      <View style={styles.root}>
        <SubHeader title="Team" />
        <Loading />
      </View>
    )
  }

  const { team, record, seasonInfo, roster, practiceSummary, upcoming, recent } = data
  const recordLabel = `${record.wins}–${record.losses}${record.ties ? `–${record.ties}` : ""}`

  return (
    <View style={styles.root}>
      <SubHeader title={team.name} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.headRow}>
            <Monogram name={team.name} logoUrl={team.tenant?.logoUrl} color={team.tenant?.primaryColor} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.teamName}>{team.name}</Text>
              <Text style={styles.meta}>
                {[team.tenant?.name, team.ageGroup, team.season].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>
          {team.tenant ? (
            <Pressable
              style={({ pressed }) => [styles.clubLink, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`/browse/club/${team.tenant!.slug}`)}
              hitSlop={4}
            >
              <Text style={styles.clubLinkText}>{team.tenant.name}</Text>
              <Ionicons name="chevron-forward" size={13} color={ui.primary} />
            </Pressable>
          ) : null}
        </Card>

        <View style={styles.chipRow}>
          <TonePill tone="neutral" label={recordLabel} />
          {seasonInfo ? (
            <Pressable onPress={() => router.push(`/browse/season/${seasonInfo.id}`)}>
              <TonePill tone="info" label={`${seasonInfo.leagueName} ${seasonInfo.label}`} />
            </Pressable>
          ) : null}
          {roster ? (
            <TonePill tone="neutral" label={`Roster: ${roster.committed} of ${roster.cap}`} />
          ) : null}
          {practiceSummary ? <TonePill tone="positive" label={`Practices: ${practiceSummary}`} /> : null}
        </View>

        {upcoming.length === 0 && recent.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No games yet"
            body="The schedule appears here once this team is placed in a league season."
          />
        ) : (
          <>
            {upcoming.length > 0 ? (
              <>
                <SectionHeader eyebrow="Schedule" title="Upcoming games" accent="play" />
                <Card>
                  {upcoming.map((g) => (
                    <GameRow key={g.id} game={g} />
                  ))}
                </Card>
              </>
            ) : null}
            {recent.length > 0 ? (
              <>
                <SectionHeader eyebrow="Results" title="Recent games" accent="ink" />
                <Card>
                  {recent.map((g) => (
                    <GameRow key={g.id} game={g} />
                  ))}
                </Card>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  teamName: { fontSize: 18, fontWeight: "800", color: ui.text },
  meta: { fontSize: 12.5, color: ui.textMuted, marginTop: 2 },
  clubLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  clubLinkText: { fontSize: 13, fontWeight: "700", color: ui.primary },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gameRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
    borderRadius: ui.radius.sm,
    marginHorizontal: -6,
    paddingHorizontal: 6,
  },
  gameTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  gameVenue: { flex: 1, fontSize: 11.5, color: ui.textFaint, textAlign: "right" },
  gameTeams: { fontSize: 13.5, fontWeight: "700", color: ui.text },
  gameMeta: { fontSize: 13, color: ui.textMuted, marginTop: 2, fontWeight: "700", fontVariant: ["tabular-nums"] },
})
