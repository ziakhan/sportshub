import { useCallback, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { TopBar } from "@/components/top-bar"
import { Card, CoverImage, ListRow, Loading, Monogram, SectionHeader, TonePill } from "@/components/ui"
import { useBrowseHome } from "@/lib/browse"
import { useHome } from "@/lib/home"
import { ui } from "@/lib/theme"

/**
 * Browse hub — the public layer's front door (web top-nav parity): Scores ·
 * Programs · Clubs · Leagues · News as pills up top, with previews of each
 * section below. Fully anonymous.
 */
export default function BrowseHubScreen() {
  const { browse, loaded, refresh } = useBrowseHome()
  const { home } = useHome()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  return (
    <View style={styles.root}>
      <TopBar pills unread={home?.unreadNotifications ?? 0} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!loaded && !browse ? <Loading /> : null}

        <SectionHeader
          eyebrow="Live & upcoming"
          title="Scores"
          accent="court"
          action="Open"
          onAction={() => router.push("/scores")}
        />
        <Card onPress={() => router.push("/scores")}>
          <ListRow icon="basketball-outline" text="Live scores, finals and what's coming up" onPress={() => router.push("/scores")} />
        </Card>

        {browse && browse.programs.length > 0 ? (
          <>
            <SectionHeader
              eyebrow="Register now"
              title="Programs"
              accent="hoop"
              action="See all"
              onAction={() => router.push("/browse/programs")}
            />
            <Card>
              {browse.programs.slice(0, 4).map((p) => (
                <ListRow
                  key={`${p.type}:${p.id}`}
                  icon="pricetags-outline"
                  text={p.name}
                  sub={`${p.clubName ? `${p.clubName} · ` : ""}${new Date(p.startDate).toLocaleDateString()}`}
                  right={<TonePill tone="info" label={p.type.replace("-", " ")} />}
                  onPress={() => router.push(`/browse/program/${p.type}/${p.id}`)}
                />
              ))}
            </Card>
          </>
        ) : null}

        {browse && browse.clubs.length > 0 ? (
          <>
            <SectionHeader
              eyebrow="Find your fit"
              title="Clubs"
              accent="play"
              action="Browse all"
              onAction={() => router.push("/browse/clubs")}
            />
            <Card>
              {browse.clubs.slice(0, 5).map((c) => (
                <ListRow
                  key={c.id}
                  left={<Monogram name={c.name} logoUrl={c.logoUrl} color={c.primaryColor} size={36} />}
                  text={c.name}
                  sub={[c.city, `${c.teamCount} teams`].filter(Boolean).join(" · ")}
                  onPress={() => router.push(`/browse/club/${c.slug}`)}
                />
              ))}
            </Card>
          </>
        ) : null}

        {browse && browse.leagues.length > 0 ? (
          <>
            <SectionHeader
              eyebrow="Standings & schedules"
              title="Leagues"
              accent="court"
              action="Browse all"
              onAction={() => router.push("/browse/leagues")}
            />
            <Card>
              {browse.leagues.slice(0, 5).map((l) => (
                <ListRow
                  key={l.id}
                  icon="trophy-outline"
                  text={l.name}
                  sub={l.seasons[0] ? `${l.seasons[0].name} · ${l.seasons[0].teamCount} teams` : null}
                  onPress={() =>
                    l.seasons[0]
                      ? router.push(`/browse/season/${l.seasons[0].id}`)
                      : router.push("/browse/leagues")
                  }
                />
              ))}
            </Card>
          </>
        ) : null}

        {browse && browse.news.length > 0 ? (
          <>
            <SectionHeader
              eyebrow="Around the hub"
              title="News & recaps"
              accent="gold"
              action="More"
              onAction={() => router.push("/browse/news")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.newsStrip}
            >
              {browse.news.slice(0, 6).map((n) => (
                <Card
                  key={n.id}
                  style={styles.newsCard}
                  onPress={
                    n.href?.startsWith("/news/")
                      ? () => router.push(`/browse/article/${n.href!.split("/")[2]}`)
                      : undefined
                  }
                >
                  <CoverImage url={n.coverUrl} icon="newspaper-outline" />
                  <View style={styles.newsBody}>
                    <Text style={styles.newsTitle} numberOfLines={2}>
                      {n.title}
                    </Text>
                    <Text style={styles.newsDate}>
                      {new Date(n.dateISO).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                </Card>
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.footnote}>
          Everything here is public — sign in to follow teams, RSVP and register.
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  footnote: { fontSize: 12, color: ui.textFaint, textAlign: "center", marginTop: 12 },
  newsStrip: { gap: 10, paddingRight: 4 },
  newsCard: { width: 220, padding: 0, overflow: "hidden" },
  newsBody: { padding: 10, gap: 2 },
  newsTitle: { fontSize: 13, fontWeight: "700", color: ui.text, lineHeight: 17 },
  newsDate: { fontSize: 11, color: ui.textFaint },
})
