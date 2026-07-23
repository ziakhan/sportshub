import { useCallback, useState } from "react"
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { TopBar } from "@/components/top-bar"
import { StoriesRail } from "@/components/stories-rail"
import { Card, CoverImage, ListRow, SectionHeader, TonePill, Monogram } from "@/components/ui"
import { useBrowseHome } from "@/lib/browse"
import { apiBaseUrl } from "@/lib/api"
import { useHome, coachTeamPath } from "@/lib/home"
import { useSession } from "@/lib/session"
import { fonts, palette, tones, ui } from "@/lib/theme"

/**
 * Home — the web homepage's shape (site-ia-plan §5.6.3): personal band on
 * top for signed-in participants (actions due, this week, my teams), PUBLIC
 * content below for everyone (live scores entry, featured clubs, leagues,
 * programs, news). Anonymous users land here too — no login wall.
 */

// Times render in UTC to MATCH the web home exactly (the seed writes
// Toronto wall-times as UTC and the web formats the raw fields — device-TZ
// formatting here showed 6:30am for the web's 10:30am. Parity bug 2026-07-25).
const TZ = { timeZone: "UTC" as const }

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow"
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", ...TZ })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function fmtTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", ...TZ })
    .toLowerCase()
    .replace(" ", "")
}

export default function HomeScreen() {
  const { signedIn, user } = useSession()
  const { home, refresh: refreshHome } = useHome()
  const { browse, refresh: refreshBrowse } = useBrowseHome()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refreshBrowse(), signedIn ? refreshHome() : Promise.resolve()])
    setRefreshing(false)
  }, [refreshBrowse, refreshHome, signedIn])

  const c = home?.contexts
  const due = c?.actionsDue
  const dueCount = due
    ? due.openOffers.length + due.paymentsDue + due.rsvpsNeeded + due.unreadChats
    : 0

  return (
    <View style={styles.root}>
      <TopBar pills unread={home?.unreadNotifications ?? 0} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {signedIn ? (
          <Text style={styles.greeting}>
            Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </Text>
        ) : (
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Youth basketball, all in one place</Text>
            <Text style={styles.heroBody}>
              Live scores, standings, clubs, tryouts and team life — browse freely, sign in when
              you join.
            </Text>
          </View>
        )}

        {/* Guest home parity: SCOREBOARD strip + stats band (same data as web) */}
        {!signedIn && browse?.scoreboard && browse.scoreboard.length > 0 ? (
          <View>
            <View style={styles.bandHeaderRow}>
              <Text style={styles.bandEyebrow}>Scoreboard</Text>
              {browse.scoreboard.some((g) => g.status === "LIVE") ? (
                <Text style={styles.liveNow}>● LIVE NOW</Text>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scoreStrip}>
              {browse.scoreboard.slice(0, 8).map((g) => (
                <Pressable key={g.id} style={styles.scoreCard} onPress={() => router.push(`/browse/game/${g.id}`)}>
                  <Text style={[styles.scorePill, g.status === "LIVE" ? styles.scorePillLive : styles.scorePillFinal]}>
                    {g.status === "LIVE" ? "● LIVE" : g.status === "FINAL" ? "FINAL" : fmtDate(g.dateISO)}
                  </Text>
                  {([["home", g.home], ["away", g.away]] as const).map(([k, t]) => (
                    <View key={k} style={styles.scoreRow}>
                      <Monogram name={t.name} color={t.color ?? undefined} size={26} />
                      <Text style={styles.scoreName} numberOfLines={1}>{t.name}</Text>
                      <Text style={styles.scoreNum}>{t.score ?? "–"}</Text>
                    </View>
                  ))}
                  <Text style={styles.scoreMeta} numberOfLines={1}>
                    {[g.leagueName, g.venue].filter(Boolean).join(" · ")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {!signedIn && browse?.stats ? (
          <View style={styles.statsBand}>
            <Text style={styles.statsBandText}>
              <Text style={{ color: palette.court[600] }}>● </Text>
              <Text style={styles.statsBandStrong}>{browse.stats.totalTryouts} tryouts open now</Text>
              {"   ·   "}{browse.stats.totalClubs} clubs{"   ·   "}{browse.stats.totalTeams} teams
            </Text>
          </View>
        ) : null}

        {/* Stories rail (native-parity-v2 P1) — same band as web home */}
        {signedIn ? <StoriesRail /> : null}

        {/* Personal band — signed-in participants only */}
        {signedIn && due && dueCount > 0 ? (
          <View>
            <Text style={styles.bandEyebrow}>Needs your attention</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionStrip}>
              {due.openOffers.slice(0, 2).map((o) => (
                <Pressable key={o.id} style={[styles.actionCard, { backgroundColor: tones.danger.bg, borderColor: tones.danger.border }]} onPress={() => router.push(`/offers/${o.id}`)}>
                  <Text style={[styles.actionTitle, { color: tones.danger.fg }]}>Offer for {o.playerName}</Text>
                  <Text style={[styles.actionDetail, { color: tones.danger.fg }]}>{o.teamName} — accept or decline</Text>
                </Pressable>
              ))}
              {due.paymentsDue > 0 ? (
                <Pressable style={[styles.actionCard, { backgroundColor: tones.gold.bg, borderColor: tones.gold.border }]} onPress={() => router.push("/account/payments")}>
                  <Text style={[styles.actionTitle, { color: tones.gold.fg }]}>{due.paymentsDue} payment{due.paymentsDue > 1 ? "s" : ""} due</Text>
                  <Text style={[styles.actionDetail, { color: tones.gold.fg }]}>View and pay</Text>
                </Pressable>
              ) : null}
              {due.rsvpsNeeded > 0 ? (
                <Pressable style={[styles.actionCard, { backgroundColor: tones.info.bg, borderColor: tones.info.border }]} onPress={() => router.push("/calendar")}>
                  <Text style={[styles.actionTitle, { color: tones.info.fg }]}>{due.rsvpsNeeded} event{due.rsvpsNeeded > 1 ? "s" : ""} awaiting RSVP</Text>
                  <Text style={[styles.actionDetail, { color: tones.info.fg }]}>Going or can&apos;t go?</Text>
                </Pressable>
              ) : null}
              {due.unreadChats > 0 ? (
                <Pressable style={[styles.actionCard, { backgroundColor: tones.positive.bg, borderColor: tones.positive.border }]} onPress={() => router.push("/chat")}>
                  <Text style={[styles.actionTitle, { color: tones.positive.fg }]}>{due.unreadChats} unread message{due.unreadChats > 1 ? "s" : ""}</Text>
                  <Text style={[styles.actionDetail, { color: tones.positive.fg }]}>Open chat</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        {signedIn && c && c.weekEvents.length > 0 ? (
          <View>
            <View style={styles.bandHeaderRow}>
              <Text style={styles.bandEyebrow}>Your week</Text>
              <Text style={styles.bandLink} onPress={() => router.push("/calendar")}>
                Full calendar →
              </Text>
            </View>
            <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
              {(() => {
                const groups: { label: string; events: typeof c.weekEvents }[] = []
                for (const e of c.weekEvents.slice(0, 8)) {
                  const label = dayLabel(e.item.at)
                  const last = groups[groups.length - 1]
                  if (last && last.label === label) last.events.push(e)
                  else groups.push({ label, events: [e] })
                }
                return groups.slice(0, 4).map((g) => (
                  <View key={g.label}>
                    <Text style={styles.dayHeader}>{g.label}</Text>
                    {g.events.slice(0, 4).map((e) => (
                      <Pressable
                        key={`${e.item.kind}:${e.item.id}`}
                        style={({ pressed }) => [styles.weekRow, pressed && { backgroundColor: ui.surfaceSunken }]}
                        onPress={() => router.push("/calendar")}
                      >
                        <Text style={styles.weekTime}>{fmtTime(e.item.at)}</Text>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.weekTitle} numberOfLines={1}>{e.item.title}</Text>
                          <Text style={styles.weekSub} numberOfLines={1}>
                            {[...e.chips, e.item.location].filter(Boolean).join(" · ")}
                          </Text>
                        </View>
                        {e.awaitingRsvp.length > 0 ? (
                          <TonePill tone="info" label={`RSVP: ${e.awaitingRsvp.join(", ")}`} />
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ))
              })()}
            </Card>
          </View>
        ) : null}

        {signedIn && home?.yourTeams && home.yourTeams.length > 0 ? (
          <View>
            <Text style={styles.squadEyebrow}>—  YOUR TEAMS</Text>
            <Text style={styles.squadHeading}>Catch up on your squad</Text>
            {home.yourTeams.slice(0, 4).map((t) => (
              <Card
                key={t.teamId}
                style={styles.squadCard}
                onPress={
                  t.lastGame ? () => router.push(`/browse/game/${t.lastGame!.gameId}`) : undefined
                }
              >
                <View style={styles.squadTop}>
                  <Monogram name={t.teamName.slice(0, 1)} color={t.color ?? undefined} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.squadName} numberOfLines={1}>{t.teamName}</Text>
                    <Text style={styles.mutedSmall} numberOfLines={1}>
                      {[t.clubName, t.ageGroup].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  {t.kidNames.length > 0 ? (
                    <View style={styles.kidTeamPill}>
                      <Text style={styles.kidTeamPillText}>{t.kidNames[0].toUpperCase()}&apos;S TEAM</Text>
                    </View>
                  ) : null}
                </View>
                {t.lastGame ? (
                  <View style={styles.squadGameRow}>
                    <Text style={styles.mutedSmall}>
                      Last game · {new Date(t.lastGame.dateISO).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      {"  vs "}{t.lastGame.opponent}
                    </Text>
                    <Text
                      style={[
                        styles.squadScore,
                        { color: t.lastGame.result === "W" ? palette.court[700] : t.lastGame.result === "L" ? palette.hoop[700] : ui.text },
                      ]}
                    >
                      {t.lastGame.result} {t.lastGame.us}–{t.lastGame.them}
                    </Text>
                  </View>
                ) : null}
                {t.kidLines.slice(0, 2).map((k) => (
                  <View key={k.playerId} style={styles.kidLine}>
                    <Text style={styles.kidLineText}>
                      {k.name}: {k.points} PTS · {k.rebounds} REB · {k.assists} AST →
                    </Text>
                  </View>
                ))}
                {t.nextGame ? (
                  <Text style={styles.mutedSmall} numberOfLines={1}>
                    🗓 Next: vs {t.nextGame.opponent} · {fmtDate(t.nextGame.dateISO)}
                  </Text>
                ) : null}
              </Card>
            ))}
          </View>
        ) : signedIn && c && c.coachTeams.length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>My teams</Text>
            {c.coachTeams.map((t) => (
              <ListRow
                key={t.teamId}
                left={<Monogram name={t.name} size={36} />}
                text={t.name}
                sub={t.clubName}
                onPress={() => router.push(coachTeamPath(t) as any)}
              />
            ))}
          </Card>
        ) : null}

        {/* Public layer — everyone */}
        <Pressable style={styles.liveBanner} onPress={() => router.push("/scores")}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBannerText}>Live scores & this week’s games</Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </Pressable>

        {browse && browse.news.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              eyebrow="Around the hub"
              title="News & recaps"
              accent="gold"
              action="More"
              onAction={() => router.push("/browse/news")}
            />
            {browse.news.slice(0, 4).map((n) => (
              <Card
                key={n.id}
                style={styles.sectionCard}
                onPress={
                  n.href?.startsWith("/news/")
                    ? () => router.push(`/browse/article/${n.href!.split("/")[2]}`)
                    : undefined
                }
              >
                {n.imageUrl ? (
                  <CoverImage url={n.imageUrl} style={styles.newsCover} aspectRatio={16 / 9} />
                ) : null}
                <Text style={styles.newsTitle}>{n.title}</Text>
                <Text style={styles.mutedSmall} numberOfLines={2}>
                  {n.excerpt}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}

        {browse && browse.programs.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              eyebrow="Register now"
              title="Programs & tryouts"
              accent="hoop"
              action="See all"
              onAction={() => router.push("/browse/programs")}
            />
            {browse.programs.slice(0, 3).map((p) => (
              <Card key={`${p.type}:${p.id}`} onPress={() => router.push(`/browse/program/${p.type}/${p.id}`)} style={styles.sectionCard}>
                <View style={styles.programTop}>
                  <TonePill
                    tone={p.type === "tryout" ? "info" : p.type === "camp" ? "gold" : "positive"}
                    label={p.type.replace("-", " ")}
                  />
                  <Text style={styles.programFee}>
                    {p.fee > 0 ? `${p.currency} ${p.fee.toFixed(0)}` : "Free"}
                  </Text>
                </View>
                <Text style={styles.programName}>{p.name}</Text>
                <Text style={styles.mutedSmall}>
                  {p.clubName ? `${p.clubName} · ` : ""}
                  {fmtDate(p.startDate)}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}

        {browse && browse.leagues.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              eyebrow="Standings & schedules"
              title="Leagues"
              accent="court"
              action="Browse all"
              onAction={() => router.push("/browse/leagues")}
            />
            <Card style={styles.sectionCard}>
              {browse.leagues.map((l) => (
                <ListRow
                  key={l.id}
                  left={<Monogram name={l.name} size={36} />}
                  text={l.name}
                  sub={l.seasons
                    .map((s) => `${s.name} · ${s.teamCount} teams`)
                    .slice(0, 1)
                    .join("")}
                  onPress={() =>
                    l.seasons[0]
                      ? router.push(`/browse/season/${l.seasons[0].id}`)
                      : router.push("/browse/leagues")
                  }
                />
              ))}
            </Card>
          </View>
        ) : null}

        {browse && browse.clubs.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              eyebrow="Around you"
              title="Clubs"
              accent="play"
              action="Browse all"
              onAction={() => router.push("/browse/clubs")}
            />
            <Card style={styles.sectionCard}>
              {browse.clubs.map((club) => (
                <ListRow
                  key={club.id}
                  left={
                    <Monogram
                      name={club.name}
                      logoUrl={club.logoUrl}
                      color={club.primaryColor}
                      size={36}
                    />
                  }
                  text={club.name}
                  sub={[club.city, `${club.teamCount} team${club.teamCount === 1 ? "" : "s"}`]
                    .filter(Boolean)
                    .join(" · ")}
                  onPress={() => router.push(`/browse/club/${club.slug}`)}
                />
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 18 },
  greeting: { fontSize: 22, fontFamily: fonts.displayHeavy, color: ui.text },
  hero: { gap: 6, paddingVertical: 8 },
  heroTitle: { fontSize: 24, fontFamily: fonts.displayHeavy, color: ui.text, letterSpacing: -0.5 },
  heroBody: { fontSize: 14, fontFamily: fonts.body, color: ui.textMuted, lineHeight: 20 },
  cardTitle: { fontSize: 15, fontFamily: fonts.display, color: ui.text, marginBottom: 4 },
  section: { gap: 10 },
  sectionCard: { marginTop: 6 },
  bandEyebrow: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: ui.textFaint,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  bandHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 0,
  },
  bandLink: { fontSize: 12, fontFamily: fonts.bodyBold, color: ui.primaryInk, marginBottom: 8 },
  actionStrip: { gap: 10, paddingRight: 4 },
  actionCard: {
    minWidth: 200,
    borderWidth: 1,
    borderRadius: ui.radius.lg,
    padding: 13,
  },
  actionTitle: { fontSize: 15, fontFamily: fonts.bodyBold },
  actionDetail: { fontSize: 13, fontFamily: fonts.body, marginTop: 2, opacity: 0.85 },
  dayHeader: {
    backgroundColor: ui.surfaceSunken,
    color: ui.textMuted,
    fontSize: 11.5,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.border,
  },
  weekTime: {
    width: 60,
    fontSize: 16,
    fontFamily: fonts.condensed,
    color: ui.text,
    fontVariant: ["tabular-nums"],
  },
  weekTitle: { fontSize: 15, fontFamily: fonts.bodySemi, color: ui.text },
  weekSub: { fontSize: 13, fontFamily: fonts.body, color: ui.textMuted, marginTop: 1 },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.ink[950],
    borderRadius: ui.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ui.live },
  liveBannerText: { flex: 1, color: "#fff", fontSize: 14, fontFamily: fonts.bodyBold },
  programTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  programFee: { fontSize: 14, fontFamily: fonts.displayHeavy, color: ui.text },
  programName: { fontSize: 15, fontFamily: fonts.display, color: ui.text, marginTop: 4 },
  newsCover: { width: "100%", aspectRatio: 1200 / 675, borderRadius: 12, marginBottom: 8 },
  newsTitle: { fontSize: 14.5, fontFamily: fonts.display, color: ui.text },
  mutedSmall: { fontSize: 12, fontFamily: fonts.body, color: ui.textMuted, marginTop: 2, lineHeight: 17 },
  squadCard: { marginTop: 10, gap: 10 },
  squadEyebrow: { fontSize: 11, fontFamily: fonts.bodyBold, color: palette.hoop[500], letterSpacing: 2, textTransform: "uppercase" },
  squadHeading: { fontSize: 26, fontFamily: fonts.displayHeavy, color: ui.text, marginTop: 2, marginBottom: 6, letterSpacing: -0.5 },
  kidTeamPill: { backgroundColor: "#fef3ee", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  kidTeamPillText: { fontSize: 10, fontFamily: fonts.bodyBold, color: "#bc2711", letterSpacing: 0.6 },
  liveNow: { fontSize: 11, fontFamily: fonts.bodyBold, color: "#dc2626", backgroundColor: "#fef2f2", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden", marginBottom: 8 },
  scoreStrip: { gap: 10, paddingRight: 4 },
  scoreCard: { width: 240, backgroundColor: "#fff", borderRadius: 16, padding: 12, gap: 7, shadowColor: "#18181b", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  scorePill: { alignSelf: "flex-start", fontSize: 10.5, fontFamily: fonts.bodyBold, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  scorePillLive: { color: "#dc2626", backgroundColor: "#fef2f2" },
  scorePillFinal: { color: "#5e5e6e", backgroundColor: "#eeeef1" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  scoreName: { flex: 1, fontSize: 13.5, fontFamily: fonts.bodySemi, color: ui.text },
  scoreNum: { fontSize: 20, fontFamily: fonts.condensed, color: ui.text },
  scoreMeta: { fontSize: 11, fontFamily: fonts.body, color: ui.textFaint },
  statsBand: { backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "center", shadowColor: "#18181b", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  statsBandText: { fontSize: 12.5, fontFamily: fonts.bodyMed, color: ui.textMuted },
  statsBandStrong: { fontFamily: fonts.bodyBold, color: ui.text },
  squadTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  squadName: { fontSize: 16, fontFamily: fonts.display, color: ui.text },
  squadGameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: ui.surfaceSunken,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  squadScore: { fontSize: 15, fontFamily: fonts.condensed },
  kidLine: {
    backgroundColor: "#fef3ee",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  kidLineText: { fontSize: 13, fontFamily: fonts.bodyBold, color: "#bc2711" },
})
