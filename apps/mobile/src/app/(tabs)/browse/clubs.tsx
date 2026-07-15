import { useCallback, useEffect, useState } from "react"
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, ListRow, Loading } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { ui } from "@/lib/theme"

/** Clubs directory — /api/clubs/public with live search. Anonymous. */

interface PublicClub {
  id: string
  slug: string
  name: string
  city: string | null
  state: string | null
  description: string | null
  teamCount: number
}

export default function ClubsDirectoryScreen() {
  const [q, setQ] = useState("")
  const [clubs, setClubs] = useState<PublicClub[] | null>(null)

  const load = useCallback(async (query: string) => {
    try {
      const data = await apiJson<{ clubs: PublicClub[] }>(
        `/api/clubs/public?limit=30${query.length >= 2 ? `&q=${encodeURIComponent(query)}` : ""}`
      )
      setClubs(data.clubs)
    } catch {
      setClubs((cur) => cur ?? [])
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(q), q ? 250 : 0)
    return () => clearTimeout(timer)
  }, [q, load])

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
      </View>
      {clubs === null ? (
        <Loading />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={clubs}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={
            <EmptyState icon="business-outline" title="No clubs found" body="Try a different name." />
          }
          renderItem={({ item }) => (
            <Card style={styles.cardSpacing} onPress={() => router.push(`/browse/club/${item.slug}`)}>
              <ListRow
                icon="business-outline"
                text={item.name}
                sub={[
                  [item.city, item.state].filter(Boolean).join(", "),
                  `${item.teamCount} team${item.teamCount === 1 ? "" : "s"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                onPress={() => router.push(`/browse/club/${item.slug}`)}
              />
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
  searchWrap: { padding: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: ui.border },
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
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 32 },
  cardSpacing: { marginBottom: 10 },
  description: { fontSize: 12, color: ui.textMuted, lineHeight: 17 },
})
