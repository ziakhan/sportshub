import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import { EventCard } from "@/components/event-card"
import { Avatar, Card, EmptyState, ListRow, Loading, SectionHeader } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { useMyCalendar } from "@/lib/calendar"
import { ui } from "@/lib/theme"

/**
 * Kid detail — profile + teams + THEIR upcoming schedule with inline RSVP
 * (the family lens for this player from /api/calendar/mine), plus quick
 * links to offers. Fully native (audit v2 §2).
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
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setKid(await apiJson<KidProfile>(`/api/players/${playerId}`))
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

  const teams = useMemo(() => {
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
            <Avatar name={`${kid.firstName} ${kid.lastName}`} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {kid.firstName} {kid.lastName}
              </Text>
              <Text style={styles.meta}>
                {[
                  age != null ? `${age} yrs` : null,
                  kid.position,
                  kid.jerseyNumber != null ? `#${kid.jerseyNumber}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Profile"}
              </Text>
            </View>
          </View>
          {teams.map((t) => (
            <ListRow key={t.teamId} icon="people-outline" text={t.teamName} sub={t.clubName} />
          ))}
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
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  name: { fontSize: 18, fontWeight: "800", color: ui.text },
  meta: { fontSize: 13, color: ui.textMuted, marginTop: 1 },
})
