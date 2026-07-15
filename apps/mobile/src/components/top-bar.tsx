import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { useSession } from "@/lib/session"
import { Avatar } from "@/components/ui"
import { palette, ui } from "@/lib/theme"

/**
 * Branded top bar — the web header in native form ("menus on top", audit v2
 * §5): play-600 logo tile + wordmark, then bell + avatar when signed in or
 * Log in / Start Free when anonymous. `pills` adds the web's <lg horizontal
 * browse pill row (Scores · Programs · Clubs · Leagues · News · Marketplace)
 * underneath. Rendered by screens (headerShown:false on tabs) so it is
 * identical everywhere.
 */

const BROWSE_PILLS: Array<{ label: string; href: string }> = [
  { label: "Scores", href: "/scores" },
  { label: "Programs", href: "/browse/programs" },
  { label: "Clubs", href: "/browse/clubs" },
  { label: "Leagues", href: "/browse/leagues" },
  { label: "News", href: "/browse/news" },
]

export function TopBar({
  pills = false,
  unread = 0,
}: {
  pills?: boolean
  unread?: number
}) {
  const insets = useSafeAreaInsets()
  const { signedIn, user } = useSession()

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable style={styles.brand} onPress={() => router.navigate("/")} hitSlop={6}>
          <View style={styles.logoTile}>
            <Ionicons name="basketball-outline" size={18} color="#fff" />
          </View>
          <Text style={styles.wordmark}>sportshub</Text>
        </Pressable>

        <View style={styles.actions}>
          {signedIn ? (
            // One control, not three (owner 2026-07-15): the badge carries
            // the unread dot; Alerts is a row inside Account + a Home chip.
            <Pressable onPress={() => router.navigate("/account")} hitSlop={6}>
              <View>
                <Avatar name={user?.name ?? user?.email} size={32} />
                {unread > 0 ? <View style={styles.unreadDot} /> : null}
              </View>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={() => router.push("/sign-in")} hitSlop={6}>
                <Text style={styles.logIn}>Log in</Text>
              </Pressable>
              <Pressable style={styles.startFree} onPress={() => router.push("/sign-up")}>
                <Text style={styles.startFreeText}>Start Free</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {pills ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillRow}
          contentContainerStyle={styles.pillRowContent}
        >
          {BROWSE_PILLS.map((p) => (
            <Pressable
              key={p.href}
              style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(p.href as any)}
            >
              <Text style={styles.pillText}>{p.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  )
}

/** Branded header for pushed screens: back chevron + title (+optional right). */
export function SubHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <View style={styles.subLeft}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
            hitSlop={8}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={22} color={ui.primary} />
          </Pressable>
          <Text style={styles.subTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {right}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  subLeft: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  backButton: { padding: 2, marginLeft: -6 },
  subTitle: { fontSize: 17, fontWeight: "800", color: ui.text, flexShrink: 1 },
  wrap: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
  },
  bar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  logoTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.play[200],
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  wordmark: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: ui.text,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  unreadDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: ui.danger,
  },
  logIn: { fontSize: 13, fontWeight: "600", color: ui.textMuted, paddingHorizontal: 4 },
  startFree: {
    backgroundColor: palette.ink[950],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  startFreeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  pillRow: { borderTopWidth: 1, borderTopColor: ui.border },
  pillRowContent: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  pill: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { fontSize: 12, fontWeight: "600", color: ui.textMuted },
})
