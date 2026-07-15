import { useCallback, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { router } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"
import { apiBaseUrl } from "@/lib/api"
import { useHome, coachTeamWebPath } from "@/lib/home"
import { useSession } from "@/lib/session"
import { palette, ui } from "@/lib/theme"

/**
 * Home — native twin of the web home's personal band (site-ia-plan §5.6):
 * actions due, this week across every lens, coach teams, plus quick entries
 * to live scores / alerts and public browse (web). One /api/mobile/home
 * fetch, pull-to-refresh.
 */

function openWeb(path: string) {
  void WebBrowser.openBrowserAsync(`${apiBaseUrl()}${path}`)
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return `${day} · ${time}`
}

export default function HomeScreen() {
  const { user } = useSession()
  const { home, loaded, refresh } = useHome()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const c = home?.contexts
  const due = c?.actionsDue
  const dueCount = due
    ? due.openOffers.length + due.paymentsDue + due.rsvpsNeeded + due.unreadChats
    : 0

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting}>Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋</Text>

      {/* Quick entries — live scores + alerts stay one tap away (web parity: header icons) */}
      <View style={styles.quickRow}>
        <QuickChip icon="basketball-outline" label="Live scores" onPress={() => router.push("/(tabs)/scores")} />
        <QuickChip icon="notifications-outline" label="Alerts" onPress={() => router.push("/(tabs)/alerts")} />
      </View>

      {!loaded && !home ? <ActivityIndicator style={{ marginTop: 32 }} /> : null}

      {/* Actions due */}
      {due && dueCount > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Needs your attention</Text>
          {due.openOffers.map((o) => (
            <Row
              key={o.id}
              icon="document-text-outline"
              text={`Offer for ${o.playerName} — ${o.teamName}`}
              onPress={() => router.push(`/(tabs)/offers/${o.id}`)}
            />
          ))}
          {due.paymentsDue > 0 ? (
            <Row
              icon="card-outline"
              text={`${due.paymentsDue} payment${due.paymentsDue > 1 ? "s" : ""} due`}
              onPress={() => router.push("/(tabs)/offers")}
            />
          ) : null}
          {due.rsvpsNeeded > 0 ? (
            <Row
              icon="calendar-outline"
              text={`${due.rsvpsNeeded} RSVP${due.rsvpsNeeded > 1 ? "s" : ""} needed`}
              onPress={() => router.push("/(tabs)/calendar")}
            />
          ) : null}
          {due.unreadChats > 0 ? (
            <Row
              icon="chatbubbles-outline"
              text={`${due.unreadChats} unread chat${due.unreadChats > 1 ? "s" : ""}`}
              onPress={() => router.push("/(tabs)/chat")}
            />
          ) : null}
        </View>
      ) : null}

      {/* This week */}
      {c && c.weekEvents.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>This week</Text>
          {c.weekEvents.slice(0, 6).map((e) => (
            <View key={e.item.id} style={styles.eventRow}>
              <Text style={styles.eventWhen}>{fmtWhen(e.item.startsAt)}</Text>
              <Text style={styles.eventTitle}>{e.item.title}</Text>
              <View style={styles.chipRow}>
                {e.chips.map((chip) => (
                  <Text key={chip} style={styles.chip}>
                    {chip}
                  </Text>
                ))}
                {e.awaitingRsvp.length > 0 ? (
                  <Text style={[styles.chip, styles.chipWarn]}>
                    RSVP: {e.awaitingRsvp.join(", ")}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {c.weekEvents.length > 6 ? (
            <Row icon="calendar-outline" text="Full week in Calendar" onPress={() => router.push("/(tabs)/calendar")} />
          ) : null}
        </View>
      ) : null}

      {/* Coach teams */}
      {c && c.coachTeams.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My teams</Text>
          {c.coachTeams.map((t) => {
            const shapeTeam = home?.shape.coachTeams.find((s) => s.teamId === t.teamId)
            return (
              <Row
                key={t.teamId}
                icon="people-outline"
                text={`${t.name}${t.clubName ? ` · ${t.clubName}` : ""}`}
                onPress={() => (shapeTeam ? openWeb(coachTeamWebPath(shapeTeam)) : undefined)}
              />
            )
          })}
        </View>
      ) : null}

      {/* Empty state for brand-new accounts */}
      {loaded && c && !c.isParticipant && dueCount === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome to SportsHub</Text>
          <Text style={styles.muted}>
            Follow a team, register a player, or browse what's happening in the league below.
          </Text>
        </View>
      ) : null}

      {/* Browse — full experience lives on the web (opens in-app) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Browse</Text>
        <Row icon="business-outline" text="Clubs" onPress={() => openWeb("/clubs")} />
        <Row icon="pricetags-outline" text="Programs & registration" onPress={() => openWeb("/marketplace")} />
        <Row icon="trophy-outline" text="Standings & schedules" onPress={() => openWeb("/scores")} />
      </View>
    </ScrollView>
  )
}

function QuickChip({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={ui.primary} />
      <Text style={styles.quickChipText}>{label}</Text>
    </Pressable>
  )
}

function Row({ icon, text, onPress }: { icon: any; text: string; onPress?: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Ionicons name={icon} size={18} color={ui.primary} />
      <Text style={styles.rowText}>{text}</Text>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={ui.textMuted} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.background },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  greeting: { fontSize: 22, fontWeight: "800", color: ui.text },
  quickRow: { flexDirection: "row", gap: 8 },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: ui.surface,
  },
  quickChipText: { fontSize: 13, fontWeight: "600", color: ui.text },
  card: {
    backgroundColor: ui.surface,
    borderRadius: ui.radius.md,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 14,
    gap: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: ui.text, marginBottom: 4 },
  muted: { fontSize: 14, color: ui.textMuted, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  rowText: { flex: 1, fontSize: 14, color: ui.text },
  eventRow: { paddingVertical: 8, gap: 2 },
  eventWhen: { fontSize: 12, fontWeight: "700", color: palette.play[700] },
  eventTitle: { fontSize: 14, color: ui.text },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  chip: {
    fontSize: 11,
    color: ui.textMuted,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  chipWarn: { color: "#9a3412", borderColor: "#fdba74", backgroundColor: "#fff7ed" },
})
