import { useCallback, useEffect, useState } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, Loading, Monogram, TonePill } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { perkLabel } from "@/lib/perks"
import type { Tone } from "@/lib/theme"
import { tones, ui } from "@/lib/theme"

/**
 * Leagues browse — the full public directory (any league with a season, not
 * just an active one), shared with the web /leagues page via
 * getLeaguesDirectory() (2026-07-24 drift fix + native-parity pass): richer
 * cards with season status, team/division counts and perk chips, matching
 * the web card's information density.
 */

interface DirectorySeason {
  id: string
  name: string
  status: string
  teamCount: number
  divisionCount: number
}

interface DirectoryLeague {
  id: string
  name: string
  description?: string | null
  perks?: string[]
  completedGames?: number
  liveGames?: number
  seasons: DirectorySeason[]
}

const STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  IN_PROGRESS: { label: "Season underway", tone: "positive" },
  REGISTRATION: { label: "Registration open", tone: "info" },
  REGISTRATION_CLOSED: { label: "Starting soon", tone: "info" },
  FINALIZED: { label: "Starting soon", tone: "info" },
  COMPLETED: { label: "Season complete", tone: "neutral" },
  DRAFT: { label: "Coming soon", tone: "neutral" },
}

export default function LeaguesScreen() {
  const [leagues, setLeagues] = useState<DirectoryLeague[] | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ leagues: DirectoryLeague[] }>("/api/mobile/browse/leagues")
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
      <View style={styles.intro}>
        <Text style={styles.introEyebrow}>Competitive play</Text>
        <Text style={styles.introBody}>
          Live scores, standings, stat leaders and recaps from every league on the platform.
        </Text>
      </View>
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
              title="No leagues yet"
              body="Leagues appear here as soon as they're created."
            />
          }
          renderItem={({ item }) => {
            const season = item.seasons[0]
            const status = (season && STATUS_LABEL[season.status]) || STATUS_LABEL.DRAFT
            const perks = item.perks ?? []
            return (
              <Card
                style={styles.cardSpacing}
                onPress={season ? () => router.push(`/browse/season/${season.id}`) : undefined}
              >
                <View style={styles.leagueHead}>
                  <Monogram name={item.name} size={44} />
                  <Text style={styles.leagueName} numberOfLines={2}>
                    {item.name}
                  </Text>
                </View>

                <View style={styles.pillRow}>
                  {!!item.liveGames && item.liveGames > 0 && (
                    <TonePill tone="danger" label={`${item.liveGames} live now`} />
                  )}
                  <TonePill tone={status.tone} label={status.label} />
                  {season ? <TonePill tone="gold" label={season.name} /> : null}
                </View>

                {item.description ? (
                  <Text style={styles.description} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                {perks.length > 0 && (
                  <View style={styles.perkRow}>
                    {perks.slice(0, 3).map((entry) => (
                      <View key={entry} style={styles.perkChip}>
                        <Text style={styles.perkChipText}>{perkLabel(entry)}</Text>
                      </View>
                    ))}
                    {perks.length > 3 && (
                      <Text style={styles.perkMore}>+{perks.length - 3} more</Text>
                    )}
                  </View>
                )}

                {season ? (
                  <View style={styles.statRow}>
                    <View style={styles.statTile}>
                      <Text style={styles.statLabel}>Teams</Text>
                      <Text style={styles.statValue}>{season.teamCount}</Text>
                    </View>
                    <View style={styles.statTile}>
                      <Text style={styles.statLabel}>Divisions</Text>
                      <Text style={styles.statValue}>{season.divisionCount}</Text>
                    </View>
                    <View style={styles.statTile}>
                      <Text style={styles.statLabel}>Games</Text>
                      <Text style={styles.statValue}>{item.completedGames ?? 0}</Text>
                    </View>
                  </View>
                ) : null}
              </Card>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  // Web SectionHeader twin ("Competitive play" eyebrow + description) — page
  // header copy parity (five-tab visual-parity pass 2026-07-24).
  intro: {
    padding: 12,
    paddingBottom: 14,
    gap: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
  },
  introEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    // Web SectionHeader accent="court" (Browse leagues uses the court/green
    // family, not the default play blue).
    color: tones.positive.fg,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  introBody: { fontSize: 12.5, color: ui.textMuted, lineHeight: 17 },
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 32 },
  cardSpacing: { marginBottom: 10, gap: 8 },
  leagueHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  leagueName: { flex: 1, fontSize: 16, fontWeight: "800", color: ui.text },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  description: { fontSize: 12.5, color: ui.textMuted, lineHeight: 17 },
  perkRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  perkChip: {
    backgroundColor: ui.surfaceSunken,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  perkChipText: { fontSize: 11.5, fontWeight: "600", color: ui.textMuted },
  perkMore: { fontSize: 11.5, color: ui.textFaint, fontWeight: "600" },
  statRow: { flexDirection: "row", gap: 8 },
  statTile: {
    flex: 1,
    backgroundColor: ui.surfaceSunken,
    borderRadius: ui.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  statLabel: { fontSize: 10.5, fontWeight: "700", color: ui.textFaint, textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { fontSize: 16, fontWeight: "800", color: ui.text, marginTop: 2 },
})
