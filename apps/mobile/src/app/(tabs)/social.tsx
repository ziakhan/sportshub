import { useCallback, useEffect, useState } from "react"
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { TopBar } from "@/components/top-bar"
import { StoriesRail } from "@/components/stories-rail"
import { apiBaseUrl, apiJson } from "@/lib/api"
import { useSession } from "@/lib/session"
import { fonts, palette, ui } from "@/lib/theme"

/**
 * Social feed — native twin of web /feed (native-parity-v2 P1). Same items
 * from the same query (GET /api/feed): system score cards, recaps, player
 * card posts, org posts, reposts. Reactions, comments (text, with report),
 * repost + native share on PUBLIC posts.
 */

interface FeedItem {
  id: string
  kind: string
  title: string
  body: string
  slug: string
  publishedAt: string | null
  visibility: string
  authorName: string | null
  repostedBy: string | null
  repostedAt: string | null
  cardImage: string | null
  mediaUrl: string | null
  mediaType: string | null
  gameId: string | null
  playerName: string | null
  isSystemFinal: boolean
  counts: { reactions: number; comments: number; reposts: number }
  myEmojis: string[]
  myRepost: boolean
}
interface CommentRow {
  id: string
  body: string
  mine: boolean
  authorName: string
}

const EMOJIS = ["👍", "❤️", "😂", "🎉", "🔥", "🏀"] as const

const CHIP: Record<string, { label: string; bg: string; fg: string }> = {
  PLAYER_OF_GAME: { label: "🏀 Player of the Game", bg: "#fffbeb", fg: "#b45309" },
  STAT_CARD: { label: "📊 Game stats", bg: "#eef2ff", fg: "#4338ca" },
  RECAP_AI: { label: "📰 Recap", bg: "#f7f7f8", fg: "#5e5e6e" },
  ANNOUNCEMENT: { label: "📣 Announcement", bg: "#f0fdf0", fg: "#15803d" },
  ARTICLE: { label: "📰 Club post", bg: "#f7f7f8", fg: "#5e5e6e" },
  PHOTO_SET: { label: "📷 Photos", bg: "#fef3ee", fg: "#bc2711" },
  VIDEO: { label: "🎥 Video", bg: "#fef3ee", fg: "#bc2711" },
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

function FeedCard({ item }: { item: FeedItem }) {
  const [reactionCount, setReactionCount] = useState(item.counts.reactions)
  const [myEmojis, setMyEmojis] = useState<string[]>(item.myEmojis)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<CommentRow[] | null>(null)
  const [commentCount, setCommentCount] = useState(item.counts.comments)
  const [draft, setDraft] = useState("")
  const [reposted, setReposted] = useState(item.myRepost)
  const [repostCount, setRepostCount] = useState(item.counts.reposts)

  const chip = item.isSystemFinal
    ? { label: "🏁 Final score", bg: "#f0fdf0", fg: "#15803d" }
    : CHIP[item.kind]
  const authorLabel = item.authorName ?? "SportsHub One"
  const href = item.gameId ? `/browse/game/${item.gameId}` : `/browse/article/${item.slug}`

  const react = async (emoji: string) => {
    setPickerOpen(false)
    const had = myEmojis.includes(emoji)
    setMyEmojis((m) => (had ? m.filter((e) => e !== emoji) : [...m, emoji]))
    setReactionCount((n) => n + (had ? -1 : 1))
    try {
      const data = await apiJson<{ reactions: Array<{ count: number }>; mine: string[] }>(
        `/api/posts/${item.id}/reactions`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ emoji }) }
      )
      setMyEmojis(data.mine)
      setReactionCount(data.reactions.reduce((s, r) => s + r.count, 0))
    } catch {
      /* optimistic state stands */
    }
  }

  const openComments = async () => {
    setCommentsOpen((o) => !o)
    if (comments === null) {
      try {
        const data = await apiJson<{ comments: CommentRow[] }>(`/api/posts/${item.id}/comments`)
        setComments(data.comments)
      } catch {
        setComments([])
      }
    }
  }

  const addComment = async () => {
    const body = draft.trim()
    if (!body) return
    setDraft("")
    try {
      const data = await apiJson<{ comment: CommentRow }>(`/api/posts/${item.id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      })
      setComments((c) => [...(c ?? []), data.comment])
      setCommentCount((n) => n + 1)
    } catch {
      /* dropped */
    }
  }

  const toggleRepost = async () => {
    const next = !reposted
    setReposted(next)
    setRepostCount((n) => n + (next ? 1 : -1))
    try {
      await apiJson(`/api/posts/${item.id}/repost`, { method: next ? "POST" : "DELETE" })
    } catch {
      setReposted(!next)
      setRepostCount((n) => n + (next ? -1 : 1))
    }
  }

  const shareOut = () => {
    const img = item.cardImage ? `${apiBaseUrl()}${item.cardImage}` : null
    void Share.share({
      message: `${item.title} — ${apiBaseUrl()}${item.gameId ? `/live/${item.gameId}` : `/news/${item.slug}`}`,
      url: img ?? `${apiBaseUrl()}/news/${item.slug}`,
    })
  }

  return (
    <View style={styles.card}>
      {item.repostedBy ? (
        <Text style={styles.repostBanner}>🔁 {item.repostedBy} reposted</Text>
      ) : null}
      <View style={styles.cardHead}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{authorLabel.slice(0, 1)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.author} numberOfLines={1}>{authorLabel}</Text>
          <Text style={styles.meta}>
            {timeAgo(item.repostedAt ?? item.publishedAt)}
            {item.visibility === "FOLLOWERS" ? " · 🔒 Followers" : ""}
          </Text>
        </View>
        {chip ? (
          <View style={[styles.chip, { backgroundColor: chip.bg }]}>
            <Text style={[styles.chipText, { color: chip.fg }]}>{chip.label}</Text>
          </View>
        ) : null}
      </View>
      <Pressable onPress={() => router.push(href as any)}>
        <Text style={styles.title}>{item.title}</Text>
        {item.body && item.kind !== "STAT_CARD" && item.kind !== "PLAYER_OF_GAME" ? (
          <Text style={styles.body} numberOfLines={3}>{item.body}</Text>
        ) : null}
        {item.cardImage ? (
          <Image
            source={{ uri: `${apiBaseUrl()}${item.cardImage}` }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : item.mediaUrl && item.mediaType === "IMAGE" ? (
          <Image source={{ uri: item.mediaUrl.startsWith("/") ? `${apiBaseUrl()}${item.mediaUrl}` : item.mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
        ) : null}
      </Pressable>
      <View style={styles.actions}>
        <View>
          <Pressable onPress={() => setPickerOpen((o) => !o)} style={styles.actionBtn}>
            {myEmojis.length > 0 ? (
              <Text style={styles.actionText}>{myEmojis.join("")} {reactionCount}</Text>
            ) : (
              <View style={styles.actionIconRow}>
                <Ionicons name="heart-outline" size={24} color="#42424c" />
                {reactionCount > 0 ? <Text style={styles.actionCount}>{reactionCount}</Text> : null}
              </View>
            )}
          </Pressable>
          {pickerOpen ? (
            <View style={styles.picker}>
              {EMOJIS.map((e) => (
                <Pressable key={e} onPress={() => react(e)}>
                  <Text style={styles.pickerEmoji}>{e}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <Pressable onPress={openComments} style={styles.actionBtn}>
          <View style={styles.actionIconRow}>
            <Ionicons name="chatbubble-outline" size={23} color="#42424c" />
            {commentCount > 0 ? <Text style={styles.actionCount}>{commentCount}</Text> : null}
          </View>
        </Pressable>
        {item.visibility === "PUBLIC" ? (
          <Pressable onPress={toggleRepost} style={styles.actionBtn}>
            <View style={styles.actionIconRow}>
              <Ionicons name="repeat-outline" size={26} color={reposted ? palette.court[700] : "#42424c"} />
              {repostCount > 0 ? <Text style={[styles.actionCount, reposted && { color: palette.court[700] }]}>{repostCount}</Text> : null}
            </View>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable onPress={shareOut} style={styles.actionBtn}>
          <Ionicons name="paper-plane-outline" size={23} color="#42424c" />
        </Pressable>
      </View>
      {commentsOpen ? (
        <View style={styles.comments}>
          {(comments ?? []).map((cm) => (
            <Text key={cm.id} style={styles.comment}>
              <Text style={styles.commentAuthor}>{cm.authorName} </Text>
              {cm.body}
            </Text>
          ))}
          <View style={styles.commentRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment…"
              placeholderTextColor={ui.textFaint}
              style={styles.commentInput}
              maxLength={1000}
            />
            <Pressable onPress={addComment} disabled={!draft.trim()} style={styles.commentSend}>
              <Text style={styles.commentSendText}>Post</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  )
}

export default function SocialScreen() {
  const { signedIn } = useSession()
  const [mode, setMode] = useState<"feed" | "mine">("feed")
  const [items, setItems] = useState<FeedItem[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ items: FeedItem[] }>(mode === "mine" ? "/api/feed/mine" : "/api/feed")
      setItems(data.items)
    } catch {
      setItems([])
    }
  }, [mode])

  useEffect(() => {
    setItems(null)
    if (signedIn) void load()
  }, [signedIn, load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <View style={styles.root}>
      <TopBar />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!signedIn ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Sign in for your feed</Text>
            <Text style={styles.emptyBody}>
              Finals, recaps, and shared player moments from the teams and players you follow.
            </Text>
          </View>
        ) : (
          <>
            <StoriesRail />
            {items === null ? (
              <Text style={styles.emptyBody}>Loading your feed…</Text>
            ) : items.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Your feed is empty</Text>
                <Text style={styles.emptyBody}>
                  Follow teams, clubs, leagues, and players to see finals, recaps, and shared
                  moments here.
                </Text>
              </View>
            ) : (
              items.map((item) => <FeedCard key={`${item.id}-${item.repostedBy ?? "o"}`} item={item} />)
            )}
          </>
        )}
      </ScrollView>

      {/* Social's OWN bottom bar (web ruling: Feed · My posts · Site) */}
      <View style={styles.socialBar}>
        {([["feed", "Feed", "basketball-outline"], ["mine", "My posts", "person-circle-outline"]] as const).map(
          ([key, label, icon]) => (
            <Pressable key={key} style={styles.socialBarBtn} onPress={() => setMode(key)}>
              <View style={[styles.socialBarCapsule, mode === key && styles.socialBarCapsuleOn]}>
                <Ionicons name={icon} size={22} color={mode === key ? "#fff" : "#5e5e6e"} />
                <Text style={[styles.socialBarLabel, mode === key && styles.socialBarLabelOn]}>{label}</Text>
              </View>
            </Pressable>
          )
        )}
        <Pressable style={styles.socialBarBtn} onPress={() => router.navigate("/")}>
          <View style={styles.socialBarCapsule}>
            <Ionicons name="home-outline" size={22} color="#5e5e6e" />
            <Text style={styles.socialBarLabel}>Site</Text>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#eef1f8" },
  content: { padding: 12, paddingBottom: 32, gap: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#1e293b",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  repostBanner: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: ui.textMuted,
    backgroundColor: ui.surfaceSunken,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 6 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.play[600],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 14, fontFamily: fonts.bodyBold },
  author: { fontSize: 13, fontFamily: fonts.bodySemi, color: ui.text },
  meta: { fontSize: 11, fontFamily: fonts.bodyMed, color: ui.textFaint },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 10.5, fontFamily: fonts.bodyBold },
  title: { fontSize: 15, fontFamily: fonts.display, color: ui.text, paddingHorizontal: 14 },
  body: { fontSize: 13, fontFamily: fonts.body, color: ui.textMuted, paddingHorizontal: 14, marginTop: 3 },
  cardImage: { width: "100%", aspectRatio: 1080 / 1350, marginTop: 10, backgroundColor: "#eeeef1" },
  mediaImage: { width: "100%", aspectRatio: 1200 / 675, marginTop: 10, backgroundColor: "#eeeef1" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.border,
    marginTop: 8,
  },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  actionText: { fontSize: 16, fontFamily: fonts.bodySemi, color: ui.text },
  picker: {
    position: "absolute",
    bottom: 40,
    left: 0,
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 10,
  },
  pickerEmoji: { fontSize: 22 },
  comments: { paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  comment: { fontSize: 13, fontFamily: fonts.body, color: ui.text },
  commentAuthor: { fontFamily: fonts.bodyBold },
  commentRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: fonts.body,
    color: ui.text,
  },
  commentSend: {
    backgroundColor: palette.play[600],
    borderRadius: 999,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  commentSendText: { color: "#fff", fontSize: 12, fontFamily: fonts.bodyBold },
  actionIconRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionCount: { fontSize: 13, fontFamily: fonts.bodySemi, color: "#42424c" },
  socialBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.border,
    paddingTop: 6,
    paddingBottom: 24,
  },
  socialBarBtn: { flex: 1, alignItems: "center" },
  socialBarCapsule: { alignItems: "center", gap: 2, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 5 },
  socialBarCapsuleOn: { backgroundColor: palette.hoop[500] },
  socialBarLabel: { fontSize: 11.5, fontFamily: fonts.bodyBold, color: "#5e5e6e" },
  socialBarLabelOn: { color: "#fff" },
  empty: { backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center", gap: 6 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.display, color: ui.text },
  emptyBody: { fontSize: 13, fontFamily: fonts.body, color: ui.textMuted, textAlign: "center" },
})
