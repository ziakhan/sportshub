import { useCallback, useState } from "react"
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { TopBar } from "@/components/top-bar"
import { Card, ListRow, SectionHeader, TonePill, Monogram } from "@/components/ui"
import { useBrowseHome } from "@/lib/browse"
import { useHome, coachTeamPath } from "@/lib/home"
import { useSession } from "@/lib/session"
import { palette, tones, ui } from "@/lib/theme"

/**
 * Home — the web homepage's shape (site-ia-plan §5.6.3): personal band on
 * top for signed-in participants (actions due, this week, my teams), PUBLIC
 * content below for everyone (live scores entry, featured clubs, leagues,
 * programs, news). Anonymous users land here too — no login wall.
 */

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow"
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
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
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
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

        {signedIn && c && c.coachTeams.length > 0 ? (
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
                <Text style={styles.newsTitle}>{n.title}</Text>
                <Text style={styles.mutedSmall} numberOfLines={2}>
                  {n.excerpt}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  greeting: { fontSize: 22, fontWeight: "800", color: ui.text },
  hero: { gap: 6, paddingVertical: 8 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: ui.text, letterSpacing: -0.5 },
  heroBody: { fontSize: 14, color: ui.textMuted, lineHeight: 20 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: ui.text, marginBottom: 4 },
  section: { gap: 8 },
  sectionCard: { marginTop: 2 },
  bandEyebrow: {
    fontSize: 11,
    fontWeight: "700",
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
  bandLink: { fontSize: 12, fontWeight: "700", color: ui.primaryInk, marginBottom: 8 },
  actionStrip: { gap: 10, paddingRight: 4 },
  actionCard: {
    minWidth: 200,
    borderWidth: 1,
    borderRadius: ui.radius.lg,
    padding: 13,
  },
  actionTitle: { fontSize: 14, fontWeight: "700" },
  actionDetail: { fontSize: 12, marginTop: 2, opacity: 0.8 },
  dayHeader: {
    backgroundColor: ui.surfaceSunken,
    color: ui.textMuted,
    fontSize: 11,
    fontWeight: "700",
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
    width: 56,
    fontSize: 13.5,
    fontWeight: "700",
    color: ui.text,
    fontVariant: ["tabular-nums"],
  },
  weekTitle: { fontSize: 14, fontWeight: "600", color: ui.text },
  weekSub: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
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
  liveBannerText: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "700" },
  programTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  programFee: { fontSize: 14, fontWeight: "800", color: ui.text },
  programName: { fontSize: 15, fontWeight: "700", color: ui.text, marginTop: 4 },
  newsTitle: { fontSize: 14, fontWeight: "700", color: ui.text },
  mutedSmall: { fontSize: 12, color: ui.textMuted, marginTop: 2, lineHeight: 17 },
})
