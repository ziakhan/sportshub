import { useCallback, useEffect, useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SubHeader } from "@/components/top-bar"
import {
  Card,
  EmptyState,
  ListRow,
  Loading,
  PrimaryButton,
  SectionHeader,
  TonePill,
  Monogram,
} from "@/components/ui"
import { apiJson } from "@/lib/api"
import { useSession } from "@/lib/session"
import { palette, ui } from "@/lib/theme"

/**
 * Program detail + NATIVE registration (owner rule: no webviews). Tryouts
 * and house leagues take a kid; camps take a kid + number of weeks.
 * Tournament registration is a league-side desktop flow — details render,
 * registration says so ("defer, never dead-end").
 */

interface ProgramDetail {
  id: string
  type: "tryout" | "camp" | "house-league" | "tournament"
  name: string
  description: string | null
  details: string | null
  ageGroup: string
  gender: string | null
  startDate: string
  endDate: string | null
  schedule: string | null
  location: string
  fee: number
  feeUnit: string | null
  currency: string
  clubName: string
  clubSlug: string
  signedUp: number
  maxParticipants: number | null
  numberOfWeeks?: number
  fullCampFee?: number | null
  registration: { kind: "player" | "player-weeks" | "team-desktop"; endpoint: string | null }
}

interface Kid {
  id: string
  firstName: string
  lastName: string
}

export default function ProgramDetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>()
  const { signedIn } = useSession()
  const [program, setProgram] = useState<ProgramDetail | null>(null)
  const [error, setError] = useState(false)
  const [kids, setKids] = useState<Kid[] | null>(null)
  const [kidId, setKidId] = useState<string | null>(null)
  const [weeks, setWeeks] = useState(1)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<{ program: ProgramDetail }>(`/api/mobile/browse/programs/${type}/${id}`)
      .then((d) => setProgram(d.program))
      .catch(() => setError(true))
  }, [type, id])

  useEffect(() => {
    if (!signedIn) return
    apiJson<{ players: Kid[] }>("/api/players")
      .then((d) => {
        setKids(d.players)
        if (d.players.length === 1) setKidId(d.players[0].id)
      })
      .catch(() => setKids([]))
  }, [signedIn])

  const register = useCallback(async () => {
    if (!program?.registration.endpoint || !kidId || busy) return
    setBusy(true)
    setFormError(null)
    try {
      await apiJson(program.registration.endpoint, {
        method: "POST",
        body: JSON.stringify(
          program.registration.kind === "player-weeks"
            ? { playerId: kidId, weeksSelected: weeks }
            : { playerId: kidId }
        ),
      })
      Alert.alert("You're in! 🏀", "Registration received — the club will follow up from here.", [
        { text: "Done", onPress: () => router.back() },
      ])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setBusy(false)
    }
  }, [program, kidId, weeks, busy])

  if (error) {
    return (
      <View style={styles.root}>
        <SubHeader title="Program" />
        <EmptyState icon="pricetags-outline" title="Couldn't load this program" />
      </View>
    )
  }
  if (!program) {
    return (
      <View style={styles.root}>
        <SubHeader title="Program" />
        <Loading />
      </View>
    )
  }

  const spotsLeft =
    program.maxParticipants != null ? program.maxParticipants - program.signedUp : null
  const full = spotsLeft != null && spotsLeft <= 0
  const dateLabel = `${new Date(program.startDate).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })}${program.endDate ? ` – ${new Date(program.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}`

  return (
    <View style={styles.root}>
      <SubHeader title={program.name} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.top}>
            <TonePill tone="info" label={program.type.replace("-", " ")} />
            <Text style={styles.fee}>
              {program.fee > 0
                ? `${program.currency} ${program.fee.toFixed(0)}${program.feeUnit ? ` ${program.feeUnit}` : ""}`
                : "Free"}
            </Text>
          </View>
          <Text style={styles.name}>{program.name}</Text>
          {program.clubName ? (
            <ListRow
              left={<Monogram name={program.clubName} size={36} />}
              text={program.clubName}
              onPress={
                program.clubSlug
                  ? () => router.push(`/browse/club/${program.clubSlug}`)
                  : undefined
              }
            />
          ) : null}
          <Text style={styles.meta}>
            {[program.ageGroup, program.gender].filter(Boolean).join(" · ")}
          </Text>
          <Text style={styles.meta}>{dateLabel}</Text>
          {program.schedule ? <Text style={styles.meta}>{program.schedule}</Text> : null}
          <Text style={styles.meta}>{program.location}</Text>
          <Text style={styles.spots}>
            {full ? "Full — contact the club about a waitlist" : `${program.signedUp}${program.maxParticipants ? `/${program.maxParticipants}` : ""} signed up`}
          </Text>
        </Card>

        {program.description ? (
          <Card>
            <Text style={styles.body}>{program.description}</Text>
          </Card>
        ) : null}
        {program.details ? (
          <Card>
            <Text style={styles.body}>{program.details}</Text>
          </Card>
        ) : null}

        {program.registration.kind === "team-desktop" ? (
          <Card>
            <Text style={styles.body}>
              Team registration for tournaments is handled by your club or league staff on the
              website. Share this tournament with them to get your team in.
            </Text>
          </Card>
        ) : !signedIn ? (
          <>
            <PrimaryButton label="Sign in to register" onPress={() => router.push("/sign-in")} />
            <Text style={styles.footnote}>Browsing is open — registering takes an account.</Text>
          </>
        ) : full ? null : (
          <>
            <SectionHeader eyebrow="Register" title="Who's playing?" accent="hoop" />
            <Card>
              {kids === null ? (
                <Loading />
              ) : kids.length === 0 ? (
                <Text style={styles.body}>
                  Add your player under Account → My kids first, then come back to register.
                </Text>
              ) : (
                kids.map((k) => (
                  <Pressable
                    key={k.id}
                    style={[styles.kidOption, kidId === k.id && styles.kidOptionOn]}
                    onPress={() => setKidId(k.id)}
                  >
                    <Text style={[styles.kidName, kidId === k.id && styles.kidNameOn]}>
                      {k.firstName} {k.lastName}
                    </Text>
                  </Pressable>
                ))
              )}
            </Card>

            {program.registration.kind === "player-weeks" && program.numberOfWeeks ? (
              <Card>
                <Text style={styles.label}>Weeks</Text>
                <View style={styles.weekRow}>
                  {Array.from({ length: program.numberOfWeeks }, (_, i) => i + 1).map((n) => (
                    <Pressable
                      key={n}
                      style={[styles.weekChip, weeks === n && styles.kidOptionOn]}
                      onPress={() => setWeeks(n)}
                    >
                      <Text style={[styles.kidName, weeks === n && styles.kidNameOn]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.footnote}>
                  {program.fullCampFee != null && weeks >= program.numberOfWeeks
                    ? `Full camp: ${program.currency} ${program.fullCampFee.toFixed(0)}`
                    : `${program.currency} ${(program.fee * weeks).toFixed(0)} total`}
                </Text>
              </Card>
            ) : null}

            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <PrimaryButton
              label={program.fee > 0 ? "Register — pay via the club" : "Register"}
              onPress={register}
              busy={busy}
              disabled={!kidId}
            />
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fee: { fontSize: 15, fontWeight: "800", color: ui.text },
  name: { fontSize: 18, fontWeight: "800", color: ui.text, marginTop: 4 },
  meta: { fontSize: 13, color: ui.textMuted, marginTop: 2 },
  spots: { fontSize: 12, color: ui.primaryInk, fontWeight: "700", marginTop: 6 },
  body: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: ui.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  kidOption: {
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.sm,
    padding: 12,
    marginTop: 6,
  },
  kidOptionOn: { borderColor: ui.primary, backgroundColor: palette.play[50] },
  kidName: { fontSize: 15, fontWeight: "600", color: ui.text },
  kidNameOn: { color: palette.play[700] },
  weekRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  weekChip: {
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  error: { color: palette.hoop[600], fontSize: 14, textAlign: "center" },
  footnote: { fontSize: 12, color: ui.textFaint, textAlign: "center", marginTop: 6 },
})
