import { ScrollView, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { TopBar } from "@/components/top-bar"
import { Card, ListRow, SectionHeader } from "@/components/ui"
import { useHome, coachTeamPath } from "@/lib/home"
import { ui } from "@/lib/theme"

/**
 * Context tab — the role slot from the web's bottom tabs (operator > coach >
 * parent > referee). Every destination is NATIVE now (audit v2 §2): the
 * operator summary, coach team kits, kid screens, referee kit.
 */
export default function ContextScreen() {
  const { home } = useHome()
  const shape = home?.shape
  const c = home?.contexts
  if (!shape || !c) {
    return (
      <View style={styles.screen}>
        <TopBar unread={home?.unreadNotifications ?? 0} />
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <TopBar unread={home?.unreadNotifications ?? 0} />
      <ScrollView contentContainerStyle={styles.content}>
        {shape.isOperator ? (
          <>
            <SectionHeader eyebrow="Operate" title="Operations" accent="play" />
            <Card>
              <ListRow
                icon="grid-outline"
                text="Clubs & leagues summary"
                onPress={() => router.push("/operator")}
              />
            </Card>
          </>
        ) : null}

        {c.coachTeams.length > 0 ? (
          <>
            <SectionHeader
              eyebrow="Coach"
              title={c.coachTeams.length > 1 ? "My teams" : "My team"}
              accent="court"
            />
            <Card>
              {c.coachTeams.map((t) => (
                <ListRow
                  key={t.teamId}
                  icon="people-outline"
                  text={t.name}
                  sub={t.clubName}
                  onPress={() => router.push(coachTeamPath(t) as any)}
                />
              ))}
            </Card>
          </>
        ) : null}

        {c.kids.length > 0 ? (
          <>
            <SectionHeader eyebrow="Family" title="My kids" accent="hoop" />
            <Card>
              {c.kids.map((k) => (
                <ListRow
                  key={k.playerId}
                  icon="person-outline"
                  text={k.name}
                  onPress={() => router.push(`/kids/${k.playerId}`)}
                />
              ))}
            </Card>
          </>
        ) : null}

        {shape.isRefereeing ? (
          <>
            <SectionHeader eyebrow="Officiate" title="Refereeing" accent="gold" />
            <Card>
              <ListRow
                icon="flag-outline"
                text={
                  c.refereeGames > 0
                    ? `${c.refereeGames} upcoming game${c.refereeGames > 1 ? "s" : ""}`
                    : "My games & shifts"
                }
                onPress={() => router.push("/referee")}
              />
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.background },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
})
