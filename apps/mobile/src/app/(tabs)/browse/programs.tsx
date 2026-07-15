import { useCallback, useEffect, useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, Loading, TonePill } from "@/components/ui"
import { apiJson } from "@/lib/api"
import type { ProgramItem } from "@/lib/browse"
import { ui } from "@/lib/theme"

/**
 * Programs browse — tryouts, camps, house leagues, tournaments (the web
 * /events aggregate), with type filter chips. Anonymous.
 */

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "tryout", label: "Tryouts" },
  { key: "camp", label: "Camps" },
  { key: "house-league", label: "House leagues" },
  { key: "tournament", label: "Tournaments" },
]

export default function ProgramsScreen() {
  const [programs, setPrograms] = useState<ProgramItem[] | null>(null)
  const [filter, setFilter] = useState("all")

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ programs: ProgramItem[] }>("/api/mobile/browse/programs")
      setPrograms(data.programs)
    } catch {
      setPrograms((cur) => cur ?? [])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = programs?.filter((p) => filter === "all" || p.type === filter) ?? []

  return (
    <View style={styles.root}>
      <SubHeader title="Programs & tryouts" />
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipOn]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextOn]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {programs === null ? (
        <Loading />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={visible}
          keyExtractor={(p) => `${p.type}:${p.id}`}
          ListEmptyComponent={
            <EmptyState
              icon="pricetags-outline"
              title="Nothing here right now"
              body="New programs appear as clubs publish them."
            />
          }
          renderItem={({ item }) => (
            <Card
              style={styles.cardSpacing}
              onPress={() => router.push(`/browse/program/${item.type}/${item.id}`)}
            >
              <View style={styles.top}>
                <TonePill
                  tone={
                    item.type === "tryout"
                      ? "info"
                      : item.type === "camp"
                        ? "gold"
                        : item.type === "tournament"
                          ? "danger"
                          : "positive"
                  }
                  label={item.type.replace("-", " ")}
                />
                <Text style={styles.fee}>
                  {item.fee > 0
                    ? `${item.currency} ${item.fee.toFixed(0)}${item.feeUnit ? ` ${item.feeUnit}` : ""}`
                    : "Free"}
                </Text>
              </View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {[item.clubName, item.ageGroup].filter(Boolean).join(" · ")}
              </Text>
              <Text style={styles.meta}>
                {new Date(item.startDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                {item.location ? ` · ${item.location}` : ""}
              </Text>
              <Text style={styles.spots}>{item.spotsInfo}</Text>
            </Card>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ui.borderStrong,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  filterChipOn: { backgroundColor: ui.primary, borderColor: ui.primary },
  filterText: { fontSize: 12, fontWeight: "600", color: ui.textMuted },
  filterTextOn: { color: "#fff" },
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 32 },
  cardSpacing: { marginBottom: 10 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fee: { fontSize: 14, fontWeight: "800", color: ui.text },
  name: { fontSize: 15, fontWeight: "700", color: ui.text, marginTop: 4 },
  meta: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
  spots: { fontSize: 12, color: ui.primaryInk, fontWeight: "600", marginTop: 4 },
})
