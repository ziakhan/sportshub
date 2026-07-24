import { useCallback, useEffect, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, Loading, TonePill } from "@/components/ui"
import { fetchMyPolls, scopeLabel, type ScopedPollItem } from "@/lib/polls"
import { ui } from "@/lib/theme"

/**
 * Polls — the native twin of the web /polls page (three-tier polls ruling,
 * owner 2026-07-24): every OPEN poll across the viewer's teams, clubs and
 * leagues, newest first. Tap a poll to read and vote.
 */
export default function PollsScreen() {
  const [items, setItems] = useState<ScopedPollItem[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await fetchMyPolls())
      setError(false)
    } catch {
      setError(true)
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
      <SubHeader title="Polls" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {items === null && !error ? <Loading /> : null}
        {error && items === null ? (
          <EmptyState icon="stats-chart-outline" title="Couldn't load polls" body="Pull to retry." />
        ) : null}
        {items && items.length === 0 ? (
          <EmptyState
            icon="stats-chart-outline"
            title="No open polls right now"
            body="Polls from your teams, clubs and leagues show up here."
          />
        ) : null}
        {items?.map((item) => {
          const answeredAll = item.poll.questions.every((q) => q.myAnswered)
          return (
            <Card key={item.poll.id} onPress={() => router.push(`/polls/${item.poll.id}`)}>
              <View style={styles.top}>
                <TonePill tone="gold" label={scopeLabel(item.scope)} />
                <Text style={styles.scopeName} numberOfLines={1}>
                  {item.scopeName}
                </Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {item.poll.title}
              </Text>
              {item.poll.description ? (
                <Text style={styles.description} numberOfLines={2}>
                  {item.poll.description}
                </Text>
              ) : null}
              <View style={styles.bottom}>
                <Text style={styles.meta}>
                  {item.poll.totalVoters} {item.poll.totalVoters === 1 ? "vote" : "votes"} ·{" "}
                  {item.poll.questions.length} question{item.poll.questions.length === 1 ? "" : "s"}
                </Text>
                <TonePill
                  tone={answeredAll ? "positive" : "info"}
                  label={answeredAll ? "✓ Voted" : "Vote now"}
                />
              </View>
            </Card>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  scopeName: { flex: 1, fontSize: 12.5, color: ui.textMuted, fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "800", color: ui.text, marginTop: 6 },
  description: { fontSize: 13, color: ui.textMuted, marginTop: 2 },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  meta: { fontSize: 12, color: ui.textFaint },
})
