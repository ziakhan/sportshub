import { useCallback, useEffect, useState } from "react"
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { apiBaseUrl, apiJson } from "@/lib/api"
import { fonts, palette, ui } from "@/lib/theme"

interface RailStory {
  id: string
  cardUrl: string
  cardType: string
  createdAt: string
  viewed: boolean
}
interface RailEntry {
  playerId: string
  name: string
  own: boolean
  stories: RailStory[]
  allViewed: boolean
}

/**
 * Stories rail — native twin of web's components/social/stories-rail.tsx
 * (native-parity-v2 P1): 76px circles, gradient ring = unseen, thin gray =
 * seen, handle labels tight underneath, fullscreen card viewer that records
 * views. Renders nothing when signed out or empty.
 */
export function StoriesRail() {
  const [rail, setRail] = useState<RailEntry[] | null>(null)
  const [open, setOpen] = useState<{ entry: number; story: number } | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ rail: RailEntry[] }>("/api/stories/rail")
      setRail(data.rail)
    } catch {
      setRail(null) // signed out / error — rail just doesn't render
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const markViewed = (storyId: string) => {
    void apiJson(`/api/stories/${storyId}/view`, { method: "POST" }).catch(() => {})
    setRail(
      (prev) =>
        prev?.map((e) => ({
          ...e,
          stories: e.stories.map((s) => (s.id === storyId ? { ...s, viewed: true } : s)),
          allViewed: e.stories.every((s) => (s.id === storyId ? true : s.viewed)),
        })) ?? null
    )
  }

  if (!rail || rail.length === 0) return null

  const current = open ? rail[open.entry]?.stories[open.story] : null

  const step = (dir: 1 | -1) => {
    if (!open) return
    const entry = rail[open.entry]
    const nextStory = open.story + dir
    if (nextStory >= 0 && nextStory < entry.stories.length) {
      setOpen({ entry: open.entry, story: nextStory })
      markViewed(entry.stories[nextStory].id)
      return
    }
    const nextEntry = open.entry + dir
    if (nextEntry >= 0 && nextEntry < rail.length) {
      const idx = dir === 1 ? 0 : rail[nextEntry].stories.length - 1
      setOpen({ entry: nextEntry, story: idx })
      markViewed(rail[nextEntry].stories[idx].id)
      return
    }
    setOpen(null)
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {rail.map((entry, ei) => (
          <Pressable
            key={entry.playerId}
            style={styles.item}
            onPress={() => {
              setOpen({ entry: ei, story: 0 })
              markViewed(entry.stories[0].id)
            }}
          >
            {/* Pure-JS ring: expo-linear-gradient is a NATIVE module the
                shipped builds don't include — OTA-safe two-tone ring instead
                (true gradient returns with the next store build). */}
            <View style={[styles.ring, entry.allViewed ? styles.ringSeen : styles.ringUnseen]}>
              <View style={styles.circle}>
                <Text style={[styles.initial, { color: entry.allViewed ? ui.textFaint : palette.hoop[600] }]}>
                  {entry.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {entry.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={styles.viewer}>
          <View style={styles.viewerHead}>
            <Text style={styles.viewerName}>{open ? rail[open.entry]?.name : ""}</Text>
            <Pressable onPress={() => setOpen(null)} hitSlop={12}>
              <Text style={styles.viewerClose}>✕</Text>
            </Pressable>
          </View>
          {current ? (
            <Image
              source={{ uri: current.cardUrl.startsWith("/") ? `${apiBaseUrl()}${current.cardUrl}` : current.cardUrl }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          ) : null}
          <View style={styles.viewerNav}>
            <Pressable onPress={() => step(-1)} style={styles.viewerBtn}>
              <Text style={styles.viewerBtnText}>← Prev</Text>
            </Pressable>
            <Text style={styles.viewerCount}>
              {open ? `${open.story + 1} / ${rail[open.entry]?.stories.length ?? 1}` : ""}
            </Text>
            <Pressable onPress={() => step(1)} style={styles.viewerBtn}>
              <Text style={styles.viewerBtnText}>Next →</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  strip: { gap: 6, paddingVertical: 2 },
  item: { width: 82, alignItems: "center" },
  ring: { borderRadius: 999, padding: 3 },
  ringSeen: { backgroundColor: "rgba(217,217,223,0.6)", padding: 1.5 },
  ringUnseen: {
    backgroundColor: palette.hoop[500],
    borderWidth: 2,
    borderColor: palette.gold[400],
  },
  circle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 24, fontFamily: fonts.displayHeavy },
  label: { fontSize: 12, fontFamily: fonts.bodyMed, color: ui.text, marginTop: 1, maxWidth: 80 },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", padding: 16 },
  viewerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8 },
  viewerName: { color: "#fff", fontSize: 15, fontFamily: fonts.bodyBold },
  viewerClose: { color: "rgba(255,255,255,0.8)", fontSize: 22 },
  viewerImage: { width: "100%", aspectRatio: 1080 / 1350, borderRadius: 20 },
  viewerNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10 },
  viewerBtn: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  viewerBtnText: { color: "#fff", fontSize: 13, fontFamily: fonts.bodySemi },
  viewerCount: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: fonts.bodyMed },
})
