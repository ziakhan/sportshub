import { useCallback, useEffect, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, ListRow, Loading, SectionHeader, TonePill, Monogram } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { ui } from "@/lib/theme"

/**
 * Operations — native READ-ONLY dashboard for club/league operators
 * (§5.6.9 mobile-visible, rendered natively — no webviews anywhere, owner
 * rule). Config and editing stay on a computer; this answers "what needs
 * me" on the road.
 */

interface OperatorSummary {
  clubs: Array<{
    id: string
    slug: string
    name: string
    teams: number
    pendingOffers: number
    gamesThisWeek: number
    openTryouts: number
  }>
  leagues: Array<{
    id: string
    name: string
    seasons: Array<{ id: string; name: string; status: string; teamCount: number }>
  }>
}

export default function OperatorScreen() {
  const [data, setData] = useState<OperatorSummary | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await apiJson<OperatorSummary>("/api/mobile/operator"))
    } catch {
      setData((cur) => cur ?? { clubs: [], leagues: [] })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <View style={styles.root}>
      <SubHeader title="Operations" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {data === null ? <Loading /> : null}

        {data && data.clubs.length === 0 && data.leagues.length === 0 ? (
          <EmptyState
            icon="grid-outline"
            title="No operations here"
            body="Club and league summaries appear when you hold an operator role."
          />
        ) : null}

        {data?.clubs.map((club) => (
          <View key={club.id} style={{ gap: 8 }}>
            <SectionHeader eyebrow="Club" title={club.name} accent="play" />
            <Card>
              <View style={styles.statsRow}>
                <Stat label="Teams" value={club.teams} />
                <Stat label="Games this wk" value={club.gamesThisWeek} />
                <Stat label="Open tryouts" value={club.openTryouts} />
              </View>
              {club.pendingOffers > 0 ? (
                <View style={{ marginTop: 6 }}>
                  <TonePill tone="warning" label={`${club.pendingOffers} pending offer${club.pendingOffers === 1 ? "" : "s"}`} />
                </View>
              ) : null}
              <ListRow
                icon="business-outline"
                text="Public club page"
                onPress={() => router.push(`/browse/club/${club.slug}`)}
              />
            </Card>
          </View>
        ))}

        {data?.leagues.map((league) => (
          <View key={league.id} style={{ gap: 8 }}>
            <SectionHeader eyebrow="League" title={league.name} accent="court" />
            <Card>
              {league.seasons.length === 0 ? (
                <Text style={styles.meta}>No active seasons.</Text>
              ) : (
                league.seasons.map((s) => (
                  <ListRow
                    key={s.id}
                    left={<Monogram name={s.name} size={36} />}
                    text={s.name}
                    sub={`${s.teamCount} team${s.teamCount === 1 ? "" : "s"} · ${s.status === "REGISTRATION" ? "registration open" : "in progress"}`}
                    onPress={() => router.push(`/browse/season/${s.id}`)}
                  />
                ))
              )}
            </Card>
          </View>
        ))}

        {data && (data.clubs.length > 0 || data.leagues.length > 0) ? (
          <Text style={styles.footnote}>
            Scheduling, staff, payments setup and page editing are computer tasks — open the
            dashboard on the web when you&apos;re at a desk.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: ui.surfaceSunken,
    borderRadius: ui.radius.sm,
    paddingVertical: 10,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "800", color: ui.text },
  statLabel: { fontSize: 10, color: ui.textMuted, marginTop: 1, textTransform: "uppercase", letterSpacing: 0.5 },
  meta: { fontSize: 13, color: ui.textMuted },
  footnote: { fontSize: 12, color: ui.textFaint, textAlign: "center", marginTop: 8, lineHeight: 17 },
})
