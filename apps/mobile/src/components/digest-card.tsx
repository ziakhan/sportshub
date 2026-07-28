import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { fonts, ui } from "@/lib/theme"

/**
 * Native twin of web components/social/digest-card.tsx — virtual "Yesterday
 * around your clubs" card (business-model-v2 §12/§16 S1). No Post backs
 * this (no reactions/comments bar), just a compact expandable list of the
 * routine finals folded in, each row tappable to its game.
 */

export interface DigestGameRow {
  gameId: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
}
export interface DigestFeedItem {
  type: "digest"
  id: string
  dateKey: string
  title: string
  games: DigestGameRow[]
  sortAt: string
}

export function DigestCard({ item }: { item: DigestFeedItem }) {
  const [open, setOpen] = useState(false)

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>📅</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.author}>SportsHub One</Text>
          <Text style={styles.meta}>Digest</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>📅 Digest</Text>
        </View>
      </View>
      <Pressable onPress={() => setOpen((o) => !o)}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>
          {item.games.length} final{item.games.length === 1 ? "" : "s"} ·{" "}
          {open ? "Hide scores" : "Tap to see scores"}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.rows}>
          {item.games.map((g) => (
            <Pressable
              key={g.gameId}
              style={styles.row}
              onPress={() => router.push(`/browse/game/${g.gameId}` as any)}
            >
              <Text style={styles.rowTeams} numberOfLines={1}>
                {g.homeTeam} <Text style={styles.rowVs}>vs</Text> {g.awayTeam}
              </Text>
              <Text style={styles.rowScore}>
                {g.homeScore}–{g.awayScore}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
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
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: ui.surfaceSunken },
  chipText: { fontSize: 10.5, fontFamily: fonts.bodyBold, color: ui.textMuted },
  title: { fontSize: 15, fontFamily: fonts.display, color: ui.text, paddingHorizontal: 14 },
  body: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: ui.textMuted,
    paddingHorizontal: 14,
    marginTop: 3,
    paddingBottom: 12,
  },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.border },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.border,
  },
  rowTeams: { flex: 1, fontSize: 13, fontFamily: fonts.bodySemi, color: ui.text },
  rowVs: { color: ui.textFaint, fontFamily: fonts.body },
  rowScore: { fontSize: 13, fontFamily: fonts.bodyBold, color: ui.text },
})
