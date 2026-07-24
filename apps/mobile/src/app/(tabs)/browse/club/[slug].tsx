import { useCallback, useEffect, useState } from "react"
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, ListRow, Loading, SectionHeader, StarRating, TonePill, Monogram } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { palette, ui, type Tone } from "@/lib/theme"

/** Club profile — native version of the public /club/[slug] page. Anonymous.
 *
 * Data comes from getClubProfile(), the SAME shared query module the web
 * page's assembly uses (2026-07-24 drift fix) — five-tab visual-parity pass:
 * shared StarRating (was a bespoke Stars() glyph row), color-coded program
 * type pills matching the web's tag chips (was a flat generic pill), a
 * Contact card (address/phone/email/website — the web's Contact block, new
 * on native), and tournament/training program entries (new fields, additive).
 */

type ProgramType = "tryout" | "camp" | "house-league" | "tournament" | "training"

const TYPE_LABEL: Record<ProgramType, string> = {
  tryout: "Tryout",
  camp: "Camp",
  "house-league": "House League",
  tournament: "Tournament",
  training: "Training",
}

// Same family-per-type mapping as the web /events badges and the native
// Programs screen (tryout=danger, camp=violet, tournament=gold,
// training=sky, house-league=positive).
const TYPE_TONE: Record<ProgramType, Tone> = {
  tryout: "danger",
  camp: "violet",
  tournament: "gold",
  training: "sky",
  "house-league": "positive",
}

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
    /** Additive (five-tab parity pass): venue/contact + staff size. */
    address?: string | null
    phoneNumber?: string | null
    contactEmail?: string | null
    staffCount?: number
  }
  programs: Array<{
    id: string
    type: ProgramType
    name: string
    ageGroup: string | null
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
  const hasContact = !!(club.address || club.phoneNumber || club.contactEmail || club.website)

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
            <View style={styles.heroRatingChip}>
              <StarRating rating={rating.average} count={rating.count} size={13} />
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
                  sub={[
                    p.ageGroup,
                    new Date(p.startDate).toLocaleDateString(),
                    p.fee > 0 ? `$${p.fee.toFixed(0)}` : "Free",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  right={<TonePill tone={TYPE_TONE[p.type]} label={TYPE_LABEL[p.type]} />}
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
                  onPress={() => router.push(`/browse/team/${t.id}`)}
                />
              ))}
            </Card>
          </>
        ) : null}

        {hasContact ? (
          <>
            <SectionHeader eyebrow="Get in touch" title="Contact" accent="ink" />
            <Card>
              {club.address ? (
                <ListRow icon="location-outline" text={club.address} tone="neutral" />
              ) : null}
              {club.phoneNumber ? (
                <ListRow
                  icon="call-outline"
                  text={club.phoneNumber}
                  tone="neutral"
                  onPress={() => void Linking.openURL(`tel:${club.phoneNumber}`)}
                />
              ) : null}
              {club.contactEmail ? (
                <ListRow
                  icon="mail-outline"
                  text={club.contactEmail}
                  tone="neutral"
                  onPress={() => void Linking.openURL(`mailto:${club.contactEmail}`)}
                />
              ) : null}
              {club.website ? (
                <ListRow
                  icon="globe-outline"
                  text={club.website.replace(/^https?:\/\//, "")}
                  tone="neutral"
                  onPress={() => void Linking.openURL(club.website!)}
                />
              ) : null}
            </Card>
          </>
        ) : null}

        {reviews.length > 0 ? (
          <>
            <SectionHeader eyebrow="From families" title="Reviews" accent="gold" />
            {reviews.map((r) => (
              <Card key={r.id}>
                <View style={styles.reviewTop}>
                  <StarRating rating={r.rating} size={13} />
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
  heroRatingChip: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  description: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },
  reviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewMeta: { fontSize: 11, color: ui.textFaint },
  reviewTitle: { fontSize: 14, fontWeight: "700", color: ui.text, marginTop: 2 },
})
