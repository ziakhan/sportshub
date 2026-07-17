import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Ionicons from "@expo/vector-icons/Ionicons"
import { apiJson } from "@/lib/api"
import { tones, ui } from "@/lib/theme"
import { useTheme } from "@/lib/theme-context"

/**
 * Chat poll, votable in place (web PollBubble twin — same
 * /api/teams/[id]/polls/[pollId]/vote endpoint, bearer auth). Energy Pass
 * treatment: energy accent on my picks, result bars relative to the leading
 * option, gold tint on the winner once the poll closes.
 */

export interface ChatPollData {
  id: string
  questionId: string
  question: string
  allowMultiple: boolean
  status: "OPEN" | "CLOSED"
  voterCount: number
  options: Array<{ id: string; label: string; count: number; mine: boolean }>
}

/** The vote endpoint returns the full poll; fold it back to the chat shape. */
function toChatPoll(poll: {
  id: string
  status: "OPEN" | "CLOSED"
  questions?: Array<{
    id: string
    prompt: string
    allowMultiple: boolean
    voterCount: number
    options: Array<{ id: string; label: string; count: number; mine: boolean }>
  }>
}): ChatPollData | null {
  const question = poll?.questions?.[0]
  if (!question) return null
  return {
    id: poll.id,
    questionId: question.id,
    question: question.prompt,
    allowMultiple: question.allowMultiple,
    status: poll.status,
    voterCount: question.voterCount,
    options: question.options.map((o) => ({
      id: o.id,
      label: o.label,
      count: o.count,
      mine: o.mine,
    })),
  }
}

export function PollBubble({
  teamId,
  poll,
  onUpdate,
}: {
  teamId: string
  poll: ChatPollData
  onUpdate: (poll: ChatPollData) => void
}) {
  const t = useTheme()
  const [busy, setBusy] = useState(false)
  const open = poll.status === "OPEN"
  const maxCount = Math.max(1, ...poll.options.map((o) => o.count))

  async function tap(optionId: string) {
    if (!open || busy) return
    let optionIds: string[]
    if (poll.allowMultiple) {
      const mine = new Set(poll.options.filter((o) => o.mine).map((o) => o.id))
      if (mine.has(optionId)) mine.delete(optionId)
      else mine.add(optionId)
      if (mine.size === 0) return // keep at least one choice once voted
      optionIds = [...mine]
    } else {
      if (poll.options.find((o) => o.id === optionId)?.mine) return
      optionIds = [optionId]
    }
    setBusy(true)
    try {
      const res = await apiJson<{ poll: Parameters<typeof toChatPoll>[0] }>(
        `/api/teams/${teamId}/polls/${poll.id}/vote`,
        {
          method: "POST",
          body: JSON.stringify({ answers: [{ questionId: poll.questionId, optionIds }] }),
        }
      )
      const updated = toChatPoll(res.poll)
      if (updated) onUpdate(updated)
    } catch {
      // transient — the next chat refresh cycle re-serializes counts anyway
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: t.energySoft }]}>
          <Ionicons name="stats-chart" size={13} color={t.energyInk} />
        </View>
        <Text style={styles.question}>{poll.question}</Text>
        {!open ? (
          <View style={styles.closedPill}>
            <Text style={styles.closedPillText}>CLOSED</Text>
          </View>
        ) : null}
      </View>
      {poll.options.map((option) => {
        const share = poll.voterCount > 0 ? Math.round((option.count / poll.voterCount) * 100) : 0
        const leading = !open && option.count === maxCount && option.count > 0
        const barColor = option.mine
          ? t.energySoft
          : leading
            ? t.highlightSoft
            : ui.surfaceSunken
        return (
          <Pressable
            key={option.id}
            onPress={() => tap(option.id)}
            disabled={!open || busy}
            style={[
              styles.option,
              option.mine && { borderColor: t.energy },
              leading && !option.mine && { borderColor: t.highlight },
            ]}
          >
            <View
              style={[
                StyleSheet.absoluteFill,
                { width: `${(option.count / maxCount) * 100}%`, backgroundColor: barColor },
              ]}
            />
            <View style={styles.optionRow}>
              {option.mine ? (
                <View style={[styles.check, { backgroundColor: t.energy }]}>
                  <Ionicons name="checkmark" size={11} color={t.energyOn} />
                </View>
              ) : null}
              {leading && !option.mine ? (
                <Ionicons name="trophy" size={13} color={tones.gold.fg} />
              ) : null}
              <Text style={styles.optionLabel} numberOfLines={1}>
                {option.label}
              </Text>
              <Text style={[styles.optionCount, option.mine && { color: t.energyInk }]}>
                {option.count} · {share}%
              </Text>
            </View>
          </Pressable>
        )
      })}
      <Text style={styles.footer}>
        {poll.voterCount} {poll.voterCount === 1 ? "vote" : "votes"}
        {poll.allowMultiple ? " · multiple choices" : ""}
        {open ? " · tap to vote" : ""}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6, gap: 6, minWidth: 230 },
  header: { flexDirection: "row", alignItems: "center", gap: 7 },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  question: { flex: 1, fontSize: 16, fontWeight: "800", color: ui.text },
  closedPill: {
    backgroundColor: ui.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  closedPillText: { fontSize: 9, fontWeight: "800", color: ui.textMuted, letterSpacing: 0.5 },
  option: {
    borderWidth: 1.5,
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.md,
    overflow: "hidden",
    backgroundColor: ui.surface,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  check: {
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: ui.text },
  optionCount: {
    fontSize: 13,
    fontWeight: "800",
    color: ui.textMuted,
    fontVariant: ["tabular-nums"],
  },
  footer: { fontSize: 12.5, color: ui.textFaint },
})
