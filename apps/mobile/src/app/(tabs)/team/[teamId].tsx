import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import {
  Card,
  EmptyState,
  ListRow,
  Loading,
  SectionHeader,
  TonePill,
} from "@/components/ui"
import { apiJson } from "@/lib/api"
import { PollBubble } from "@/components/poll-bubble"
import { rsvpKeyOf, useMyCalendar } from "@/lib/calendar"
import { palette, ui } from "@/lib/theme"

/**
 * Coach team kit — the road version of the team workspace (§5.6.9
 * Mobile-full): upcoming schedule with RSVP roll-ups, roster, team polls
 * with native voting, one tap to team chat. Deep config (offers, roster
 * moves, practice planning) stays on the desktop dashboard.
 */

interface Poll {
  id: string
  title: string | null
  status: string
  questions: Array<{
    id: string
    prompt: string
    allowMultiple: boolean
    voterCount: number
    myAnswered: boolean
    options: Array<{ id: string; label: string; count: number; mine: boolean }>
  }>
}

export default function TeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>()
  const { calendar, refresh } = useMyCalendar()
  const [polls, setPolls] = useState<Poll[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadPolls = useCallback(async () => {
    try {
      const data = await apiJson<{ polls: Poll[] }>(`/api/teams/${teamId}/polls`)
      setPolls(data.polls)
    } catch {
      setPolls((cur) => cur ?? [])
    }
  }, [teamId])

  useEffect(() => {
    void loadPolls()
  }, [loadPolls])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([loadPolls(), refresh()])
    setRefreshing(false)
  }, [loadPolls, refresh])

  const team = calendar?.teams.find((t) => t.teamId === teamId)
  const roster = calendar?.rsvp.rosterByTeam[teamId ?? ""] ?? []

  const upcoming = useMemo(() => {
    if (!calendar || !teamId) return []
    const now = Date.now()
    return calendar.items
      .filter((i) => i.teamIds.includes(teamId) && new Date(i.at).getTime() >= now - 3 * 3600_000)
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .slice(0, 10)
  }, [calendar, teamId])

  return (
    <View style={styles.root}>
      <SubHeader title={team?.teamName ?? "Team"} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {team ? (
          <Card>
            <Text style={styles.teamName}>{team.teamName}</Text>
            <Text style={styles.meta}>{team.clubName}</Text>
            <ListRow
              icon="chatbubbles-outline"
              text="Team chat"
              onPress={() => router.push(`/chat/${teamId}`)}
            />
          </Card>
        ) : !calendar ? (
          <Loading />
        ) : null}

        <SectionHeader eyebrow="Schedule" title="Coming up" accent="play" />
        {calendar && upcoming.length === 0 ? (
          <EmptyState icon="calendar-outline" title="Nothing scheduled" />
        ) : null}
        {upcoming.map((item) => {
          const responses = calendar!.rsvp.byItem[rsvpKeyOf(item)] ?? {}
          let going = 0
          let out = 0
          let maybe = 0
          for (const p of roster) {
            const s = responses[p.id]?.status
            if (s === "GOING") going++
            else if (s === "NOT_GOING") out++
            else if (s === "MAYBE") maybe++
          }
          const noAnswer = Math.max(0, roster.length - going - out - maybe)
          return (
            <Card key={`${item.kind}:${item.id}`}>
              <View style={styles.top}>
                <Text style={styles.when}>
                  {new Date(item.at).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
                <TonePill
                  tone={item.kind === "game" ? "info" : "positive"}
                  label={item.kind}
                />
              </View>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {item.location ? <Text style={styles.meta}>{item.location}</Text> : null}
              {roster.length > 0 ? (
                <View style={styles.rollup}>
                  <TonePill tone="positive" label={`${going} going`} />
                  {maybe > 0 ? <TonePill tone="warning" label={`${maybe} maybe`} /> : null}
                  {out > 0 ? <TonePill tone="danger" label={`${out} out`} /> : null}
                  {noAnswer > 0 ? <TonePill tone="neutral" label={`${noAnswer} no answer`} /> : null}
                </View>
              ) : null}
            </Card>
          )
        })}

        {polls && polls.length > 0 ? (
          <>
            <SectionHeader eyebrow="Team votes" title="Polls" accent="gold" />
            {polls.map((poll) => (
              <Card key={poll.id}>
                {poll.title ? <Text style={styles.itemTitle}>{poll.title}</Text> : null}
                {poll.questions.map((q) => (
                  <PollBubble
                    key={q.id}
                    teamId={teamId!}
                    poll={{
                      id: poll.id,
                      questionId: q.id,
                      question: q.prompt,
                      allowMultiple: q.allowMultiple,
                      status: poll.status === "OPEN" ? "OPEN" : "CLOSED",
                      voterCount: q.voterCount,
                      options: q.options,
                    }}
                    onUpdate={() => void loadPolls()}
                  />
                ))}
              </Card>
            ))}
          </>
        ) : null}

        {roster.length > 0 ? (
          <>
            <SectionHeader eyebrow="Players" title={`Roster (${roster.length})`} accent="court" />
            <Card>
              {roster.map((p) => (
                <ListRow key={p.id} icon="person-outline" text={p.name} />
              ))}
            </Card>
          </>
        ) : null}

        <Text style={styles.footnote}>
          Roster moves, offers and practice planning live in the club dashboard on a computer.
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  teamName: { fontSize: 18, fontWeight: "800", color: ui.text },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  when: { fontSize: 12, fontWeight: "800", color: palette.play[700] },
  itemTitle: { fontSize: 15, fontWeight: "700", color: ui.text, marginTop: 2 },
  meta: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
  rollup: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  footnote: { fontSize: 12, color: ui.textFaint, textAlign: "center", marginTop: 10 },
})
