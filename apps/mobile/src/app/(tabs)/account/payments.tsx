import { useCallback, useEffect, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { SubHeader } from "@/components/top-bar"
import { Card, EmptyState, Loading, SectionHeader, TonePill } from "@/components/ui"
import { apiJson } from "@/lib/api"
import { ui, type Tone } from "@/lib/theme"

/**
 * Payments & receipts — the family's payment obligations (installments,
 * registrations) and saved cards. Read + review; paying an open item runs
 * through its own flow (offers use the Payment Sheet).
 */

interface Obligation {
  id: string
  description: string | null
  status: string
  amount: number
  currency?: string | null
  dueDate?: string | null
  payeeTenant?: { name: string } | null
  payeeLeague?: { name: string } | null
  payments: Array<{ id: string; amount: number; status: string; createdAt: string }>
}

interface SavedCard {
  id: string
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
}

function toneForStatus(status: string): Tone {
  if (["PAID", "COMPLETED", "SUCCEEDED"].includes(status)) return "positive"
  if (["OVERDUE", "FAILED", "CANCELED"].includes(status)) return "danger"
  if (["PENDING", "PARTIAL", "SCHEDULED"].includes(status)) return "warning"
  return "neutral"
}

export default function PaymentsScreen() {
  const [obligations, setObligations] = useState<Obligation[] | null>(null)
  const [cards, setCards] = useState<SavedCard[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [obs, cardsRes] = await Promise.allSettled([
      apiJson<{ obligations: Obligation[] }>("/api/obligations?mine=true"),
      apiJson<{ cards: SavedCard[] }>("/api/payment-methods"),
    ])
    if (obs.status === "fulfilled") setObligations(obs.value.obligations)
    else setObligations((cur) => cur ?? [])
    if (cardsRes.status === "fulfilled") setCards(cardsRes.value.cards)
    else setCards((cur) => cur ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <View style={styles.root}>
      <SubHeader title="Payments & receipts" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {obligations === null ? <Loading /> : null}

        {obligations && obligations.length === 0 ? (
          <EmptyState
            icon="card-outline"
            title="No payments yet"
            body="Registration fees and installments appear here."
          />
        ) : null}

        {obligations?.map((o) => (
          <Card key={o.id}>
            <View style={styles.top}>
              <TonePill tone={toneForStatus(o.status)} label={o.status.toLowerCase()} />
              <Text style={styles.amount}>
                {o.currency ?? "CAD"} {o.amount.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.title}>{o.description ?? "Payment"}</Text>
            <Text style={styles.meta}>
              {[
                o.payeeTenant?.name ?? o.payeeLeague?.name,
                o.dueDate ? `due ${new Date(o.dueDate).toLocaleDateString()}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {o.payments.length > 0 ? (
              <View style={styles.paymentsBlock}>
                {o.payments.map((p) => (
                  <Text key={p.id} style={styles.paymentLine}>
                    {new Date(p.createdAt).toLocaleDateString()} · {p.status.toLowerCase()} ·{" "}
                    {(o.currency ?? "CAD") + " " + p.amount.toFixed(2)}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>
        ))}

        {cards && cards.length > 0 ? (
          <>
            <SectionHeader eyebrow="Wallet" title="Saved cards" accent="play" />
            <Card>
              {cards.map((card) => (
                <Text key={card.id} style={styles.cardLine}>
                  {(card.brand ?? "Card").toUpperCase()} •••• {card.last4 ?? "????"}
                  {card.expMonth ? `  ${card.expMonth}/${card.expYear}` : ""}
                </Text>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.background },
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amount: { fontSize: 15, fontWeight: "800", color: ui.text },
  title: { fontSize: 14, fontWeight: "700", color: ui.text, marginTop: 4 },
  meta: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
  paymentsBlock: { marginTop: 6, gap: 2 },
  paymentLine: { fontSize: 12, color: ui.textMuted },
  cardLine: { fontSize: 14, color: ui.text, paddingVertical: 4, fontWeight: "600" },
})
