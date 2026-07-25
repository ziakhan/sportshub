import { useCallback, useEffect, useState } from "react"
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
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
  Monogram,
  SectionHeader,
  StarRating,
  TonePill,
  type GameRowData,
} from "@/components/ui"
import { apiJson } from "@/lib/api"
import { brandTokens } from "@/lib/brand"
import { fetchFollowStatus, followTarget, unfollowTarget, type FollowState } from "@/lib/follows"
import { useSession } from "@/lib/session"
import { tones, ui, type Tone } from "@/lib/theme"

/**
 * Club profile — native twin of the public /club/[slug] page (2026-07-25
 * full rebuild, the platform's sales surface to clubs). Section order
 * mirrors the web block system (lib/club-page/blocks.ts default layout):
 * Announcements → Programs → Teams → Schedule → Reviews → News → Contact.
 * Data comes from getClubProfile(), the SAME shared query module the web
 * page's assembly uses.
 *
 * Skipped vs web (documented, not oversights):
 *  - Sticky scroll-spy sub-nav: native is one continuous scroll — every
 *    section is already a short scroll away, no anchor jump needed.
 *  - "View programs" hero CTA / anchor buttons: same reason.
 *  - Claim action: an authenticated business-verification upload flow, out
 *    of scope here. Follow is wired (lib/follows.ts, same /api/follows
 *    routes the web FollowButton uses) — signed-in only, shown as a pill in
 *    the hero; follower count updates optimistically.
 *  - Trainer 1-on-1 interactive booking widget: a multi-step form, out of
 *    scope for this visual pass.
 *  - "Edit page" affordance: management-only, not part of anonymous browse.
 */

type ProgramType = "tryout" | "camp" | "house-league" | "tournament" | "training"

const TYPE_LABEL: Record<ProgramType, string> = {
  tryout: "Tryout",
  camp: "Camp",
  "house-league": "House League",
  tournament: "Tournament",
  training: "Training",
}

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
    country: string | null
    website: string | null
    status: string
    primaryColor: string | null
    logoUrl: string | null
    tagline: string | null
    bannerUrl: string | null
    zipCode: string | null
    followerCount: number
    teams: Array<{ id: string; name: string; ageGroup: string | null; gender: string | null }>
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
  announcements: Array<{ id: string; title: string; content: string; isPinned: boolean; createdAt: string }>
  recentGames: GameRowData[]
  upcomingGames: GameRowData[]
  news: Array<{ id: string; title: string; slug: string; publishedAt: string | null; coverUrl: string | null }>
}

export default function ClubProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { signedIn } = useSession()
  const [data, setData] = useState<ClubProfile | null>(null)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [followState, setFollowState] = useState<FollowState>("NONE")
  const [followBusy, setFollowBusy] = useState(false)
  const [followerCount, setFollowerCount] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const club = await apiJson<ClubProfile>(`/api/mobile/browse/clubs/${slug}`)
      setData(club)
      setFollowerCount(club.club.followerCount)
      setError(false)
    } catch {
      setError(true)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!signedIn || !data) return
    fetchFollowStatus({ tenantId: data.club.id })
      .then((res) => setFollowState(res.status))
      .catch(() => {
        // status check failed — leave the pill at NONE, next toggle retries
      })
  }, [signedIn, data?.club.id])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const toggleFollow = useCallback(async () => {
    if (!data || followBusy) return
    const wasState = followState
    const wasCount = followerCount ?? data.club.followerCount
    const creating = wasState === "NONE"
    setFollowBusy(true)
    setFollowState(creating ? "ACTIVE" : "NONE") // optimistic; corrected below
    setFollowerCount(creating ? wasCount + 1 : Math.max(0, wasCount - 1))
    try {
      if (creating) {
        const res = await followTarget({ tenantId: data.club.id })
        setFollowState(res.status)
        if (res.status !== "ACTIVE") setFollowerCount(wasCount) // PENDING doesn't count yet
      } else {
        await unfollowTarget({ tenantId: data.club.id })
      }
    } catch {
      setFollowState(wasState)
      setFollowerCount(wasCount)
    } finally {
      setFollowBusy(false)
    }
  }, [data, followBusy, followState, followerCount])

  if (error) {
    return (
      <View style={styles.root}>
        <SubHeader title="Club" fallback="/browse/clubs" />
        <EmptyState icon="business-outline" title="Couldn't load this club" body="Pull back and retry." />
      </View>
    )
  }
  if (!data) {
    return (
      <View style={styles.root}>
        <SubHeader title="Club" fallback="/browse/clubs" />
        <Loading />
      </View>
    )
  }

  const { club, programs, rating, reviews, announcements, recentGames, upcomingGames, news } = data
  const brand = brandTokens(club.primaryColor)
  const hasContact = !!(club.address || club.phoneNumber || club.contactEmail || club.website)
  const subtitle = [club.city, club.state, club.country].filter(Boolean).join(", ")
  const shownFollowerCount = followerCount ?? club.followerCount

  const heroStats = [
    { value: String(club.teams.length), label: club.teams.length === 1 ? "Team" : "Teams" },
    { value: String(programs.length), label: "Programs" },
    { value: String(club.staffCount ?? 0), label: "Staff" },
    { value: String(shownFollowerCount), label: shownFollowerCount === 1 ? "Follower" : "Followers" },
  ]

  const openMaps = () => {
    const full = [club.address, club.city, club.state, club.zipCode].filter(Boolean).join(", ")
    if (full) void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`)
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <HeroBand color={brand.brand} onColor={brand.onBrand} bannerUrl={club.bannerUrl} fallback="/browse/clubs">
          <View style={styles.heroTop}>
            <HeroCrest name={club.name} logoUrl={club.logoUrl} ink={brand.ink} size={60} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.heroNameRow}>
                <Text style={[styles.heroName, { color: brand.onBrand }]} numberOfLines={2}>
                  {club.name}
                </Text>
                {club.status === "UNCLAIMED" ? <TonePill tone="warning" label="Unclaimed" /> : null}
              </View>
              {subtitle ? (
                <View style={styles.heroMetaRow}>
                  <Ionicons name="location" size={12.5} color={brand.onBrand} style={{ opacity: 0.85 }} />
                  <Text style={[styles.heroMeta, { color: brand.onBrand }]} numberOfLines={1}>
                    {subtitle}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          {club.tagline ? (
            <Text style={[styles.heroTagline, { color: brand.onBrand }]} numberOfLines={2}>
              {club.tagline}
            </Text>
          ) : null}
          {rating.count > 0 && rating.average != null ? (
            // StarRating hardcodes dark ink text (built for white cards) —
            // a white chip behind it guarantees contrast against ANY brand
            // hero color, same fix the pre-rebuild hero used.
            <View style={styles.heroRatingChip}>
              <StarRating rating={rating.average} count={rating.count} size={13} />
            </View>
          ) : null}
          {signedIn && club.status !== "UNCLAIMED" ? (
            <FollowPill
              following={followState === "ACTIVE"}
              pending={followState === "PENDING"}
              onColor={brand.onBrand}
              busy={followBusy}
              onPress={toggleFollow}
            />
          ) : null}
          <HeroStatRow stats={heroStats} onColor={brand.onBrand} />
        </HeroBand>

        <View style={styles.body}>
          {club.description ? (
            <Card>
              <Text style={styles.description}>{club.description}</Text>
            </Card>
          ) : null}

          {announcements.length > 0 ? (
            <>
              <SectionHeader eyebrow="Latest" title="Announcements" color={brand.ink} />
              <Card>
                {announcements.slice(0, 3).map((a, i) => (
                  <View key={a.id} style={[styles.announcement, i > 0 && styles.announcementDivider]}>
                    <View style={styles.announcementTop}>
                      {a.isPinned ? (
                        <View style={[styles.pinnedTag, { backgroundColor: brand.soft }]}>
                          <Text style={[styles.pinnedTagText, { color: brand.ink }]}>Pinned</Text>
                        </View>
                      ) : null}
                      <Text style={styles.announcementTitle} numberOfLines={1}>
                        {a.title}
                      </Text>
                    </View>
                    <Text style={styles.announcementBody} numberOfLines={3}>
                      {a.content}
                    </Text>
                    <Text style={styles.announcementDate}>
                      {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {programs.length > 0 ? (
            <>
              <SectionHeader eyebrow="Register" title="Open programs" color={brand.ink} />
              <Card style={{ padding: 6 }}>
                {programs.map((p) => (
                  <ProgramCard
                    key={`${p.type}:${p.id}`}
                    program={p}
                    ink={brand.ink}
                    onPress={() => router.push(`/browse/program/${p.type}/${p.id}`)}
                  />
                ))}
              </Card>
            </>
          ) : null}

          {club.teams.length > 0 ? (
            <>
              <SectionHeader eyebrow="Competitive" title="Teams" color={brand.ink} />
              <Card>
                {club.teams.map((t) => (
                  <ListRow
                    key={t.id}
                    left={<Monogram name={t.name} color={brand.brand} size={36} />}
                    text={t.name}
                    sub={[t.ageGroup, t.gender].filter(Boolean).join(" · ")}
                    onPress={() => router.push(`/browse/team/${t.id}`)}
                  />
                ))}
              </Card>
            </>
          ) : null}

          {upcomingGames.length + recentGames.length > 0 ? (
            <>
              <SectionHeader eyebrow="Games" title="Schedule & scores" color={brand.ink} />
              <Card>
                {upcomingGames.map((g) => (
                  <GameRow key={g.id} game={g} onPress={() => router.push(`/browse/game/${g.id}`)} />
                ))}
                {recentGames.map((g) => (
                  <GameRow key={g.id} game={g} onPress={() => router.push(`/browse/game/${g.id}`)} />
                ))}
              </Card>
            </>
          ) : null}

          <SectionHeader eyebrow="From families" title="Reviews" color={brand.ink} />
          <Card>
            {rating.average != null ? (
              <View style={styles.reviewSummary}>
                <StarRating rating={rating.average} count={rating.count} size={16} />
              </View>
            ) : null}
            {reviews.length === 0 ? (
              <Text style={styles.description}>No reviews yet — be the first family to share your experience.</Text>
            ) : (
              reviews.slice(0, 4).map((r, i) => (
                <View key={r.id} style={[styles.review, i > 0 && styles.announcementDivider]}>
                  <View style={styles.reviewTop}>
                    <StarRating rating={r.rating} size={12.5} />
                    <Text style={styles.reviewMeta}>
                      {r.reviewer} · {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                    </Text>
                  </View>
                  {r.title ? <Text style={styles.reviewTitle}>{r.title}</Text> : null}
                  {r.content ? (
                    <Text style={styles.description} numberOfLines={3}>
                      {r.content}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </Card>

          {news.length > 0 ? (
            <>
              <SectionHeader eyebrow="Highlights" title="News" color={brand.ink} />
              {news.slice(0, 3).map((n) => (
                <Card key={n.id} style={styles.newsCard} onPress={() => router.push(`/browse/article/${n.slug}`)}>
                  <CoverImage url={n.coverUrl} icon="newspaper-outline" />
                  <View style={styles.newsBody}>
                    <Text style={styles.newsTitle} numberOfLines={2}>
                      {n.title}
                    </Text>
                    {n.publishedAt ? (
                      <Text style={styles.newsDate}>
                        {new Date(n.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              ))}
            </>
          ) : null}

          {hasContact ? (
            <>
              <SectionHeader eyebrow="Get in touch" title="Contact" color={brand.ink} />
              <Card>
                {club.address ? (
                  <ListRow
                    icon="location-outline"
                    text={club.address}
                    sub={[club.city, club.state, club.zipCode].filter(Boolean).join(", ") || null}
                    tone="neutral"
                    onPress={openMaps}
                  />
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
        </View>
      </ScrollView>
    </View>
  )
}

function ProgramCard({
  program,
  ink,
  onPress,
}: {
  program: ClubProfile["programs"][number]
  ink: string
  onPress: () => void
}) {
  const isFree = program.fee === 0
  return (
    <Pressable style={({ pressed }) => [styles.programRow, pressed && { backgroundColor: ui.surfaceSunken }]} onPress={onPress}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <TonePill tone={TYPE_TONE[program.type]} label={TYPE_LABEL[program.type]} />
        <Text style={styles.programTitle} numberOfLines={1}>
          {program.name}
        </Text>
        <Text style={styles.programMeta} numberOfLines={1}>
          {[program.ageGroup, new Date(program.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }), program.location]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <View style={styles.programRight}>
        <Text style={[styles.programPrice, { color: isFree ? tones.positive.fg : ink }]}>
          {isFree ? "Free" : `$${program.fee.toFixed(0)}`}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={ui.textFaint} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { paddingBottom: 32 },
  body: { padding: 16, gap: 14 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  heroNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  heroName: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  heroMeta: { fontSize: 13, opacity: 0.85, flexShrink: 1 },
  heroTagline: { fontSize: 14, opacity: 0.92, marginTop: 10, lineHeight: 19 },
  heroRatingChip: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  description: { fontSize: 13.5, color: ui.textMuted, lineHeight: 20 },
  announcement: { paddingVertical: 10, gap: 4 },
  announcementDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.border },
  announcementTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  pinnedTag: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1.5 },
  pinnedTagText: { fontSize: 9.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  announcementTitle: { fontSize: 14.5, fontWeight: "700", color: ui.text, flexShrink: 1 },
  announcementBody: { fontSize: 13, color: ui.textMuted, lineHeight: 18 },
  announcementDate: { fontSize: 11, color: ui.textFaint },
  programRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: ui.radius.md,
  },
  programTitle: { fontSize: 14.5, fontWeight: "700", color: ui.text, marginTop: 5 },
  programMeta: { fontSize: 12, color: ui.textMuted, marginTop: 2 },
  programRight: { alignItems: "flex-end", gap: 4 },
  programPrice: { fontSize: 17, fontWeight: "800", fontVariant: ["tabular-nums"] },
  reviewSummary: { paddingBottom: 10, marginBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.border },
  review: { paddingVertical: 10, gap: 3 },
  reviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewMeta: { fontSize: 11, color: ui.textFaint },
  reviewTitle: { fontSize: 14, fontWeight: "700", color: ui.text, marginTop: 2 },
  // Full-bleed 16:9 cover cards (news law: news is ALWAYS a card, never a
  // compact row) — cover bleeds to the card edge, padding lives on the body.
  newsCard: { marginBottom: 10, padding: 0, overflow: "hidden" },
  newsBody: { padding: 12, gap: 4 },
  newsTitle: { fontSize: 15, fontWeight: "700", color: ui.text, lineHeight: 20 },
  newsDate: { fontSize: 11, color: ui.textFaint },
})
