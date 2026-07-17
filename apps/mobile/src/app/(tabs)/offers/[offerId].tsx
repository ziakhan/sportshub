import { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useStripe } from "@stripe/stripe-react-native"
import { SubHeader } from "@/components/top-bar"
import { apiJson } from "@/lib/api"
import { palette, ui } from "@/lib/theme"

/**
 * Offer detail — review the packages, pay with the Stripe Payment Sheet
 * (Google Pay / card) and accept, or decline. This is the M4 payment
 * spike: PaymentSheet confirming the existing Connect destination-charge
 * pay-intent, then the accept PATCH carries the confirmed intent id.
 * FULL and INSTALLMENTS both native (web offer-response-form parity): the
 * plan picker shows the deposit + schedule; pay-intent charges fee or
 * deposit and saves the card server-side for off-session installments.
 */

interface OfferDetail {
  id: string
  status: string
  seasonFee: number
  includesUniform?: boolean | null
  includesShoes?: boolean | null
  includesTracksuit?: boolean | null
  team: { name: string; ageGroup: string | null; tenant: { name: string } }
  player: { firstName: string; lastName: string }
  options: { id: string; label: string; seasonFee: number; allowFullPay: boolean }[]
}

interface OptionTerms {
  id: string
  label: string
  seasonFee: number
  allowFullPay: boolean
  allowInstallments: boolean
  depositAmount: number | null
  installmentTerms: { sequence: number; amount: number; dueDate: string; label: string | null }[]
}

interface PaymentInfo {
  online: boolean
  currency: string
  seasonFee: number
  options: OptionTerms[]
}

export default function OfferDetailScreen() {
  const { offerId } = useLocalSearchParams<{ offerId: string }>()
  const router = useRouter()
  const { initPaymentSheet, presentPaymentSheet } = useStripe()

  const [offer, setOffer] = useState<OfferDetail | null>(null)
  const [pay, setPay] = useState<PaymentInfo | null>(null)
  const [optionId, setOptionId] = useState<string | null>(null)
  const [uniformSize, setUniformSize] = useState("")
  const [shoeSize, setShoeSize] = useState("")
  const [tracksuitSize, setTracksuitSize] = useState("")
  // At least one jersey preference is ALWAYS required to accept
  // (respond-to-offer.ts) — the missing UI that blocked iOS accepts.
  const [jersey1, setJersey1] = useState("")
  const [jersey2, setJersey2] = useState("")
  const [jersey3, setJersey3] = useState("")
  const [plan, setPlan] = useState<"FULL" | "INSTALLMENTS">("FULL")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const o = await apiJson<OfferDetail>(`/api/offers/${offerId}`)
      setOffer(o)
      if (o.options.length > 0) setOptionId(o.options[0].id)
      if (o.status === "PENDING") {
        setPay(await apiJson<PaymentInfo>(`/api/offers/${offerId}/payment-info`))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the offer")
    }
  }, [offerId])

  useEffect(() => {
    load()
  }, [load])

  const chosen = offer?.options.find((o) => o.id === optionId) ?? null
  const fee = chosen?.seasonFee ?? offer?.seasonFee ?? 0
  const terms = pay?.options.find((o) => o.id === optionId) ?? null
  const canPlan = !!terms?.allowInstallments && (terms.depositAmount ?? 0) > 0
  const activePlan: "FULL" | "INSTALLMENTS" = canPlan ? plan : "FULL"
  const amountDue = activePlan === "INSTALLMENTS" ? (terms?.depositAmount ?? 0) : fee
  const currency = pay?.currency ?? "CAD"

  const jerseyNum = (v: string) => {
    const n = parseInt(v.trim(), 10)
    return Number.isInteger(n) && n >= 0 && n <= 99 ? n : undefined
  }

  async function acceptOffer(depositPaymentIntentId?: string) {
    await apiJson(`/api/offers/${offerId}`, {
      method: "PATCH",
      body: JSON.stringify({
        action: "accept",
        ...(optionId ? { optionId } : {}),
        paymentPlan: activePlan,
        ...(depositPaymentIntentId ? { depositPaymentIntentId } : {}),
        ...(uniformSize.trim() ? { uniformSize: uniformSize.trim() } : {}),
        ...(shoeSize.trim() ? { shoeSize: shoeSize.trim() } : {}),
        ...(tracksuitSize.trim() ? { tracksuitSize: tracksuitSize.trim() } : {}),
        ...(jerseyNum(jersey1) !== undefined ? { jerseyPref1: jerseyNum(jersey1) } : {}),
        ...(jerseyNum(jersey2) !== undefined ? { jerseyPref2: jerseyNum(jersey2) } : {}),
        ...(jerseyNum(jersey3) !== undefined ? { jerseyPref3: jerseyNum(jersey3) } : {}),
      }),
    })
    Alert.alert("Welcome to the team! 🏀", `${offer?.player.firstName} is on the roster.`, [
      { text: "Done", onPress: () => router.back() },
    ])
  }

  async function payAndAccept() {
    if (busy || !offer) return
    if (jerseyNum(jersey1) === undefined) {
      setError("Enter at least a first-choice jersey number (0–99).")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const intent = await apiJson<{
        clientSecret?: string
        paymentIntentId?: string
        noCharge?: boolean
        offline?: boolean
        amountDue?: number
      }>(`/api/offers/${offerId}/pay-intent`, {
        method: "POST",
        body: JSON.stringify({
          ...(optionId ? { chosenOptionId: optionId } : {}),
          paymentPlan: activePlan,
        }),
      })

      if (intent.noCharge || intent.offline) {
        // Free offer, or the club records payment offline — accept directly
        await acceptOffer()
        return
      }
      if (!intent.clientSecret) throw new Error("Payment isn't available right now")

      const init = await initPaymentSheet({
        merchantDisplayName: offer.team.tenant.name,
        paymentIntentClientSecret: intent.clientSecret,
        allowsDelayedPaymentMethods: false,
        googlePay: { merchantCountryCode: "CA", testEnv: true },
      })
      if (init.error) throw new Error(init.error.message)

      const result = await presentPaymentSheet()
      if (result.error) {
        if (result.error.code === "Canceled") return // user backed out — no error banner
        throw new Error(result.error.message)
      }

      await acceptOffer(intent.paymentIntentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed")
    } finally {
      setBusy(false)
    }
  }

  function confirmDecline() {
    Alert.alert("Decline offer", "The club will be told you passed. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          setBusy(true)
          try {
            await apiJson(`/api/offers/${offerId}`, {
              method: "PATCH",
              body: JSON.stringify({ action: "decline" }),
            })
            router.back()
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't decline")
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  if (!offer) {
    return (
      <View style={styles.root}>
        <SubHeader title="Offer" />
        <View style={styles.center}>
          {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator />}
        </View>
      </View>
    )
  }

  const open = offer.status === "PENDING"
  const needsSizes = !!(offer.includesUniform || offer.includesShoes || offer.includesTracksuit)

  return (
    <View style={styles.root}>
      <SubHeader title={offer.team.name} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      <View style={styles.card}>
        <Text style={styles.heading}>
          {offer.player.firstName} {offer.player.lastName}
        </Text>
        <Text style={styles.sub}>
          {offer.team.name}
          {offer.team.ageGroup ? ` · ${offer.team.ageGroup}` : ""} · {offer.team.tenant.name}
        </Text>
        {!open ? <Text style={styles.closed}>This offer is {offer.status.toLowerCase()}.</Text> : null}
      </View>

      {open && offer.options.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.label}>Choose a package</Text>
          {offer.options.map((o) => (
            <Pressable
              key={o.id}
              style={[styles.option, optionId === o.id && styles.optionChosen]}
              onPress={() => setOptionId(o.id)}
            >
              <Text style={[styles.optionLabel, optionId === o.id && styles.optionLabelChosen]}>
                {o.label}
              </Text>
              <Text style={[styles.optionFee, optionId === o.id && styles.optionLabelChosen]}>
                {currency} {o.seasonFee.toFixed(2)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {open && canPlan && pay?.online ? (
        <View style={styles.card}>
          <Text style={styles.label}>How you&apos;ll pay</Text>
          <Pressable
            style={[styles.planRow, activePlan === "FULL" && styles.planRowChosen]}
            onPress={() => setPlan("FULL")}
          >
            <View style={[styles.radio, activePlan === "FULL" && styles.radioChosen]}>
              {activePlan === "FULL" ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planTitle}>Pay in full</Text>
              <Text style={styles.planSub}>
                {currency} {fee.toFixed(2)} now
              </Text>
            </View>
          </Pressable>
          <Pressable
            style={[styles.planRow, activePlan === "INSTALLMENTS" && styles.planRowChosen]}
            onPress={() => setPlan("INSTALLMENTS")}
          >
            <View style={[styles.radio, activePlan === "INSTALLMENTS" && styles.radioChosen]}>
              {activePlan === "INSTALLMENTS" ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planTitle}>Payment plan</Text>
              <Text style={styles.planSub}>
                {currency} {(terms?.depositAmount ?? 0).toFixed(2)} deposit now
              </Text>
              {(terms?.installmentTerms ?? []).map((t) => (
                <Text key={t.sequence} style={styles.planTerm}>
                  {currency} {t.amount.toFixed(2)} on{" "}
                  {new Date(t.dueDate).toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                  })}
                  {t.label ? ` — ${t.label}` : ""}
                </Text>
              ))}
              <Text style={styles.planHint}>
                Your card is saved securely and charged on each date.
              </Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {open && needsSizes ? (
        <View style={styles.card}>
          <Text style={styles.label}>Gear sizes</Text>
          {offer.includesUniform || offer.includesTracksuit ? (
            <TextInput
              style={styles.input}
              placeholder="Uniform size (e.g. YL, AS, AM)"
              placeholderTextColor={ui.textMuted}
              value={uniformSize}
              onChangeText={setUniformSize}
            />
          ) : null}
          {offer.includesShoes ? (
            <TextInput
              style={styles.input}
              placeholder="Shoe size"
              placeholderTextColor={ui.textMuted}
              value={shoeSize}
              onChangeText={setShoeSize}
            />
          ) : null}
          {offer.includesTracksuit ? (
            <TextInput
              style={styles.input}
              placeholder="Tracksuit size (e.g. YL, AS, AM)"
              placeholderTextColor={ui.textMuted}
              value={tracksuitSize}
              onChangeText={setTracksuitSize}
            />
          ) : null}
        </View>
      ) : null}

      {open ? (
        <View style={styles.card}>
          <Text style={styles.label}>Jersey number preferences</Text>
          <Text style={styles.hint}>First choice is required — 0 to 99.</Text>
          <View style={styles.jerseyRow}>
            {[
              ["1st", jersey1, setJersey1],
              ["2nd", jersey2, setJersey2],
              ["3rd", jersey3, setJersey3],
            ].map(([ph, val, set]) => (
              <TextInput
                key={ph as string}
                style={[styles.input, styles.jerseyInput]}
                placeholder={ph as string}
                placeholderTextColor={ui.textMuted}
                keyboardType="number-pad"
                maxLength={2}
                value={val as string}
                onChangeText={set as (v: string) => void}
              />
            ))}
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {open ? (
        <>
          <Pressable
            style={({ pressed }) => [styles.payButton, (pressed || busy) && { opacity: 0.7 }]}
            onPress={payAndAccept}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payButtonText}>
                {amountDue > 0 && pay?.online
                  ? activePlan === "INSTALLMENTS"
                    ? `Pay ${currency} ${amountDue.toFixed(2)} deposit & accept`
                    : `Pay ${currency} ${amountDue.toFixed(2)} & accept`
                  : "Accept offer"}
              </Text>
            )}
          </Pressable>
          <Pressable style={styles.declineButton} onPress={confirmDecline} disabled={busy}>
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
        </>
      ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: ui.radius.md,
    backgroundColor: ui.surface,
    padding: 14,
    gap: 6,
  },
  heading: { fontSize: 18, fontWeight: "800", color: ui.text },
  sub: { fontSize: 13, color: ui.textMuted },
  closed: { fontSize: 14, color: ui.textMuted, fontStyle: "italic", marginTop: 4 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: ui.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: ui.radius.sm,
    padding: 12,
  },
  optionChosen: { borderColor: ui.primary, backgroundColor: palette.play[50] },
  optionLabel: { fontSize: 15, fontWeight: "600", color: ui.text },
  optionLabelChosen: { color: palette.play[700] },
  optionFee: { fontSize: 15, fontWeight: "700", color: ui.text },
  input: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: ui.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: ui.text,
    backgroundColor: ui.surface,
  },
  hint: { fontSize: 12, color: ui.textMuted, marginBottom: 6 },
  jerseyRow: { flexDirection: "row", gap: 8 },
  jerseyInput: { flex: 1, textAlign: "center" },
  planRow: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1.5,
    borderColor: ui.border,
    borderRadius: ui.radius.sm,
    padding: 12,
  },
  planRowChosen: { borderColor: ui.primary, backgroundColor: palette.play[50] },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: ui.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  radioChosen: { borderColor: ui.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ui.primary },
  planTitle: { fontSize: 15, fontWeight: "700", color: ui.text },
  planSub: { fontSize: 13.5, color: ui.text, marginTop: 1 },
  planTerm: { fontSize: 12.5, color: ui.textMuted, marginTop: 2 },
  planHint: { fontSize: 11.5, color: ui.textFaint, marginTop: 5 },
  error: { color: palette.hoop[600], fontSize: 14, textAlign: "center" },
  payButton: {
    backgroundColor: ui.primary,
    borderRadius: ui.radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  payButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  declineButton: { alignItems: "center", paddingVertical: 10 },
  declineText: { color: ui.danger, fontSize: 15, fontWeight: "600" },
})
