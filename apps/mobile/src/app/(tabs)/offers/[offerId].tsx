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
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useStripe } from "@stripe/stripe-react-native"
import { apiJson } from "@/lib/api"
import { palette, ui } from "@/lib/theme"

/**
 * Offer detail — review the packages, pay with the Stripe Payment Sheet
 * (Google Pay / card) and accept, or decline. This is the M4 payment
 * spike: PaymentSheet confirming the existing Connect destination-charge
 * pay-intent, then the accept PATCH carries the confirmed intent id.
 * Full-pay only in v1; installments stay on the website for now.
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

interface PaymentInfo {
  online: boolean
  currency: string
  seasonFee: number
  options: { id: string; label: string; seasonFee: number; allowFullPay: boolean }[]
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
  const amountDue = chosen?.seasonFee ?? offer?.seasonFee ?? 0
  const currency = pay?.currency ?? "CAD"

  async function acceptOffer(depositPaymentIntentId?: string) {
    await apiJson(`/api/offers/${offerId}`, {
      method: "PATCH",
      body: JSON.stringify({
        action: "accept",
        ...(optionId ? { optionId } : {}),
        paymentPlan: "FULL",
        ...(depositPaymentIntentId ? { depositPaymentIntentId } : {}),
        ...(uniformSize.trim() ? { uniformSize: uniformSize.trim() } : {}),
        ...(shoeSize.trim() ? { shoeSize: shoeSize.trim() } : {}),
      }),
    })
    Alert.alert("Welcome to the team! 🏀", `${offer?.player.firstName} is on the roster.`, [
      { text: "Done", onPress: () => router.back() },
    ])
  }

  async function payAndAccept() {
    if (busy || !offer) return
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
          paymentPlan: "FULL",
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
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator />}
      </View>
    )
  }

  const open = offer.status === "PENDING"
  const needsSizes = !!(offer.includesUniform || offer.includesShoes || offer.includesTracksuit)

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: offer.team.name }} />

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
                  ? `Pay ${currency} ${amountDue.toFixed(2)} & accept`
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
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.background },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: ui.radius.md,
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
