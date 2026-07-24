import { useCallback, useEffect, useState } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, CoverImage, EmptyState, Loading, TonePill } from "@/components/ui"
import { apiJson } from "@/lib/api"
import type { FeedItem } from "@/lib/browse"
import { ui } from "@/lib/theme"

/**
 * News feed — recaps + public announcements (web /news parity): every story
 * is an image card — 16:9 cover on top (tinted placeholder when the story has
 * no photo), then date · author, bold title, excerpt. Anonymous.
 */
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
      <View style={styles.intro}>
        <Text style={styles.introEyebrow}>Around the hub</Text>
        <Text style={styles.introBody}>
          Every scored game gets a story — plus announcements from clubs and leagues.
        </Text>
      </View>
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
                style={styles.newsCard}
                onPress={slug ? () => router.push(`/browse/article/${slug}`) : undefined}
              >
                <CoverImage url={item.coverUrl} icon="newspaper-outline" />
                <View style={styles.body}>
                  <View style={styles.metaRow}>
                    <TonePill
                      tone={item.type === "announcement" ? "info" : "gold"}
                      label={
                        item.type === "announcement"
                          ? "Announcement"
                          : item.kind.replace("_", " ").toLowerCase()
                      }
                    />
                    <Text style={styles.date}>
                      {new Date(item.dateISO).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      {item.author ? ` · ${item.author}` : ""}
                    </Text>
                  </View>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.excerpt ? (
                    <Text style={styles.excerpt} numberOfLines={2}>
                      {item.excerpt}
                    </Text>
                  ) : null}
                </View>
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
  // Web SectionHeader twin ("Around the hub" eyebrow + description) — page
  // header copy parity (five-tab visual-parity pass 2026-07-24).
  intro: {
    padding: 12,
    paddingBottom: 14,
    gap: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
  },
  introEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: ui.primary,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  introBody: { fontSize: 12.5, color: ui.textMuted, lineHeight: 17 },
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 32 },
  // Cover bleeds to the card edge — padding lives on the text block instead
  newsCard: { marginBottom: 12, padding: 0, overflow: "hidden" },
  body: { padding: 14, gap: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { fontSize: 11, color: ui.textFaint },
  title: { fontSize: 16, fontWeight: "800", color: ui.text, marginTop: 4, lineHeight: 21 },
  excerpt: { fontSize: 13, color: ui.textMuted, lineHeight: 18, marginTop: 2 },
})
