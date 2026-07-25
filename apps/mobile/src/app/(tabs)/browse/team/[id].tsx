import { useCallback, useEffect, useState } from "react"
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { SubHeader } from "@/components/top-bar"
import {
  Card,
  CoverImage,
  EmptyState,
  FollowPill,
  GameRow,
  HeroBand,
  HeroCrest,
  HeroStatRow,
  ListRow,
  Loading,
  SectionHeader,
  TonePill,
  type GameRowData,
} from "@/components/ui"
import { apiJson } from "@/lib/api"
import { brandTokens } from "@/lib/brand"
import { fetchFollowStatus, followTarget, unfollowTarget, type FollowState } from "@/lib/follows"
import { useSession } from "@/lib/session"
import { ui } from "@/lib/theme"

/**
 * Public team page — native twin of web (public)/team/[id] (getTeamPublicData),
 * 2026-07-25 rebuild to match the club-screen visual bar: full-bleed hero in
 * the team's CLUB branding color (a team has no color of its own), club link,
 * record + roster stat strip, then schedule, a standings snippet (native-only
 * addition — the web team page doesn't have this section), player averages,
 * team news, roster and coaching staff. Follow is wired (lib/follows.ts, same
 * /api/follows routes the web FollowButton uses) — signed-in only, shown as a
 * pill in the hero.
 *
 * Practices stay club-members-only (owner privacy ruling 2026-07-24) — never
 * a teaser; the API omits practiceSummary entirely for non-members.
 */

type TeamGame = GameRowData

interface PlayerAverage {
  playerId: string
  gamesPlayed: number
  ppg: number
  rpg: number
  apg: number
  spg: number
  bpg: number
}

interface RosterPlayer {
  id: string
  name: string
  jerseyNumber: number | null
  position: string | null
}

interface StaffMember {
  name: string
  designation: string
}

interface NewsItem {
  id: string
  title: string
  slug: string
  publishedAt: string | null
  excerpt: string
  coverUrl: string | null
  isRecap: boolean
}

interface StandingsSnippet {
  divisionName: string
  seasonId: string
  seasonLabel: string
  leagueName: string
  rows: Array<{ teamId: string; name: string; wins: number; losses: number; winPct: number; streak: string | null }>
}

interface TeamPublic {
  team: {
    id: string
    name: string
    ageGroup: string | null
    gender: string | null
    season: string | null
    description: string | null
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
  players: RosterPlayer[]
  staff: StaffMember[]
  playerAverages: PlayerAverage[]
  news: NewsItem[]
  standings: StandingsSnippet | null
}

function pctLabel(pct: number): string {
  return pct.toFixed(3).replace(/^0/, "")
}

export default function PublicTeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { signedIn } = useSession()
  const [data, setData] = useState<TeamPublic | null>(null)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [followState, setFollowState] = useState<FollowState>("NONE")
  const [followBusy, setFollowBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await apiJson<TeamPublic>(`/api/mobile/browse/team/${id}`))
      setError(false)
    } catch {
      setError(true)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!signedIn || !id) return
    fetchFollowStatus({ teamId: id })
      .then((res) => setFollowState(res.status))
      .catch(() => {
        // status check failed — leave the pill at NONE, next toggle retries
      })
  }, [signedIn, id])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const toggleFollow = useCallback(async () => {
    if (!id || followBusy) return
    const wasState = followState
    const creating = wasState === "NONE"
    setFollowBusy(true)
    setFollowState(creating ? "ACTIVE" : "NONE") // optimistic; corrected below
    try {
      if (creating) {
        const res = await followTarget({ teamId: id })
        setFollowState(res.status)
      } else {
        await unfollowTarget({ teamId: id })
      }
    } catch {
      setFollowState(wasState)
    } finally {
      setFollowBusy(false)
    }
  }, [id, followBusy, followState])

  if (error) {
    return (
      <View style={styles.root}>
        <SubHeader title="Team" fallback="/browse/clubs" />
        <EmptyState icon="people-outline" title="Couldn't load this team" body="Pull back and retry." />
      </View>
    )
  }
  if (!data) {
    return (
      <View style={styles.root}>
        <SubHeader title="Team" fallback="/browse/clubs" />
        <Loading />
      </View>
    )
  }

  const { team, record, seasonInfo, roster, practiceSummary, upcoming, recent, players, staff, playerAverages, news, standings } =
    data
  const recordLabel = `${record.wins}–${record.losses}${record.ties ? `–${record.ties}` : ""}`
  const brand = brandTokens(team.tenant?.primaryColor)
  const heroFallback = team.tenant ? `/browse/club/${team.tenant.slug}` : "/browse/clubs"

  const heroStats = [
    { value: recordLabel, label: "Record" },
    { value: String(team.playerCount), label: "Players" },
    roster
      ? { value: `${roster.committed}/${roster.cap}`, label: "Roster" }
      : { value: team.ageGroup ?? "—", label: "Age group" },
  ]

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <HeroBand color={brand.brand} onColor={brand.onBrand} fallback={heroFallback}>
          <View style={styles.heroTop}>
            <HeroCrest name={team.name} logoUrl={team.tenant?.logoUrl} ink={brand.ink} size={56} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.heroName, { color: brand.onBrand }]} numberOfLines={2}>
                {team.name}
              </Text>
              <Text style={[styles.heroMeta, { color: brand.onBrand }]} numberOfLines={1}>
                {[team.ageGroup, team.gender, team.season].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>
          {team.tenant ? (
            <Pressable
              style={({ pressed }) => [styles.clubChip, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`/browse/club/${team.tenant!.slug}`)}
              hitSlop={4}
            >
              <Text style={[styles.clubChipText, { color: brand.onBrand }]} numberOfLines={1}>
                {team.tenant.name}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={brand.onBrand} />
            </Pressable>
          ) : null}
          {signedIn ? (
            <FollowPill
              following={followState === "ACTIVE"}
              onColor={brand.onBrand}
              busy={followBusy}
              onPress={toggleFollow}
            />
          ) : null}
          <HeroStatRow stats={heroStats} onColor={brand.onBrand} />
        </HeroBand>

        <View style={styles.body}>
          <View style={styles.chipRow}>
            {seasonInfo ? (
              <Pressable onPress={() => router.push(`/browse/season/${seasonInfo.id}`)}>
                <TonePill tone="info" label={`${seasonInfo.leagueName} ${seasonInfo.label}`} />
              </Pressable>
            ) : null}
            {practiceSummary ? <TonePill tone="positive" label={`Practices: ${practiceSummary}`} /> : null}
          </View>

          {team.description ? (
            <Card>
              <Text style={styles.description}>{team.description}</Text>
            </Card>
          ) : null}

          {standings ? (
            <>
              <SectionHeader eyebrow={`${standings.leagueName} ${standings.seasonLabel}`} title={standings.divisionName} color={brand.ink} />
              <Card style={{ paddingVertical: 6 }}>
                <View style={[styles.standRow, styles.standHead]}>
                  <Text style={[styles.standRank, styles.standHeadText]}>#</Text>
                  <Text style={[styles.standTeam, styles.standHeadText]}>Team</Text>
                  <Text style={[styles.standNum, styles.standHeadText]}>W</Text>
                  <Text style={[styles.standNum, styles.standHeadText]}>L</Text>
                  <Text style={[styles.standNum, styles.standHeadText]}>PCT</Text>
                  <Text style={[styles.standStrk, styles.standHeadText]}>STRK</Text>
                </View>
                {standings.rows.map((row, idx) => {
                  const isTeam = row.teamId === team.id
                  return (
                    <Pressable
                      key={row.teamId}
                      style={({ pressed }) => [
                        styles.standRow,
                        isTeam && { backgroundColor: brand.soft },
                        pressed && { backgroundColor: ui.surfaceSunken },
                      ]}
                      onPress={() => (isTeam ? undefined : router.push(`/browse/team/${row.teamId}`))}
                    >
                      <Text style={[styles.standRank, isTeam && { color: brand.ink, fontWeight: "800" }]}>{idx + 1}</Text>
                      <Text style={[styles.standTeam, isTeam && { color: brand.ink, fontWeight: "800" }]} numberOfLines={1}>
                        {row.name}
                      </Text>
                      <Text style={styles.standNum}>{row.wins}</Text>
                      <Text style={styles.standNum}>{row.losses}</Text>
                      <Text style={styles.standNum}>{pctLabel(row.winPct)}</Text>
                      <Text style={styles.standStrk}>{row.streak ?? "—"}</Text>
                    </Pressable>
                  )
                })}
                <Pressable onPress={() => router.push(`/browse/season/${standings.seasonId}`)} hitSlop={6} style={styles.fullStandings}>
                  <Text style={[styles.fullStandingsText, { color: brand.ink }]}>Full standings</Text>
                  <Ionicons name="chevron-forward" size={12} color={brand.ink} />
                </Pressable>
              </Card>
            </>
          ) : null}

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
                  <SectionHeader eyebrow="Schedule" title="Upcoming games" color={brand.ink} />
                  <Card>
                    {upcoming.map((g) => (
                      <GameRow key={g.id} game={g} onPress={() => router.push(`/browse/game/${g.id}`)} />
                    ))}
                  </Card>
                </>
              ) : null}
              {recent.length > 0 ? (
                <>
                  <SectionHeader eyebrow="Results" title="Recent games" color={brand.ink} />
                  <Card>
                    {recent.map((g) => (
                      <GameRow key={g.id} game={g} onPress={() => router.push(`/browse/game/${g.id}`)} />
                    ))}
                  </Card>
                </>
              ) : null}
            </>
          )}

          {playerAverages.length > 0 ? (
            <>
              <SectionHeader eyebrow="This season" title="Player stats" color={brand.ink} />
              <Card style={{ padding: 0, overflow: "hidden" }}>
                <View style={[styles.statRow, styles.statHead]}>
                  <Text style={[styles.statPlayer, styles.statHeadText]}>Player</Text>
                  <Text style={[styles.statNum, styles.statHeadText]}>GP</Text>
                  <Text style={[styles.statNum, styles.statHeadText]}>PPG</Text>
                  <Text style={[styles.statNum, styles.statHeadText]}>RPG</Text>
                  <Text style={[styles.statNum, styles.statHeadText]}>APG</Text>
                </View>
                {playerAverages.map((row) => {
                  const player = players.find((p) => p.id === row.playerId)
                  return (
                    <Pressable
                      key={row.playerId}
                      style={({ pressed }) => [styles.statRow, pressed && { backgroundColor: ui.surfaceSunken }]}
                      onPress={() => router.push(`/browse/player/${row.playerId}`)}
                    >
                      <Text style={styles.statPlayer} numberOfLines={1}>
                        {player?.name ?? "Former player"}
                      </Text>
                      <Text style={styles.statNum}>{row.gamesPlayed}</Text>
                      <Text style={[styles.statNum, { fontWeight: "800", color: ui.text }]}>{row.ppg.toFixed(1)}</Text>
                      <Text style={styles.statNum}>{row.rpg.toFixed(1)}</Text>
                      <Text style={styles.statNum}>{row.apg.toFixed(1)}</Text>
                    </Pressable>
                  )
                })}
              </Card>
            </>
          ) : null}

          {news.length > 0 ? (
            <>
              <SectionHeader eyebrow="Recaps" title="Team news" color={brand.ink} />
              {news.slice(0, 3).map((n) => (
                <Card key={n.id} style={styles.newsCard} onPress={() => router.push(`/browse/article/${n.slug}`)}>
                  <CoverImage url={n.coverUrl} icon="newspaper-outline" />
                  <View style={styles.newsBody}>
                    <View style={styles.newsMetaRow}>
                      {n.isRecap ? <TonePill tone="gold" label="Game recap" /> : null}
                      {n.publishedAt ? (
                        <Text style={styles.newsDate}>
                          {new Date(n.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.newsTitle} numberOfLines={2}>
                      {n.title}
                    </Text>
                  </View>
                </Card>
              ))}
            </>
          ) : null}

          {players.length > 0 ? (
            <>
              <SectionHeader eyebrow="Roster" title="Players" color={brand.ink} />
              <Card>
                {players.map((p) => (
                  <ListRow
                    key={p.id}
                    left={
                      <View style={[styles.jersey, { backgroundColor: brand.brand }]}>
                        <Text style={styles.jerseyText}>{p.jerseyNumber ?? "–"}</Text>
                      </View>
                    }
                    text={p.name}
                    sub={p.position}
                    onPress={() => router.push(`/browse/player/${p.id}`)}
                  />
                ))}
              </Card>
            </>
          ) : null}

          {staff.length > 0 ? (
            <>
              <SectionHeader eyebrow="Team" title="Coaching staff" color={brand.ink} />
              <Card>
                {staff.map((s, i) => (
                  <View key={i} style={styles.staffRow}>
                    <Text style={styles.staffName}>{s.name}</Text>
                    <Text style={styles.staffRole}>{s.designation}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { paddingBottom: 32 },
  body: { padding: 16, gap: 14 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroName: { fontSize: 21, fontWeight: "800", letterSpacing: -0.2 },
  heroMeta: { fontSize: 13, opacity: 0.85, marginTop: 3 },
  clubChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 12,
    alignSelf: "flex-start",
  },
  clubChipText: { fontSize: 13, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  description: { fontSize: 13.5, color: ui.textMuted, lineHeight: 20 },
  standRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.border,
  },
  standHead: { borderBottomWidth: 1 },
  standHeadText: { color: ui.textFaint, fontWeight: "700", fontSize: 10.5, textTransform: "uppercase" },
  standRank: { width: 18, fontSize: 13, color: ui.textMuted, fontWeight: "700" },
  standTeam: { flex: 1, fontSize: 13, color: ui.text, fontWeight: "600" },
  standNum: { width: 34, fontSize: 13, color: ui.textMuted, textAlign: "right" },
  standStrk: { width: 40, fontSize: 12, color: ui.textMuted, textAlign: "right", fontWeight: "700" },
  fullStandings: { flexDirection: "row", alignItems: "center", gap: 3, padding: 12, alignSelf: "flex-start" },
  fullStandingsText: { fontSize: 12.5, fontWeight: "700" },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.border,
  },
  statHead: { borderTopWidth: 0, backgroundColor: ui.surfaceSunken, paddingVertical: 7 },
  statHeadText: { fontSize: 10, fontWeight: "800", color: ui.textMuted, letterSpacing: 0.6 },
  statPlayer: { flex: 1, fontSize: 13, color: ui.text, fontWeight: "600" },
  statNum: { width: 36, textAlign: "right", fontSize: 13, color: ui.textMuted, fontVariant: ["tabular-nums"] },
  // Full-bleed 16:9 cover cards (news law: news is ALWAYS a card, never a
  // compact row) — cover bleeds to the card edge, padding lives on the body.
  newsCard: { marginBottom: 10, padding: 0, overflow: "hidden" },
  newsBody: { padding: 12, gap: 4 },
  newsMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  newsTitle: { fontSize: 15, fontWeight: "700", color: ui.text, lineHeight: 20 },
  newsDate: { fontSize: 11, color: ui.textFaint },
  jersey: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  jerseyText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  staffRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
  },
  staffName: { fontSize: 14, fontWeight: "700", color: ui.text },
  staffRole: { fontSize: 12, color: ui.textMuted },
})
