import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"
import { apiBaseUrl } from "@/lib/api"
import { useHome, coachTeamWebPath } from "@/lib/home"
import { ui } from "@/lib/theme"

/**
 * Context tab — the role slot from the web's bottom tabs (operator > coach >
 * parent > referee). Stage 1: native summaries with the deep work opening
 * the web workspaces in-app.
 */

function openWeb(path: string) {
  void WebBrowser.openBrowserAsync(`${apiBaseUrl()}${path}`)
}

export default function ContextScreen() {
  const { home } = useHome()
  const shape = home?.shape
  const c = home?.contexts
  if (!shape || !c) return <View style={styles.screen} />

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {shape.isOperator ? (
        <Section title="Operations">
          <Row icon="grid-outline" text="Open dashboard" onPress={() => openWeb("/dashboard")} />
        </Section>
      ) : null}

      {c.coachTeams.length > 0 ? (
        <Section title={c.coachTeams.length > 1 ? "My teams" : "My team"}>
          {c.coachTeams.map((t) => {
            const s = shape.coachTeams.find((x) => x.teamId === t.teamId)
            return (
              <Row
                key={t.teamId}
                icon="people-outline"
                text={`${t.name}${t.clubName ? ` · ${t.clubName}` : ""}`}
                onPress={() => (s ? openWeb(coachTeamWebPath(s)) : undefined)}
              />
            )
          })}
        </Section>
      ) : null}

      {c.kids.length > 0 ? (
        <Section title="My kids">
          {c.kids.map((k) => (
            <Row key={k.playerId} icon="person-outline" text={k.name} onPress={() => openWeb("/players")} />
          ))}
        </Section>
      ) : null}

      {shape.isRefereeing ? (
        <Section title="Refereeing">
          <Row
            icon="flag-outline"
            text={c.refereeGames > 0 ? `${c.refereeGames} upcoming game${c.refereeGames > 1 ? "s" : ""}` : "My games"}
            onPress={() => openWeb("/referee")}
          />
        </Section>
      ) : null}
    </ScrollView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  )
}

function Row({ icon, text, onPress }: { icon: any; text: string; onPress?: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Ionicons name={icon} size={18} color={ui.primary} />
      <Text style={styles.rowText}>{text}</Text>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={ui.textMuted} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.background },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: ui.surface,
    borderRadius: ui.radius.md,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 14,
    gap: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: ui.text, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  rowText: { flex: 1, fontSize: 14, color: ui.text },
})
