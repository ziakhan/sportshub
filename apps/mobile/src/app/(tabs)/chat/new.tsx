import { useCallback, useEffect, useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, ListRow, Loading, SectionHeader, Avatar } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { ui } from "@/lib/theme"

/**
 * New direct message — pick a team, then a person (staff or another
 * parent). Safeguarding rules enforced server-side.
 */

interface ChatTeam {
  teamId: string
  teamName: string
}

interface Members {
  teamName: string
  staff: Array<{ userId: string; name: string; canDm: boolean }>
  families: Array<{ userId: string; name: string; playerNames: string[]; canDm: boolean }>
}

export default function NewDmScreen() {
  const [teams, setTeams] = useState<ChatTeam[] | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [members, setMembers] = useState<Members | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    apiJson<{ teams: ChatTeam[] }>("/api/chat/summary")
      .then((d) => {
        setTeams(d.teams)
        if (d.teams.length === 1) setTeamId(d.teams[0].teamId)
      })
      .catch(() => setTeams([]))
  }, [])

  useEffect(() => {
    if (!teamId) return
    setMembers(null)
    apiJson<Members>(`/api/teams/${teamId}/members`)
      .then(setMembers)
      .catch(() => setMembers({ teamName: "", staff: [], families: [] }))
  }, [teamId])

  const start = useCallback(
    async (userId: string, name: string) => {
      if (!teamId || busy) return
      setBusy(userId)
      try {
        const data = await apiJson<{ conversationId: string }>("/api/conversations", {
          method: "POST",
          body: JSON.stringify({ teamId, userId }),
        })
        router.replace({
          pathname: "/chat/dm/[conversationId]",
          params: { conversationId: data.conversationId, title: name },
        })
      } catch (err) {
        Alert.alert("Couldn't start", err instanceof Error ? err.message : "Try again.")
      } finally {
        setBusy(null)
      }
    },
    [teamId, busy]
  )

  return (
    <View style={styles.root}>
      <SubHeader title="New message" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {teams === null ? <Loading /> : null}
        {teams && teams.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="No teams yet"
            body="Direct messages live inside your team communities."
          />
        ) : null}

        {teams && teams.length > 1 ? (
          <>
            <SectionHeader eyebrow="Step 1" title="Which team?" accent="play" />
            <View style={styles.teamRow}>
              {teams.map((t) => (
                <Pressable
                  key={t.teamId}
                  style={[styles.teamChip, teamId === t.teamId && styles.teamChipOn]}
                  onPress={() => setTeamId(t.teamId)}
                >
                  <Text style={[styles.teamChipText, teamId === t.teamId && styles.teamChipTextOn]}>
                    {t.teamName}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {teamId && !members ? <Loading /> : null}

        {members && members.staff.length > 0 ? (
          <>
            <SectionHeader eyebrow="Coaches & managers" title="Staff" accent="court" />
            <Card>
              {members.staff.map((m) => (
                <ListRow
                  key={m.userId}
                  icon="person-outline"
                  text={m.name}
                  onPress={m.canDm ? () => void start(m.userId, m.name) : undefined}
                />
              ))}
            </Card>
          </>
        ) : null}

        {members && members.families.length > 0 ? (
          <>
            <SectionHeader eyebrow="Parents" title="Families" accent="hoop" />
            <Card>
              {members.families.map((m) => (
                <ListRow
                  key={m.userId}
                  left={<Avatar name={m.name} size={36} />}
                  text={m.name}
                  sub={m.playerNames.join(", ")}
                  onPress={m.canDm ? () => void start(m.userId, m.name) : undefined}
                />
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  teamRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  teamChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ui.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  teamChipOn: { backgroundColor: ui.primary, borderColor: ui.primary },
  teamChipText: { fontSize: 13, fontWeight: "600", color: ui.textMuted },
  teamChipTextOn: { color: "#fff" },
})
