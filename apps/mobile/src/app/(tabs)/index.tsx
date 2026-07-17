import { useCallback, useState } from "react"
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { TopBar } from "@/components/top-bar"
import { Card, ListRow, SectionHeader, TonePill, Monogram } from "@/components/ui"
import { useBrowseHome } from "@/lib/browse"
import { useHome, coachTeamPath } from "@/lib/home"
import { useSession } from "@/lib/session"
import { palette, ui } from "@/lib/theme"

/**
 * Home — the web homepage's shape (site-ia-plan §5.6.3): personal band on
 * top for signed-in participants (actions due, this week, my teams), PUBLIC
 * content below for everyone (live scores entry, featured clubs, leagues,
 * programs, news). Anonymous users land here too — no login wall.
 */

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return `${day} · ${time}`
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
          <Card>
            <Text style={styles.cardTitle}>Needs your attention</Text>
            {due.openOffers.map((o) => (
              <ListRow
                key={o.id}
                icon="document-text-outline"
                text={`Offer for ${o.playerName} — ${o.teamName}`}
                onPress={() => router.push(`/offers/${o.id}`)}
              />
            ))}
            {due.paymentsDue > 0 ? (
              <ListRow
                icon="card-outline"
                text={`${due.paymentsDue} payment${due.paymentsDue > 1 ? "s" : ""} due`}
                onPress={() => router.push("/account/payments")}
              />
            ) : null}
            {due.rsvpsNeeded > 0 ? (
              <ListRow
                icon="calendar-outline"
                text={`${due.rsvpsNeeded} RSVP${due.rsvpsNeeded > 1 ? "s" : ""} needed`}
                onPress={() => router.push("/calendar")}
              />
            ) : null}
            {due.unreadChats > 0 ? (
              <ListRow
                icon="chatbubbles-outline"
                text={`${due.unreadChats} unread chat${due.unreadChats > 1 ? "s" : ""}`}
                onPress={() => router.push("/chat")}
              />
            ) : null}
          </Card>
        ) : null}

        {signedIn && c && c.weekEvents.length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>This week</Text>
            {c.weekEvents.slice(0, 5).map((e) => (
              <View key={e.item.id} style={styles.eventRow}>
                <Text style={styles.eventWhen}>{fmtWhen(e.item.at)}</Text>
                <Text style={styles.eventTitle}>{e.item.title}</Text>
                <View style={styles.chipRow}>
                  {e.chips.map((chip) => (
                    <TonePill key={chip} tone="neutral" label={chip} />
                  ))}
                  {e.awaitingRsvp.length > 0 ? (
                    <TonePill tone="warning" label={`RSVP: ${e.awaitingRsvp.join(", ")}`} />
                  ) : null}
                </View>
              </View>
            ))}
            <ListRow
              icon="calendar-outline"
              text="Full calendar"
              onPress={() => router.push("/calendar")}
            />
          </Card>
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
                  {fmtWhen(p.startDate)}
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
  eventRow: { paddingVertical: 8, gap: 2 },
  eventWhen: { fontSize: 12, fontWeight: "700", color: palette.play[700] },
  eventTitle: { fontSize: 14, color: ui.text, fontWeight: "500" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
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
