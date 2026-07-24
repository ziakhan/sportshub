import { useCallback, useEffect, useState } from "react"
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, Loading, PrimaryButton, TonePill } from "@/components/ui"
import { apiJson } from "@/lib/api"
import {
  fetchMyPolls,
  pollVoteUrl,
  scopeLabel,
  seedSelections,
  type PollQuestionView,
  type PollView,
  type ScopedPollItem,
  type Selections,
} from "@/lib/polls"
import { tones, ui } from "@/lib/theme"

/**
 * Poll detail + vote — native twin of the web PollCard (three-tier polls
 * ruling, owner 2026-07-24). Reached from the polls list, a team's polls
 * section, or a poll notification tap. Voting posts to the SAME scope vote
 * endpoint the web uses (team/club/league) — reused verbatim, no new route.
 */
export default function PollDetailScreen() {
  const { pollId } = useLocalSearchParams<{ pollId: string }>()
  const [item, setItem] = useState<ScopedPollItem | null | undefined>(undefined) // undefined = loading, null = not found
  const [selections, setSelections] = useState<Selections>({})
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const items = await fetchMyPolls()
      const found = items.find((i) => i.poll.id === pollId) ?? null
      setItem(found)
      if (found) setSelections(seedSelections(found.poll))
    } catch {
      setItem((cur) => cur ?? null)
    }
  }, [pollId])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  function toggle(question: PollQuestionView, optionId: string) {
    if (!item || item.poll.status !== "OPEN") return
    setSelections((current) => {
      const forPoll = { ...current }
      const chosen = new Set(forPoll[question.id] ?? [])
      if (question.allowMultiple) {
        if (chosen.has(optionId)) chosen.delete(optionId)
        else chosen.add(optionId)
      } else {
        chosen.clear()
        chosen.add(optionId)
      }
      forPoll[question.id] = [...chosen]
      return forPoll
    })
  }

  function isDirty(poll: PollView): boolean {
    return poll.questions.some((q) => {
      const recorded = q.options
        .filter((o) => o.mine)
        .map((o) => o.id)
        .sort()
      const chosen = [...(selections[q.id] ?? [])].sort()
      return chosen.length > 0 && JSON.stringify(recorded) !== JSON.stringify(chosen)
    })
  }

  async function submitVote() {
    if (!item) return
    const answers = item.poll.questions
      .map((q) => ({ questionId: q.id, optionIds: selections[q.id] ?? [] }))
      .filter((a) => a.optionIds.length > 0)
    if (answers.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const res = await apiJson<{ poll: PollView }>(pollVoteUrl(item, item.poll.id), {
        method: "POST",
        body: JSON.stringify({ answers }),
      })
      setItem({ ...item, poll: res.poll })
      setSelections(seedSelections(res.poll))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't record your vote. Try again.")
    } finally {
      setBusy(false)
    }
  }

  if (item === undefined) {
    return (
      <View style={styles.root}>
        <SubHeader title="Poll" />
        <Loading />
      </View>
    )
  }
  if (item === null) {
    return (
      <View style={styles.root}>
        <SubHeader title="Poll" />
        <EmptyState
          icon="stats-chart-outline"
          title="Poll not found"
          body="It may have closed, or you may not have access to it."
        />
      </View>
    )
  }

  const poll = item.poll
  const open = poll.status === "OPEN"
  const answeredAll = poll.questions.every((q) => q.myAnswered)
  const dirty = isDirty(poll)

  return (
    <View style={styles.root}>
      <SubHeader title={poll.title || "Poll"} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card>
          <View style={styles.top}>
            <TonePill tone="gold" label={scopeLabel(item.scope)} />
            <Text style={styles.scopeName} numberOfLines={1}>
              {item.scopeName}
            </Text>
            {!open ? <TonePill tone="neutral" label="Closed" /> : null}
          </View>
          <Text style={styles.title}>{poll.title}</Text>
          <Text style={styles.meta}>
            {poll.createdBy.name} · {poll.totalVoters} {poll.totalVoters === 1 ? "vote" : "votes"}
          </Text>
          {poll.description ? <Text style={styles.description}>{poll.description}</Text> : null}
        </Card>

        {poll.questions.map((question) => (
          <Card key={question.id}>
            <View style={styles.qTop}>
              <Text style={styles.qPrompt}>{question.prompt}</Text>
              <Text style={styles.qMeta}>
                {question.allowMultiple ? "Pick any" : "Pick one"} · {question.voterCount} voted
              </Text>
            </View>
            {question.options.map((option) => {
              const chosen = new Set(selections[question.id] ?? [])
              const selected = chosen.has(option.id)
              const maxCount = Math.max(1, ...question.options.map((o) => o.count))
              const leading = !open && option.count === maxCount && option.count > 0
              return (
                <Pressable
                  key={option.id}
                  onPress={() => toggle(question, option.id)}
                  disabled={!open}
                  style={[
                    styles.option,
                    selected && { borderColor: ui.primary },
                    leading && !selected && { borderColor: tones.gold.border },
                  ]}
                >
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        width: `${(option.count / maxCount) * 100}%`,
                        backgroundColor: selected ? tones.info.bg : ui.surfaceSunken,
                      },
                    ]}
                  />
                  <View style={styles.optionRow}>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={16} color={ui.primary} />
                    ) : leading ? (
                      <Ionicons name="trophy" size={14} color={tones.gold.fg} />
                    ) : null}
                    <Text style={styles.optionLabel} numberOfLines={1}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionCount}>
                      {option.count} ·{" "}
                      {question.voterCount > 0 ? Math.round((option.count / question.voterCount) * 100) : 0}%
                    </Text>
                  </View>
                  {item.isStaff && option.voters && option.voters.length > 0 ? (
                    <Text style={styles.voters} numberOfLines={1}>
                      {option.voters.join(", ")}
                    </Text>
                  ) : null}
                </Pressable>
              )
            })}
          </Card>
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {open ? (
          <PrimaryButton
            label={busy ? "Saving…" : answeredAll ? "Update vote" : "Vote"}
            onPress={submitVote}
            busy={busy}
            disabled={!dirty}
          />
        ) : null}
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
  title: { fontSize: 18, fontWeight: "800", color: ui.text, marginTop: 6 },
  meta: { fontSize: 12, color: ui.textFaint, marginTop: 3 },
  description: { fontSize: 13.5, color: ui.textMuted, marginTop: 8, lineHeight: 19 },
  qTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  qPrompt: { flex: 1, fontSize: 14.5, fontWeight: "700", color: ui.text },
  qMeta: { fontSize: 11, color: ui.textFaint },
  option: {
    borderWidth: 1.5,
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.md,
    overflow: "hidden",
    backgroundColor: ui.surface,
    marginTop: 6,
  },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, paddingVertical: 10 },
  optionLabel: { flex: 1, fontSize: 14.5, fontWeight: "600", color: ui.text },
  optionCount: { fontSize: 12.5, fontWeight: "800", color: ui.textMuted, fontVariant: ["tabular-nums"] },
  voters: { fontSize: 11, color: ui.textFaint, paddingHorizontal: 11, paddingBottom: 8 },
  error: { color: tones.danger.fg, fontSize: 13, textAlign: "center" },
})
