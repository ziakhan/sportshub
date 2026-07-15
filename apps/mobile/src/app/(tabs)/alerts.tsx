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
import { SubHeader } from "@/components/top-bar"
import { apiFetch, apiJson } from "@/lib/api"
import { nativeRouteForLink } from "@/lib/nav-links"
import { useRealtime } from "@/lib/realtime"
import { ui } from "@/lib/theme"

/**
 * Notifications inbox — the same /api/notifications feed as the web bell,
 * with mark-as-read. Tapping follows the notification's link through the
 * shared web-path → native-route map (chat, offers, games, kids, …).
 */

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function AlertsScreen() {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ notifications: NotificationItem[]; unreadCount: number }>(
        "/api/notifications"
      )
      setItems(data.notifications)
      setUnread(data.unreadCount)
    } catch {
      // pull-to-refresh retries
    } finally {
      setLoaded(true)
    }
  }, [])

  // notify pings land on the sidecar-auto-joined user room
  const { connected } = useRealtime({
    rooms: [],
    events: { notify: () => void load() },
  })

  useEffect(() => {
    load()
    const timer = setInterval(load, connected ? 120_000 : 30_000)
    return () => clearInterval(timer)
  }, [load, connected])

  /** Follow the link natively — one shared route map for bell + push taps. */
  function follow(item: NotificationItem) {
    const route = nativeRouteForLink(item.link)
    if (route) router.push(route as any)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  async function markRead(item: NotificationItem) {
    if (item.isRead) return
    setItems((cur) => cur.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)))
    setUnread((c) => Math.max(0, c - 1))
    await apiFetch("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ ids: [item.id] }),
    }).catch(() => {})
  }

  return (
    <View style={styles.root}>
      <SubHeader title="Alerts" />
      <FlatList
      style={styles.screen}
      contentContainerStyle={items.length === 0 ? styles.emptyWrap : undefined}
      data={items}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        unread > 0 ? (
          <Text style={styles.unreadHeader}>
            {unread} unread
          </Text>
        ) : null
      }
      ListEmptyComponent={
        loaded ? <Text style={styles.empty}>Nothing yet — game finals, chat and offers land here.</Text> : null
      }
      renderItem={({ item }) => (
        <Pressable
          style={[styles.row, !item.isRead && styles.rowUnread]}
          onPress={() => {
            markRead(item)
            follow(item)
          }}
        >
          <View style={styles.rowBody}>
            <Text style={[styles.title, !item.isRead && styles.titleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.message} numberOfLines={2}>
              {item.message}
            </Text>
          </View>
          <Text style={styles.time}>{ago(item.createdAt)}</Text>
        </Pressable>
      )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  unreadHeader: {
    padding: 12,
    fontSize: 13,
    fontWeight: "700",
    color: ui.primary,
  },
  row: {
    flexDirection: "row",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    gap: 10,
  },
  rowUnread: { backgroundColor: ui.surface },
  rowBody: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "600", color: ui.text },
  titleUnread: { fontWeight: "800" },
  message: { fontSize: 13, color: ui.textMuted },
  time: { fontSize: 12, color: ui.textMuted },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { textAlign: "center", color: ui.textMuted, fontSize: 15, padding: 24 },
})
