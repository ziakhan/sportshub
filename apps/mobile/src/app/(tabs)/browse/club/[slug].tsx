import { useCallback, useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, ListRow, Loading, SectionHeader, TonePill, Monogram } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { palette, ui } from "@/lib/theme"

/** Club profile — native version of the public /club/[slug] page. Anonymous. */

interface ClubProfile {
  club: {
    id: string
    slug: string
    name: string
    description: string | null
    city: string | null
    state: string | null
    website: string | null
    primaryColor: string | null
    teams: Array<{ id: string; name: string; ageGroup: string | null; gender: string | null }>
  }
  programs: Array<{
    id: string
    type: "tryout" | "camp" | "house-league"
    name: string
    ageGroup: string
    startDate: string
    location: string
    fee: number
  }>
  rating: { average: number | null; count: number }
  reviews: Array<{
    id: string
    rating: number
    title: string | null
    content: string | null
    createdAt: string
    reviewer: string
  }>
}

function Stars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={rating >= i - 0.25 ? "star" : rating >= i - 0.75 ? "star-half" : "star-outline"}
          size={14}
          color={palette.gold[500]}
        />
      ))}
    </View>
  )
}

export default function ClubProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [data, setData] = useState<ClubProfile | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await apiJson<ClubProfile>(`/api/mobile/browse/clubs/${slug}`))
    } catch {
      setError(true)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <View style={styles.root}>
        <SubHeader title="Club" />
        <EmptyState icon="business-outline" title="Couldn't load this club" body="Pull back and retry." />
      </View>
    )
  }
  if (!data) {
    return (
      <View style={styles.root}>
        <SubHeader title="Club" />
        <Loading />
      </View>
    )
  }

  const { club, programs, rating, reviews } = data

  return (
    <View style={styles.root}>
      <SubHeader title={club.name} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={[styles.hero, club.primaryColor ? { backgroundColor: club.primaryColor } : null]}>
          <Text style={styles.heroName}>{club.name}</Text>
          {club.city ? (
            <Text style={styles.heroCity}>
              {[club.city, club.state].filter(Boolean).join(", ")}
            </Text>
          ) : null}
          {rating.count > 0 && rating.average != null ? (
            <View style={styles.heroRating}>
              <Stars rating={rating.average} />
              <Text style={styles.heroRatingText}>
                {rating.average.toFixed(1)} · {rating.count} review{rating.count === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null}
        </View>

        {club.description ? (
          <Card>
            <Text style={styles.description}>{club.description}</Text>
          </Card>
        ) : null}

        {programs.length > 0 ? (
          <>
            <SectionHeader eyebrow="Register" title="Programs & tryouts" accent="hoop" />
            <Card>
              {programs.map((p) => (
                <ListRow
                  key={`${p.type}:${p.id}`}
                  icon="pricetags-outline"
                  text={p.name}
                  sub={`${p.ageGroup} · ${new Date(p.startDate).toLocaleDateString()}${p.fee > 0 ? ` · $${p.fee.toFixed(0)}` : ""}`}
                  right={<TonePill tone="info" label={p.type.replace("-", " ")} />}
                  onPress={() => router.push(`/browse/program/${p.type}/${p.id}`)}
                />
              ))}
            </Card>
          </>
        ) : null}

        {club.teams.length > 0 ? (
          <>
            <SectionHeader eyebrow="Competitive" title="Teams" accent="play" />
            <Card>
              {club.teams.map((t) => (
                <ListRow
                  key={t.id}
                  left={<Monogram name={t.name} size={36} />}
                  text={t.name}
                  sub={[t.ageGroup, t.gender].filter(Boolean).join(" · ")}
                  onPress={() => router.push(`/team/${t.id}`)}
                />
              ))}
            </Card>
          </>
        ) : null}

        {reviews.length > 0 ? (
          <>
            <SectionHeader eyebrow="From families" title="Reviews" accent="gold" />
            {reviews.map((r) => (
              <Card key={r.id}>
                <View style={styles.reviewTop}>
                  <Stars rating={r.rating} />
                  <Text style={styles.reviewMeta}>
                    {r.reviewer} · {new Date(r.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                {r.title ? <Text style={styles.reviewTitle}>{r.title}</Text> : null}
                {r.content ? <Text style={styles.description}>{r.content}</Text> : null}
              </Card>
            ))}
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
  hero: {
    backgroundColor: palette.ink[950],
    borderRadius: ui.radius.lg,
    padding: 18,
    gap: 4,
  },
  heroName: { color: "#fff", fontSize: 20, fontWeight: "800" },
  heroCity: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  heroRating: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  heroRatingText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  description: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },
  reviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewMeta: { fontSize: 11, color: ui.textFaint },
  reviewTitle: { fontSize: 14, fontWeight: "700", color: ui.text, marginTop: 2 },
})
