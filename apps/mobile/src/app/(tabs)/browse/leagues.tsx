import { useCallback, useEffect, useState } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, ListRow, Loading, Monogram, TonePill } from "@/components/ui"
import { apiJson } from "@/lib/api"
import type { BrowseLeague } from "@/lib/browse"
import { ui } from "@/lib/theme"

/** Leagues browse — every league with an active season. Anonymous. */
export default function LeaguesScreen() {
  const [leagues, setLeagues] = useState<BrowseLeague[] | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ leagues: BrowseLeague[] }>("/api/mobile/browse/leagues")
      setLeagues(data.leagues)
    } catch {
      setLeagues((cur) => cur ?? [])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <View style={styles.root}>
      <SubHeader title="Leagues" />
      {leagues === null ? (
        <Loading />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={leagues}
          keyExtractor={(l) => l.id}
          ListEmptyComponent={
            <EmptyState
              icon="trophy-outline"
              title="No active leagues right now"
              body="Leagues appear here once a season opens."
            />
          }
          renderItem={({ item }) => (
            <Card
              style={styles.cardSpacing}
              onPress={
                item.seasons[0]
                  ? () => router.push(`/browse/season/${item.seasons[0].id}`)
                  : undefined
              }
            >
              <View style={styles.leagueHead}>
                <Monogram name={item.name} size={40} />
                <Text style={[styles.leagueName, { flex: 1 }]} numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
              {item.description ? (
                <Text style={styles.description} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              {item.seasons.map((s) => (
                <ListRow
                  key={s.id}
                  icon="calendar-outline"
                  text={s.name}
                  sub={`${s.teamCount} team${s.teamCount === 1 ? "" : "s"}${s.divisionCount ? ` · ${s.divisionCount} division${s.divisionCount === 1 ? "" : "s"}` : ""}`}
                  right={
                    <TonePill
                      tone={s.status === "REGISTRATION" ? "info" : "positive"}
                      label={s.status === "REGISTRATION" ? "Registration" : "In progress"}
                    />
                  }
                  onPress={() => router.push(`/browse/season/${s.id}`)}
                />
              ))}
            </Card>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 32 },
  cardSpacing: { marginBottom: 10 },
  leagueHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 2 },
  leagueName: { fontSize: 16, fontWeight: "800", color: ui.text },
  description: { fontSize: 12, color: ui.textMuted, lineHeight: 17, marginBottom: 4 },
})
