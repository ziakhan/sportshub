import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { useSession } from "@/lib/session"
import { Avatar } from "@/components/ui"
import { fonts, palette, ui } from "@/lib/theme"

/**
 * Branded top bar — the web header in native form ("menus on top", audit v2
 * §5): play-600 logo tile + wordmark, then bell + avatar when signed in or
 * Log in / Start Free when anonymous. `pills` adds the web's <lg horizontal
 * browse pill row (Scores · Programs · Clubs · Leagues · News · Marketplace)
 * underneath. Rendered by screens (headerShown:false on tabs) so it is
 * identical everywhere.
 */

// EXACT web order + tints (components/public/section-pills.tsx, owner
// 2026-07-25): Scores · News · Programs · Leagues · Clubs
const BROWSE_PILLS: Array<{ label: string; href: string; bg: string; fg: string }> = [
  { label: "Scores", href: "/scores", bg: "#fef3ee", fg: "#bc2711" },
  { label: "News", href: "/browse/news", bg: "#f5f3ff", fg: "#6d28d9" },
  { label: "Programs", href: "/browse/programs", bg: palette.gold[50], fg: palette.gold[600] },
  { label: "Leagues", href: "/browse/leagues", bg: palette.court[50], fg: palette.court[700] },
  { label: "Clubs", href: "/browse/clubs", bg: palette.play[50], fg: palette.play[700] },
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
          {/* N3 icon + A1 wordmark (brand picks 2026-07-18; ONE is spelled out
              everywhere the name is read — the numeral lives only in icons) */}
          {/* Wordmark only — square tile dropped for web parity (2026-07-25) */}
          <View style={styles.wordmarkRow}>
            <Text style={styles.wordmark}>
              Sports<Text style={styles.wordmarkHub}>Hub</Text>
            </Text>
            <View style={styles.oneBox}>
              <Text style={styles.oneBoxText}>ONE</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.actions}>
          {signedIn ? (
            // Bell beside the badge (owner 2026-07-16): notifications are one
            // tap, and the unread dot lives on the bell where it belongs.
            <>
              <Pressable onPress={() => router.push("/alerts")} hitSlop={8}>
                <View>
                  <Ionicons name="notifications-outline" size={23} color={ui.text} />
                  {unread > 0 ? <View style={styles.unreadDot} /> : null}
                </View>
              </Pressable>
              <Pressable onPress={() => router.navigate("/account")} hitSlop={6}>
                <Avatar name={user?.name ?? user?.email} size={32} />
              </Pressable>
            </>
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
              style={({ pressed }) => [styles.pill, { backgroundColor: p.bg }, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(p.href as any)}
            >
              <View style={[styles.pillDot, { backgroundColor: p.fg }]} />
              <Text style={[styles.pillText, { color: p.fg }]}>{p.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  )
}

/** Branded header for pushed screens: back chevron + title (+optional right). */
export function SubHeader({
  title,
  right,
  onTitlePress,
}: {
  title: string
  right?: React.ReactNode
  /** Entities are clickable (owner law 2026-07-17) — tap the title to open it. */
  onTitlePress?: () => void
}) {
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
          <Text
            style={styles.subTitle}
            numberOfLines={1}
            onPress={onTitlePress}
            suppressHighlighting={!onTitlePress}
          >
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
    backgroundColor: "#16233f",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.play[200],
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  logoS: { color: "#fff", fontSize: 17, fontWeight: "800", marginTop: 1 },
  logoBox: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 10,
    height: 10,
    borderRadius: 2.5,
    backgroundColor: palette.hoop[500],
    alignItems: "center",
    justifyContent: "center",
  },
  logoBoxText: { color: "#fff", fontSize: 6.5, fontWeight: "800" },
  wordmarkRow: { flexDirection: "row", alignItems: "flex-start" },
  wordmark: {
    fontSize: 23,
    fontFamily: fonts.displayHeavy,
    letterSpacing: -0.4,
    color: ui.text,
  },
  wordmarkHub: { color: ui.primary },
  oneBox: {
    backgroundColor: palette.hoop[500],
    borderRadius: 3,
    paddingHorizontal: 3.5,
    paddingVertical: 2,
    marginLeft: 4,
    marginTop: 1,
  },
  oneBoxText: { color: "#fff", fontSize: 7.5, fontWeight: "800", letterSpacing: 0.8, lineHeight: 8 },
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
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 6.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.7 },
  pillText: { fontSize: 12.5, fontWeight: "800" },
})
