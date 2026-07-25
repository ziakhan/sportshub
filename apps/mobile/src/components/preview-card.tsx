import { Pressable, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { palette, fonts, ui } from "@/lib/theme"

/**
 * Native twin of web components/social/preview-card.tsx — virtual upcoming-
 * matchup card ("Sat: Lords vs Kings") for followed teams' games in the next
 * 48h (business-model-v2 §12/§16 S1). No Post backs this.
 */

export interface PreviewFeedItem {
  type: "preview"
  id: string
  gameId: string
  title: string
  homeTeam: string
  awayTeam: string
  scheduledAt: string
  sortAt: string
}

export function PreviewCard({ item }: { item: PreviewFeedItem }) {
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/browse/game/${item.gameId}` as any)}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🗓️</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.author}>SportsHub One</Text>
          <Text style={styles.meta}>Upcoming</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>🗓️ Preview</Text>
        </View>
      </View>
      <Text style={styles.title}>{item.title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#1e293b",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
    paddingBottom: 14,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 6 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ui.text,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16 },
  author: { fontSize: 13, fontFamily: fonts.bodySemi, color: ui.text },
  meta: { fontSize: 11, fontFamily: fonts.bodyMed, color: ui.textFaint },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: palette.court[50] },
  chipText: { fontSize: 10.5, fontFamily: fonts.bodyBold, color: palette.court[700] },
  title: { fontSize: 15, fontFamily: fonts.display, color: ui.text, paddingHorizontal: 14 },
})
