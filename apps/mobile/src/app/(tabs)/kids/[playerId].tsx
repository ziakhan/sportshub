import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { EventCard } from "@/components/event-card"
import {
  Avatar,
  Card,
  EmptyState,
  ListRow,
  Loading,
  Monogram,
  SectionHeader,
  TonePill,
} from "@/components/ui"
import { apiJson } from "@/lib/api"
import { useMyCalendar } from "@/lib/calendar"
import { ui } from "@/lib/theme"
import type { KidRow } from "./index"

/**
 * Kid detail — web /players card anatomy (element sweep 2026-07-17): hero
 * with chips (age/position/jersey), team rows with monogram + jersey +
 * club·age-group line linking to team home, then THEIR upcoming schedule
 * with inline RSVP (family lens from /api/calendar/mine).
 */

interface KidProfile {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  gender: string | null
  jerseyNumber: number | null
  height: string | null
  weight: string | null
  position: string | null
}

export default function KidDetailScreen() {
  const { playerId } = useLocalSearchParams<{ playerId: string }>()
  const { calendar, refresh } = useMyCalendar()
  const [kid, setKid] = useState<KidProfile | null>(null)
  // Full team detail (jersey/age group/club) — same payload the index uses
  const [teamRows, setTeamRows] = useState<KidRow["teams"] | null>(null)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [profile, list] = await Promise.all([
        apiJson<KidProfile>(`/api/players/${playerId}`),
        apiJson<{ players: KidRow[] }>(`/api/players`).catch(() => null),
      ])
      setKid(profile)
      setTeamRows(list?.players.find((p) => p.id === playerId)?.teams ?? null)
    } catch {
      setError(true)
    }
  }, [playerId])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([load(), refresh()])
    setRefreshing(false)
  }, [load, refresh])

  // This kid's lenses + upcoming items
  const upcoming = useMemo(() => {
    if (!calendar) return []
    const lensKeys = new Set(
      calendar.lenses.filter((l) => l.playerId === playerId).map((l) => l.key)
    )
    const now = Date.now()
    return calendar.items
      .filter(
        (i) =>
          i.lensKeys.some((k) => lensKeys.has(k)) &&
          new Date(i.at).getTime() >= now - 3 * 60 * 60 * 1000
      )
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .slice(0, 12)
  }, [calendar, playerId])

  // Calendar fallback when /api/players didn't answer (older payloads)
  const fallbackTeams = useMemo(() => {
    if (!calendar) return []
    const teamIds = new Set(
      calendar.lenses.filter((l) => l.playerId === playerId && l.teamId).map((l) => l.teamId)
    )
    return calendar.teams.filter((t) => teamIds.has(t.teamId))
  }, [calendar, playerId])

  if (error) {
    return (
      <View style={styles.root}>
        <SubHeader title="Player" />
        <EmptyState icon="person-outline" title="Couldn't load this player" />
      </View>
    )
  }
  if (!kid) {
    return (
      <View style={styles.root}>
        <SubHeader title="Player" />
        <Loading />
      </View>
    )
  }

  const age = kid.dateOfBirth
    ? Math.floor((Date.now() - new Date(kid.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null
  const chips = [
    age != null ? `Age ${age}` : null,
    kid.position,
    kid.jerseyNumber != null ? `#${kid.jerseyNumber}` : null,
    kid.height,
  ].filter(Boolean) as string[]

  return (
    <View style={styles.root}>
      <SubHeader title={`${kid.firstName} ${kid.lastName}`} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card>
          <View style={styles.profileRow}>
            <Avatar name={`${kid.firstName} ${kid.lastName}`} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {kid.firstName} {kid.lastName}
              </Text>
              {chips.length > 0 ? (
                <View style={styles.chipRow}>
                  {chips.map((c) => (
                    <TonePill key={c} tone="neutral" label={c} />
                  ))}
                </View>
              ) : (
                <Text style={styles.meta}>Profile</Text>
              )}
            </View>
          </View>
        </Card>

        <SectionHeader eyebrow="Rosters" title="Teams" accent="court" />
        <Card>
          {teamRows && teamRows.length > 0 ? (
            teamRows.map((t) => (
              <ListRow
                key={t.team.id}
                left={<Monogram name={t.team.name} size={36} />}
                text={`${t.team.name}${t.jerseyNumber != null ? `  ·  #${t.jerseyNumber}` : ""}`}
                sub={[t.team.tenant.name, t.team.ageGroup].filter(Boolean).join(" · ")}
                onPress={() => router.push(`/team/${t.team.id}`)}
              />
            ))
          ) : fallbackTeams.length > 0 ? (
            fallbackTeams.map((t) => (
              <ListRow
                key={t.teamId}
                left={<Monogram name={t.teamName} size={36} />}
                text={t.teamName}
                sub={t.clubName}
                onPress={() => router.push(`/team/${t.teamId}`)}
              />
            ))
          ) : (
            <Text style={styles.emptyTeams}>
              Not on a team yet — accepted offers place players on their team automatically.
            </Text>
          )}
          <ListRow
            icon="document-text-outline"
            text="Offers & payments"
            onPress={() => router.push("/offers")}
          />
        </Card>

        <SectionHeader eyebrow="Schedule" title="Coming up" accent="play" />
        {!calendar ? <Loading /> : null}
        {calendar && upcoming.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="Nothing scheduled"
            body={`${kid.firstName}'s practices and games land here.`}
          />
        ) : null}
        {calendar
          ? upcoming.map((item) => (
              <EventCard
                key={`${item.kind}:${item.id}`}
                item={item}
                calendar={calendar}
                playerFilter={playerId}
              />
            ))
          : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  name: { fontSize: 20, fontWeight: "800", color: ui.text },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  meta: { fontSize: 13, color: ui.textMuted, marginTop: 1 },
  emptyTeams: { fontSize: 12.5, color: ui.textFaint, paddingVertical: 6 },
})
