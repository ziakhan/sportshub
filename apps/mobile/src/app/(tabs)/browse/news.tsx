import { useCallback, useEffect, useState } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, Loading, TonePill } from "@/components/ui"
import { apiJson } from "@/lib/api"
import type { FeedItem } from "@/lib/browse"
import { ui } from "@/lib/theme"

/** News feed — recaps + public announcements (web /news). Anonymous. */
export default function NewsScreen() {
  const [items, setItems] = useState<FeedItem[] | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ items: FeedItem[] }>("/api/mobile/browse/news")
      setItems(data.items)
    } catch {
      setItems((cur) => cur ?? [])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <View style={styles.root}>
      <SubHeader title="News & recaps" />
      {items === null ? (
        <Loading />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(n) => `${n.type}:${n.id}`}
          ListEmptyComponent={
            <EmptyState
              icon="newspaper-outline"
              title="No stories yet"
              body="Game recaps land here after scored games."
            />
          }
          renderItem={({ item }) => {
            const slug = item.href?.startsWith("/news/") ? item.href.split("/")[2] : null
            return (
              <Card
                style={styles.cardSpacing}
                onPress={slug ? () => router.push(`/browse/article/${slug}`) : undefined}
              >
                <View style={styles.top}>
                  <TonePill
                    tone={item.type === "announcement" ? "info" : "gold"}
                    label={item.type === "announcement" ? "Announcement" : item.kind.replace("_", " ").toLowerCase()}
                  />
                  <Text style={styles.date}>{new Date(item.dateISO).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.excerpt} numberOfLines={3}>
                  {item.excerpt}
                </Text>
              </Card>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 32 },
  cardSpacing: { marginBottom: 10 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { fontSize: 11, color: ui.textFaint },
  title: { fontSize: 15, fontWeight: "700", color: ui.text, marginTop: 4 },
  excerpt: { fontSize: 13, color: ui.textMuted, lineHeight: 18, marginTop: 2 },
})
