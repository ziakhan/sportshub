import { useCallback, useEffect, useState } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Avatar, Card, EmptyState, Loading } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { ui } from "@/lib/theme"

/**
 * My Kids — native replacement for the old web-view punt to /players.
 * Lists every player on the account with their teams; tap → kid detail.
 */

export interface KidRow {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  position: string | null
  teams: Array<{
    jerseyNumber: number | null
    team: { id: string; name: string; ageGroup: string | null; tenant: { name: string } }
  }>
}

export default function KidsScreen() {
  const [kids, setKids] = useState<KidRow[] | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ players: KidRow[] }>("/api/players")
      setKids(data.players)
    } catch {
      setKids((cur) => cur ?? [])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <View style={styles.root}>
      <SubHeader title="My kids" />
      {kids === null ? (
        <Loading />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={kids}
          keyExtractor={(k) => k.id}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No players yet"
              body="Players join your account when you register for a program or accept an offer."
            />
          }
          renderItem={({ item }) => (
            <Card style={styles.cardSpacing} onPress={() => router.push(`/kids/${item.id}`)}>
              <View style={styles.row}>
                <Avatar name={`${item.firstName} ${item.lastName}`} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.firstName} {item.lastName}
                  </Text>
                  {item.teams.length > 0 ? (
                    item.teams.map((t) => (
                      <Text key={t.team.id} style={styles.teamLine}>
                        {t.team.name} · {t.team.tenant.name}
                        {t.jerseyNumber != null ? ` · #${t.jerseyNumber}` : ""}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.teamLine}>Not on a team yet</Text>
                  )}
                </View>
              </View>
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
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 16, fontWeight: "700", color: ui.text },
  teamLine: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
})
