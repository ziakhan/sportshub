import { useCallback, useEffect, useMemo, useState } from "react"
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
 * Program detail + NATIVE registration (owner rule: no webviews). Parity
 * with the web ProgramSignupForm (owner 2026-07-23): multi-kid checkboxes,
 * per-kid week picker on camps, eligibility + already-registered shown
 * BEFORE the button, payment copy from the club's actual rails. The server's
 * `viewer` payload is THE source — same getRegistrationViewer as web.
 */

interface ProgramDetail {
  id: string
  type: "tryout" | "camp" | "house-league" | "tournament" | "training"
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

interface ViewerKid {
  id: string
  firstName: string
  lastName: string
  birthYear: number
  eligibility: { status: "ok" | "warn" | "block"; reason: string | null }
  alreadyRegistered: boolean
}

interface Viewer {
  kids: ViewerKid[]
  payment: { online: boolean; offlineMethods: string[] }
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "cash",
  ETRANSFER: "e-transfer",
  CHEQUE: "cheque",
}

function methodsText(methods: string[]): string {
  const labels = methods.map((m) => METHOD_LABELS[m] ?? m.toLowerCase())
  return labels.length <= 1 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`
}

/** Same math as web lib/registration/camp-pricing (server is authoritative). */
function campTotal(program: ProgramDetail, weeksCount: number): number {
  const n = program.numberOfWeeks ?? 1
  const weeklyTotal = program.fee * weeksCount
  if (weeksCount >= n && program.fullCampFee != null && program.fullCampFee <= weeklyTotal) {
    return program.fullCampFee
  }
  return weeklyTotal
}

export default function ProgramDetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>()
  const { signedIn } = useSession()
  const [program, setProgram] = useState<ProgramDetail | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [weeksByKid, setWeeksByKid] = useState<Record<string, number[]>>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(() => {
    apiJson<{ program: ProgramDetail; viewer: Viewer | null }>(
      `/api/mobile/browse/programs/${type}/${id}`
    )
      .then((d) => {
        setProgram(d.program)
        setViewer(d.viewer ?? null)
        const selectable = (d.viewer?.kids ?? []).filter(
          (k) => !k.alreadyRegistered && k.eligibility.status !== "block"
        )
        if (selectable.length === 1) setSelected([selectable[0].id])
      })
      .catch(() => setError(true))
  }, [type, id])

  useEffect(() => {
    load()
  }, [load, signedIn])

  const allWeeks = useMemo(
    () => (program?.numberOfWeeks ? Array.from({ length: program.numberOfWeeks }, (_, i) => i + 1) : []),
    [program?.numberOfWeeks]
  )
  const kidWeeks = useCallback(
    (kidId: string) => weeksByKid[kidId] ?? allWeeks,
    [weeksByKid, allWeeks]
  )

  const isCamp = program?.registration.kind === "player-weeks"
  const totalFor = useCallback(
    (kidId: string) => (program ? (isCamp ? campTotal(program, kidWeeks(kidId).length) : program.fee) : 0),
    [program, isCamp, kidWeeks]
  )
  const total = selected.reduce((sum, kidId) => sum + totalFor(kidId), 0)

  const toggleKid = (kidId: string) =>
    setSelected((prev) => (prev.includes(kidId) ? prev.filter((k) => k !== kidId) : [...prev, kidId]))

  const toggleWeek = (kidId: string, week: number) =>
    setWeeksByKid((prev) => {
      const current = prev[kidId] ?? allWeeks
      const next = current.includes(week)
        ? current.filter((w) => w !== week)
        : [...current, week].sort((a, b) => a - b)
      return { ...prev, [kidId]: next.length === 0 ? current : next }
    })

  const register = useCallback(async () => {
    if (!program?.registration.endpoint || selected.length === 0 || busy) return
    setBusy(true)
    setFormError(null)
    try {
      await apiJson(program.registration.endpoint, {
        method: "POST",
        body: JSON.stringify({
          registrations: selected.map((playerId) => ({
            playerId,
            ...(isCamp ? { weekNumbers: kidWeeks(playerId) } : {}),
          })),
        }),
      })
      const names = selected
        .map((kidId) => viewer?.kids.find((k) => k.id === kidId))
        .filter(Boolean)
        .map((k) => k!.firstName)
      const paymentLine = !program.fee
        ? "See you there!"
        : viewer?.payment.online
          ? "You can pay online from your Payments page."
          : viewer?.payment.offlineMethods.length
            ? `The club accepts ${methodsText(viewer.payment.offlineMethods)} — pay them directly.`
            : "The club will contact you about payment."
      Alert.alert(
        "You're in! 🏀",
        `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} registered. ${paymentLine}`,
        [{ text: "Done", onPress: () => router.back() }]
      )
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setBusy(false)
    }
  }, [program, selected, busy, isCamp, kidWeeks, viewer])

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

  const kids = viewer?.kids ?? []
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
              {viewer === null ? (
                <Loading />
              ) : kids.length === 0 ? (
                <Text style={styles.body}>
                  Add your player under Account → My kids first, then come back to register.
                </Text>
              ) : (
                kids.map((k) => {
                  const checked = selected.includes(k.id)
                  const blocked = k.alreadyRegistered || k.eligibility.status === "block"
                  return (
                    <View key={k.id}>
                      <Pressable
                        style={[
                          styles.kidOption,
                          checked && styles.kidOptionOn,
                          blocked && styles.kidOptionOff,
                        ]}
                        disabled={blocked}
                        onPress={() => toggleKid(k.id)}
                      >
                        <View style={styles.kidRow}>
                          <Text
                            style={[
                              styles.kidName,
                              checked && styles.kidNameOn,
                              blocked && styles.kidNameOff,
                            ]}
                          >
                            {k.firstName} {k.lastName}
                          </Text>
                          {k.alreadyRegistered ? (
                            <TonePill tone="positive" label="✓ Registered" />
                          ) : k.eligibility.status === "block" ? (
                            <TonePill tone="danger" label="Not eligible" />
                          ) : k.eligibility.status === "warn" ? (
                            <TonePill tone="warning" label="Outside age group" />
                          ) : null}
                        </View>
                        {!k.alreadyRegistered && k.eligibility.reason ? (
                          <Text style={styles.reason}>
                            {k.firstName} is {k.eligibility.reason}
                            {k.eligibility.status === "warn" ? " — you can still register." : "."}
                          </Text>
                        ) : null}
                      </Pressable>
                      {isCamp && checked && (program.numberOfWeeks ?? 1) > 1 ? (
                        <View style={styles.weekRow}>
                          {allWeeks.map((n) => {
                            const on = kidWeeks(k.id).includes(n)
                            return (
                              <Pressable
                                key={n}
                                style={[styles.weekChip, on && styles.kidOptionOn]}
                                onPress={() => toggleWeek(k.id, n)}
                              >
                                <Text style={[styles.kidName, on && styles.kidNameOn]}>W{n}</Text>
                              </Pressable>
                            )
                          })}
                          <Text style={styles.weekTotal}>
                            {kidWeeks(k.id).length}/{program.numberOfWeeks} wks ·{" "}
                            {program.currency} {totalFor(k.id).toFixed(0)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )
                })
              )}
            </Card>

            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <PrimaryButton
              label={
                total > 0
                  ? `Register${selected.length > 1 ? ` ${selected.length} players` : ""} · ${program.currency} ${total.toFixed(0)}`
                  : `Register${selected.length > 1 ? ` ${selected.length} players` : ""}`
              }
              onPress={register}
              busy={busy}
              disabled={selected.length === 0}
            />
            {total > 0 && viewer ? (
              <Text style={styles.footnote}>
                {viewer.payment.online
                  ? "Pay online after registering — no charge until you do."
                  : viewer.payment.offlineMethods.length > 0
                    ? `This organizer accepts ${methodsText(viewer.payment.offlineMethods)} — pay them directly after registering.`
                    : "The organizer will contact you about payment after registering."}
              </Text>
            ) : null}
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
  kidOption: {
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.sm,
    padding: 12,
    marginTop: 6,
  },
  kidOptionOn: { borderColor: ui.primary, backgroundColor: palette.play[50] },
  kidOptionOff: { opacity: 0.6, backgroundColor: ui.background },
  kidRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  kidName: { fontSize: 15, fontWeight: "600", color: ui.text },
  kidNameOn: { color: palette.play[700] },
  kidNameOff: { color: ui.textFaint },
  reason: { fontSize: 12, color: ui.textMuted, marginTop: 4, lineHeight: 16 },
  weekRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    marginLeft: 12,
  },
  weekChip: {
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: ui.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weekTotal: { fontSize: 12, color: ui.textMuted, fontWeight: "600" },
  error: { color: palette.hoop[600], fontSize: 14, textAlign: "center" },
  footnote: { fontSize: 12, color: ui.textFaint, textAlign: "center", marginTop: 6 },
})
