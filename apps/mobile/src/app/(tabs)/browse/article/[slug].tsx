import { useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, CoverImage, EmptyState, Loading, TonePill } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { ui } from "@/lib/theme"

/** One published article (recap/news post). Anonymous. */

interface Article {
  id: string
  kind: string
  title: string
  body: string
  publishedAt: string | null
  media: Array<{ id: string; type: string; url: string; posterUrl: string | null }>
  tags: Array<{
    team: { id: string; name: string } | null
    tenant: { id: string; name: string; slug: string } | null
    league: { id: string; name: string } | null
  }>
}

export default function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [post, setPost] = useState<Article | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiJson<{ post: Article }>(`/api/mobile/browse/news/${slug}`)
      .then((d) => setPost(d.post))
      .catch(() => setError(true))
  }, [slug])

  if (error) {
    return (
      <View style={styles.root}>
        <SubHeader title="Article" />
        <EmptyState icon="newspaper-outline" title="Couldn't load this story" />
      </View>
    )
  }
  if (!post) {
    return (
      <View style={styles.root}>
        <SubHeader title="Article" />
        <Loading />
      </View>
    )
  }

  const hero =
    post.media?.find((m) => m.type === "IMAGE")?.url ??
    post.media?.find((m) => m.posterUrl)?.posterUrl ??
    null
  const tagLine = post.tags
    .map((t) => t.team?.name ?? t.tenant?.name ?? t.league?.name)
    .filter(Boolean)
    .join(" · ")

  return (
    <View style={styles.root}>
      <SubHeader title={post.kind === "RECAP_AI" ? "Game recap" : "News"} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <TonePill tone="gold" label={post.kind.replace("_", " ").toLowerCase()} />
          {post.publishedAt ? (
            <Text style={styles.date}>
              {new Date(post.publishedAt).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
          ) : null}
        </View>
        <Text style={styles.title}>{post.title}</Text>
        {tagLine ? <Text style={styles.tagLine}>{tagLine}</Text> : null}
        {hero ? <CoverImage url={hero} style={styles.hero} /> : null}
        <Card>
          <Text style={styles.body}>{post.body}</Text>
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { fontSize: 12, color: ui.textFaint },
  title: { fontSize: 22, fontWeight: "800", color: ui.text, letterSpacing: -0.4, lineHeight: 28 },
  tagLine: { fontSize: 13, color: ui.primaryInk, fontWeight: "600" },
  hero: { borderRadius: ui.radius.lg },
  body: { fontSize: 15, color: ui.text, lineHeight: 23 },
})
