import { useCallback, useEffect, useState } from "react"
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { TopBar } from "@/components/top-bar"
import { apiJson } from "@/lib/api"
import { useHome } from "@/lib/home"
import { useRealtime } from "@/lib/realtime"
import { ui } from "@/lib/theme"

/**
 * Chat home — every team chat you belong to, unread-first (same
 * /api/chat/summary the web dock uses). "notify" pings on the auto-joined
 * user room refresh the badges instantly.
 */

interface ChatTeam {
  teamId: string
  teamName: string
  clubName: string
  unread: number
}

interface DmConversation {
  id: string
  teamName: string | null
  otherName: string
  lastMessage: string | null
  lastMessageMine: boolean
  unread: number
}

export default function ChatListScreen() {
  const router = useRouter()
  const { home } = useHome()
  const [teams, setTeams] = useState<ChatTeam[] | null>(null)
  const [dms, setDms] = useState<DmConversation[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [data, convos] = await Promise.all([
        apiJson<{ teams: ChatTeam[] }>("/api/chat/summary"),
        apiJson<{ conversations: DmConversation[] }>("/api/conversations").catch(() => ({
          conversations: [] as DmConversation[],
        })),
      ])
      setTeams(data.teams)
      setDms(convos.conversations)
    } catch {
      // pull-to-refresh retries
    }
  }, [])

  const { connected } = useRealtime({
    rooms: [],
    events: { notify: () => void load(), "dm.message": () => void load() },
  })

  useEffect(() => {
    load()
    const timer = setInterval(load, connected ? 120_000 : 30_000)
    return () => clearInterval(timer)
  }, [load, connected])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <View style={styles.root}>
      <TopBar unread={home?.unreadNotifications ?? 0} />
      <FlatList
      style={styles.screen}
      contentContainerStyle={
        (!teams || teams.length === 0) && dms.length === 0 ? styles.emptyWrap : undefined
      }
      data={teams ?? []}
      keyExtractor={(t) => t.teamId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <Pressable
            style={({ pressed }) => [styles.newDm, pressed && { opacity: 0.7 }]}
            onPress={() => router.push("/chat/new")}
          >
            <Text style={styles.newDmText}>✏️  New message</Text>
          </Pressable>
          {dms.length > 0 ? (
            <View>
              <Text style={styles.sectionLabel}>Direct messages</Text>
              {dms.map((dm) => (
                <Pressable
                  key={dm.id}
                  style={styles.row}
                  onPress={() =>
                    router.push({
                      pathname: "/chat/dm/[conversationId]",
                      params: { conversationId: dm.id, title: dm.otherName },
                    })
                  }
                >
                  <View style={styles.rowBody}>
                    <Text style={styles.teamName}>
                      {dm.otherName}
                      {dm.teamName ? <Text style={styles.clubName}>  ·  {dm.teamName}</Text> : null}
                    </Text>
                    <Text style={styles.clubName} numberOfLines={1}>
                      {dm.lastMessage
                        ? `${dm.lastMessageMine ? "You: " : ""}${dm.lastMessage}`
                        : "New conversation"}
                    </Text>
                  </View>
                  {dm.unread > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{dm.unread > 99 ? "99+" : dm.unread}</Text>
                    </View>
                  ) : null}
                </Pressable>
              ))}
              <Text style={styles.sectionLabel}>Team chats</Text>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        teams && dms.length === 0 ? (
          <Text style={styles.empty}>
            No team chats yet — they appear when your player joins a roster.
          </Text>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() =>
            router.push({ pathname: "/chat/[teamId]", params: { teamId: item.teamId, title: item.teamName } })
          }
        >
          <View style={styles.rowBody}>
            <Text style={styles.teamName}>{item.teamName}</Text>
            <Text style={styles.clubName}>{item.clubName}</Text>
          </View>
          {item.unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread > 99 ? "99+" : item.unread}</Text>
            </View>
          ) : null}
        </Pressable>
      )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    gap: 10,
  },
  rowBody: { flex: 1 },
  teamName: { fontSize: 16, fontWeight: "700", color: ui.text },
  clubName: { fontSize: 13, color: ui.textMuted, marginTop: 2 },
  badge: {
    backgroundColor: ui.primary,
    borderRadius: 12,
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  emptyWrap: { flex: 1, justifyContent: "center" },
  newDm: {
    margin: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingVertical: 10,
    alignItems: "center",
  },
  newDmText: { fontSize: 13, fontWeight: "700", color: ui.text },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: ui.textFaint,
  },
  empty: { textAlign: "center", color: ui.textMuted, fontSize: 15, padding: 24 },
})
