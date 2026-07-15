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

export default function ChatListScreen() {
  const router = useRouter()
  const { home } = useHome()
  const [teams, setTeams] = useState<ChatTeam[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ teams: ChatTeam[] }>("/api/chat/summary")
      setTeams(data.teams)
    } catch {
      // pull-to-refresh retries
    }
  }, [])

  const { connected } = useRealtime({
    rooms: [],
    events: { notify: () => void load() },
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
      contentContainerStyle={!teams || teams.length === 0 ? styles.emptyWrap : undefined}
      data={teams ?? []}
      keyExtractor={(t) => t.teamId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        teams ? (
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
  empty: { textAlign: "center", color: ui.textMuted, fontSize: 15, padding: 24 },
})
