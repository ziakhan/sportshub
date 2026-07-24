import { useCallback, useEffect, useState } from "react"
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { SubHeader } from "@/components/top-bar"
import {
  Card,
  CoverImage,
  EmptyState,
  GameRow,
  HeroBand,
  HeroCrest,
  HeroStatRow,
  Loading,
  SectionHeader,
  TonePill,
  type GameRowData,
} from "@/components/ui"
import { apiBaseUrl, apiJson } from "@/lib/api"
import { brandTokens } from "@/lib/brand"
import { perkLabel } from "@/lib/perks"
import { ui } from "@/lib/theme"

/**
 * League season — native twin of the public /league/[id] page, 2026-07-25
 * rebuild to match the club/team visual bar: full-bleed hero in the
 * league's own brand color, perks ("what's included"), scores & schedule,
 * standings per division (PCT + STRK columns, leader highlight — web
 * parity), league news, teams grouped by division, scoring leaders, and a
 * season-info + registration card. Anonymous.
 */

type SeasonGame = GameRowData

interface NewsItem {
  id: string
  title: string
  slug: string
  publishedAt: string | null
  coverUrl: string | null
  isRecap: boolean
}

interface StandingsRow {
  teamId: string
  name: string
  wins: number
  losses: number
  winPct: number
  gamesPlayed: number
}

interface StandingsDivision {
  divisionId: string
  divisionName: string
  rows: StandingsRow[]
}

interface Standings {
  divisions: StandingsDivision[]
  streaks: Record<string, string>
  tiebreakerOrder: string[]
}

interface SeasonDetail {
  season: {
    id: string
    name: string
    status: string
    startDate: string | null
    endDate: string | null
    registrationDeadline: string | null
    teamFee: number | null
    currency: string
    gamesGuaranteed: number | null
    playoffFormat: string | null
    league: {
      id: string
      name: string
      description: string | null
      perks: string[]
      perksNote: string | null
      logoUrl: string | null
      bannerUrl: string | null
      tagline: string | null
      primaryColor: string | null
      socials: Array<{ key: string; label: string; href: string }>
    } | null
    divisions: Array<{ id: string; name: string; ageGroup: string }>
  }
  teams: Array<{ id: string; name: string; clubName: string | null; clubSlug: string | null; divisionName: string | null }>
  standings: Standings | null
  leaders: Array<{ playerId: string; name: string; teamName: string; value: number }>
  upcoming: SeasonGame[]
  recent: SeasonGame[]
  live: SeasonGame[]
  news: NewsItem[]
}

function pctLabel(pct: number): string {
  return pct.toFixed(3).replace(/^0/, "")
}

export default function SeasonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [data, setData] = useState<SeasonDetail | null>(null)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await apiJson<SeasonDetail>(`/api/mobile/browse/seasons/${id}`))
      setError(false)
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
        <SubHeader title="League" fallback="/browse/leagues" />
        <EmptyState icon="trophy-outline" title="Couldn't load this league" />
      </View>
    )
  }
  if (!data) {
    return (
      <View style={styles.root}>
        <SubHeader title="League" fallback="/browse/leagues" />
        <Loading />
      </View>
    )
  }

  const { season, teams, standings, leaders, upcoming, recent, live, news } = data
  const league = season.league
  const brand = brandTokens(league?.primaryColor)
  const isOpen = season.status === "REGISTRATION"
  const deadlinePassed = !!season.registrationDeadline && new Date(season.registrationDeadline) < new Date()
  const completedCount = standings
    ? Math.round(standings.divisions.reduce((acc, d) => acc + d.rows.reduce((a, r) => a + r.gamesPlayed, 0), 0) / 2)
    : 0

  const teamsByDivision = new Map<string, typeof teams>()
  for (const t of teams) {
    const key = t.divisionName ?? "Teams"
    const list = teamsByDivision.get(key) ?? []
    list.push(t)
    teamsByDivision.set(key, list)
  }

  const heroStats = [
    { value: String(teams.length), label: teams.length === 1 ? "Team" : "Teams" },
    { value: String(completedCount), label: "Games played" },
    { value: String(season.divisions.length), label: "Divisions" },
    live.length > 0
      ? { value: String(live.length), label: "Live now" }
      : { value: String(upcoming.length), label: "Upcoming" },
  ]

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <HeroBand color={brand.brand} onColor={brand.onBrand} bannerUrl={league?.bannerUrl} fallback="/browse/leagues">
          <View style={styles.heroTop}>
            <HeroCrest name={league?.name ?? season.name} logoUrl={league?.logoUrl} ink={brand.ink} size={56} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.heroName, { color: brand.onBrand }]} numberOfLines={2}>
                {league?.name ?? season.name}
              </Text>
              <View style={styles.heroPillRow}>
                {season.status === "IN_PROGRESS" ? <TonePill tone="gold" label="Season underway" /> : null}
                {isOpen && !deadlinePassed ? <TonePill tone="positive" label="Registration open" /> : null}
                <TonePill tone="neutral" label={season.name} />
              </View>
            </View>
          </View>
          {league?.tagline ? (
            <Text style={[styles.heroTagline, { color: brand.onBrand }]} numberOfLines={2}>
              {league.tagline}
            </Text>
          ) : null}
          <HeroStatRow stats={heroStats} onColor={brand.onBrand} />
        </HeroBand>

        <View style={styles.body}>
          {league?.description ? (
            <Card>
              <Text style={styles.description}>{league.description}</Text>
            </Card>
          ) : null}

          {(league?.perks?.length ?? 0) > 0 || league?.perksNote ? (
            <>
              <SectionHeader eyebrow="Included" title="What's included" color={brand.ink} />
              <Card>
                {league?.perksNote ? <Text style={[styles.description, { marginBottom: 10 }]}>{league.perksNote}</Text> : null}
                <View style={styles.perkWrap}>
                  {league?.perks.map((entry) => (
                    <View key={entry} style={[styles.perkChip, { backgroundColor: brand.soft }]}>
                      <Ionicons name="checkmark" size={13} color={brand.ink} />
                      <Text style={[styles.perkText, { color: brand.ink }]}>{perkLabel(entry)}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          ) : null}

          {live.length + upcoming.length + recent.length > 0 ? (
            <>
              <SectionHeader eyebrow="Games" title="Scores & schedule" color={brand.ink} />
              <Card>
                {live.map((g) => (
                  <GameRow key={g.id} game={g} onPress={() => router.push(`/browse/game/${g.id}`)} />
                ))}
                {upcoming.map((g) => (
                  <GameRow key={g.id} game={g} onPress={() => router.push(`/browse/game/${g.id}`)} />
                ))}
                {recent.map((g) => (
                  <GameRow key={g.id} game={g} onPress={() => router.push(`/browse/game/${g.id}`)} />
                ))}
              </Card>
            </>
          ) : null}

          {(standings?.divisions ?? []).some((d) => d.rows.length > 0) ? (
            <>
              <SectionHeader eyebrow="Rankings" title="Standings" color={brand.ink} />
              {standings!.divisions
                .filter((d) => d.rows.length > 0)
                .map((division) => (
                  <View key={division.divisionId} style={{ gap: 6 }}>
                    <Text style={styles.divisionLabel}>{division.divisionName}</Text>
                    <Card style={{ paddingVertical: 6 }}>
                      <View style={[styles.standRow, styles.standHead]}>
                        <Text style={[styles.standRank, styles.standHeadText]}>#</Text>
                        <Text style={[styles.standTeam, styles.standHeadText]}>Team</Text>
                        <Text style={[styles.standNum, styles.standHeadText]}>W</Text>
                        <Text style={[styles.standNum, styles.standHeadText]}>L</Text>
                        <Text style={[styles.standNum, styles.standHeadText]}>PCT</Text>
                        <Text style={[styles.standStrk, styles.standHeadText]}>STRK</Text>
                      </View>
                      {division.rows.map((row, idx) => {
                        const leader = idx === 0
                        const streak = standings!.streaks[row.teamId]
                        return (
                          <Pressable
                            key={row.teamId}
                            style={({ pressed }) => [
                              styles.standRow,
                              leader && { backgroundColor: brand.soft },
                              pressed && { backgroundColor: ui.surfaceSunken },
                            ]}
                            onPress={() => router.push(`/browse/team/${row.teamId}`)}
                          >
                            <Text style={[styles.standRank, leader && { color: brand.ink, fontWeight: "800" }]}>{idx + 1}</Text>
                            <Text style={[styles.standTeam, leader && { color: brand.ink, fontWeight: "800" }]} numberOfLines={1}>
                              {row.name}
                            </Text>
                            <Text style={styles.standNum}>{row.wins}</Text>
                            <Text style={styles.standNum}>{row.losses}</Text>
                            <Text style={styles.standNum}>{pctLabel(row.winPct)}</Text>
                            <Text style={styles.standStrk}>{streak ?? "—"}</Text>
                          </Pressable>
                        )
                      })}
                    </Card>
                  </View>
                ))}
            </>
          ) : null}

          {news.length > 0 ? (
            <>
              <SectionHeader eyebrow="Highlights" title="League news" color={brand.ink} />
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

          {teamsByDivision.size > 0 ? (
            <>
              <SectionHeader eyebrow="Field" title="Teams" color={brand.ink} />
              {[...teamsByDivision.entries()].map(([divisionName, list]) => (
                <View key={divisionName} style={{ gap: 6 }}>
                  <Text style={styles.divisionLabel}>{divisionName}</Text>
                  <Card>
                    {list.map((t) => (
                      <Pressable
                        key={t.id}
                        style={({ pressed }) => [styles.teamRow, pressed && { backgroundColor: ui.surfaceSunken }]}
                        onPress={() => router.push(`/browse/team/${t.id}`)}
                      >
                        <Text style={styles.teamName} numberOfLines={1}>
                          {t.name}
                        </Text>
                        {t.clubName ? (
                          <Text style={styles.teamClub} numberOfLines={1}>
                            {t.clubName}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </Card>
                </View>
              ))}
            </>
          ) : null}

          {leaders.length > 0 ? (
            <>
              <SectionHeader eyebrow="PPG" title="Scoring leaders" color={brand.ink} />
              <Card>
                {leaders.map((row, i) => (
                  <Pressable
                    key={row.playerId}
                    style={({ pressed }) => [styles.leaderRow, pressed && { backgroundColor: ui.surfaceSunken }]}
                    onPress={() => router.push(`/browse/player/${row.playerId}`)}
                  >
                    <Text style={[styles.leaderRank, i === 0 && { color: "#b45309" }]}>{i + 1}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.leaderName} numberOfLines={1}>
                        {row.name}
                      </Text>
                      <Text style={styles.leaderTeam} numberOfLines={1}>
                        {row.teamName}
                      </Text>
                    </View>
                    <Text style={styles.leaderValue}>{row.value.toFixed(1)}</Text>
                  </Pressable>
                ))}
              </Card>
            </>
          ) : null}

          <SectionHeader eyebrow="Info" title="Season" color={brand.ink} />
          <Card style={{ gap: 8 }}>
            {season.startDate ? (
              <InfoLine
                label="Dates"
                value={`${new Date(season.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${
                  season.endDate ? new Date(season.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBD"
                }`}
              />
            ) : null}
            <InfoLine label="Teams" value={String(teams.length)} />
            <InfoLine label="Divisions" value={String(season.divisions.length)} />
            {season.gamesGuaranteed ? <InfoLine label="Games guaranteed" value={String(season.gamesGuaranteed)} /> : null}
            {season.playoffFormat ? <InfoLine label="Playoffs" value={season.playoffFormat.replace(/_/g, " ")} /> : null}
          </Card>

          {isOpen || season.teamFee ? (
            <Card style={{ alignItems: "center", gap: 10 }}>
              {season.teamFee ? (
                <View style={{ alignItems: "center" }}>
                  <Text style={[styles.feeValue, { color: brand.ink }]}>${Number(season.teamFee).toFixed(0)}</Text>
                  <Text style={styles.feeUnit}>per team</Text>
                </View>
              ) : null}
              {isOpen && !deadlinePassed ? (
                <>
                  <Pressable
                    style={[styles.registerButton, { backgroundColor: brand.brand }]}
                    onPress={() => void Linking.openURL(`${apiBaseUrl()}/browse-leagues/${season.id}`)}
                  >
                    <Text style={[styles.registerButtonText, { color: brand.onBrand }]}>Register your team</Text>
                  </Pressable>
                  {season.registrationDeadline ? (
                    <Text style={styles.feeUnit}>
                      Deadline {new Date(season.registrationDeadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.feeUnit}>{deadlinePassed ? "Registration is closed." : "Registration is not open."}</Text>
              )}
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  heroPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  heroTagline: { fontSize: 13.5, opacity: 0.9, marginTop: 10, lineHeight: 18 },
  description: { fontSize: 13.5, color: ui.textMuted, lineHeight: 20 },
  perkWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  perkChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  perkText: { fontSize: 12.5, fontWeight: "700" },
  divisionLabel: { fontSize: 11, fontWeight: "800", color: ui.textFaint, textTransform: "uppercase", letterSpacing: 0.6, paddingHorizontal: 2 },
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
  // Full-bleed 16:9 cover cards (news law: news is ALWAYS a card) — cover
  // bleeds to the card edge, padding lives on the body.
  newsCard: { marginBottom: 10, padding: 0, overflow: "hidden" },
  newsBody: { padding: 12, gap: 4 },
  newsMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  newsTitle: { fontSize: 15, fontWeight: "700", color: ui.text, lineHeight: 20 },
  newsDate: { fontSize: 11, color: ui.textFaint },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.border,
  },
  teamName: { fontSize: 13.5, fontWeight: "700", color: ui.text, flexShrink: 1 },
  teamClub: { fontSize: 11.5, color: ui.textFaint, marginLeft: 8 },
  leaderRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  leaderRank: { width: 16, textAlign: "center", fontSize: 12, fontWeight: "800", color: ui.textFaint },
  leaderName: { fontSize: 13.5, fontWeight: "700", color: ui.text },
  leaderTeam: { fontSize: 11.5, color: ui.textFaint, marginTop: 1 },
  leaderValue: { fontSize: 15, fontWeight: "800", color: ui.text, fontVariant: ["tabular-nums"] },
  infoLine: { flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { fontSize: 13, color: ui.textMuted },
  infoValue: { fontSize: 13, fontWeight: "700", color: ui.text },
  feeValue: { fontSize: 30, fontWeight: "800", fontVariant: ["tabular-nums"] },
  feeUnit: { fontSize: 12, color: ui.textFaint },
  registerButton: { alignSelf: "stretch", borderRadius: ui.radius.md, paddingVertical: 13, alignItems: "center" },
  registerButtonText: { fontSize: 14.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
})
