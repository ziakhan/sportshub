import { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, Loading, Monogram, StarRating, TonePill } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { palette, ui } from "@/lib/theme"

/**
 * Clubs directory — /api/mobile/browse/clubs, shared with the web /club page
 * via getClubsDirectory() (2026-07-24 drift fix + native-parity pass): the
 * screen used to hit /api/clubs/public, a separate query with no
 * test-world exclusion and no featured/city grouping. Now: debounced name
 * search, city filter chips (from the API's own city list), a Featured
 * section, then the rest of the directory, star ratings and a gold
 * "Featured clubs" eyebrow — matching the web page's shape exactly (five-tab
 * visual-parity pass 2026-07-24). Anonymous.
 */

interface DirectoryClub {
  id: string
  slug: string
  name: string
  city: string | null
  state: string | null
  description: string | null
  status: string
  teamCount: number
  tryoutCount: number
  primaryColor: string | null
  logoUrl: string | null
  rating?: { average: number; count: number } | null
}

interface DirectoryCity {
  city: string
  count: number
}

interface ClubsResponse {
  clubs: DirectoryClub[]
  featured: DirectoryClub[]
  cities: DirectoryCity[]
}

type Section = { title: string; data: DirectoryClub[] }

export default function ClubsDirectoryScreen() {
  const [q, setQ] = useState("")
  const [city, setCity] = useState<string | undefined>(undefined)
  const [data, setData] = useState<ClubsResponse | null>(null)

  const load = useCallback(async (query: string, cityFilter: string | undefined) => {
    try {
      const params = new URLSearchParams()
      if (query.length >= 2) params.set("q", query)
      if (cityFilter) params.set("city", cityFilter)
      const qs = params.toString()
      const res = await apiJson<ClubsResponse>(`/api/mobile/browse/clubs${qs ? `?${qs}` : ""}`)
      setData(res)
    } catch {
      setData((cur) => cur ?? { clubs: [], featured: [], cities: [] })
    }
  }, [])

  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    const timer = setTimeout(() => void loadRef.current(q, city), q ? 250 : 0)
    return () => clearTimeout(timer)
  }, [q, city])

  // Rated clubs first within the grid, same as the web page — ranked by
  // rating without hiding unrated clubs below a fold of empty stars.
  const sortedRegular = data
    ? [...data.clubs].sort((a, b) => {
        const ra = a.rating
        const rb = b.rating
        if (!!ra !== !!rb) return ra ? -1 : 1
        if (ra && rb && rb.average !== ra.average) return rb.average - ra.average
        return 0
      })
    : []

  const sections: Section[] = data
    ? [
        ...(data.featured.length > 0 ? [{ title: "Featured clubs", data: data.featured }] : []),
        {
          title: city ? `Clubs in ${city}` : q.length >= 2 ? "Results" : "Top clubs",
          data: sortedRegular,
        },
      ].filter((s) => s.data.length > 0)
    : []

  return (
    <View style={styles.root}>
      <SubHeader title="Clubs" />
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search clubs by name"
          placeholderTextColor={ui.textFaint}
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
        />
        {data && data.cities.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable
              style={[styles.chip, !city && styles.chipActive]}
              onPress={() => setCity(undefined)}
            >
              <Text style={[styles.chipText, !city && styles.chipTextActive]}>All cities</Text>
            </Pressable>
            {data.cities.map((c) => {
              const active = city?.toLowerCase() === c.city.toLowerCase()
              return (
                <Pressable
                  key={c.city}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCity(active ? undefined : c.city)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.city}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
        )}
      </View>
      {data === null ? (
        <Loading />
      ) : (
        <SectionList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          sections={sections}
          keyExtractor={(c) => c.id}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <EmptyState icon="business-outline" title="No clubs found" body="Try a different name or city." />
          }
          renderSectionHeader={({ section }) => (
            <Text
              style={[styles.sectionTitle, section.title === "Featured clubs" && styles.sectionTitleGold]}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item, section }) => (
            <Card style={styles.cardSpacing} onPress={() => router.push(`/browse/club/${item.slug}`)}>
              <View style={styles.clubRow}>
                <Monogram name={item.name} logoUrl={item.logoUrl} color={item.primaryColor} size={44} />
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.clubName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {section.title === "Featured clubs" && <TonePill tone="gold" label="Featured" />}
                  </View>
                  {item.rating ? (
                    <View style={styles.ratingRow}>
                      <StarRating rating={item.rating.average} count={item.rating.count} />
                    </View>
                  ) : null}
                  <Text style={styles.clubSub} numberOfLines={1}>
                    {[
                      [item.city, item.state].filter(Boolean).join(", "),
                      `${item.teamCount} team${item.teamCount === 1 ? "" : "s"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                {item.status === "UNCLAIMED" && <TonePill tone="neutral" label="Open profile" />}
              </View>
              {item.description ? (
                <Text style={styles.description} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
            </Card>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  searchWrap: { padding: 12, gap: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: ui.border },
  search: {
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: ui.text,
    backgroundColor: ui.surfaceSunken,
  },
  chipScroll: { marginHorizontal: -12 },
  chipRow: { paddingHorizontal: 12, gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: ui.surfaceSunken,
  },
  chipActive: { backgroundColor: ui.primary },
  chipText: { fontSize: 12.5, fontWeight: "700", color: ui.textMuted },
  chipTextActive: { color: "#fff" },
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: ui.textFaint,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 8,
  },
  // Web's "Featured clubs" eyebrow is gold (text-gold-600); every other
  // section stays the muted ink-400 tone above.
  sectionTitleGold: { color: palette.gold[600] },
  cardSpacing: { marginBottom: 10 },
  clubRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  clubName: { fontSize: 15, fontWeight: "800", color: ui.text, flexShrink: 1 },
  ratingRow: { marginTop: 2 },
  clubSub: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
  description: { fontSize: 12, color: ui.textMuted, lineHeight: 17, marginTop: 6 },
})
