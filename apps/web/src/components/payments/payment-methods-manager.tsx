"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"

/**
 * Saved cards manager (payments v2 Stage A). Lists the user's cards, adds one
 * via a SetupIntent (card stored in Stripe's vault, off_session so it can
 * later auto-charge installments), sets a default, removes.
 */

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

interface SavedCard {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
}

export function PaymentMethodsManager() {
  const [cards, setCards] = useState<SavedCard[]>([])
  const [loaded, setLoaded] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [adding, setAdding] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch("/api/payment-methods")
    const data = await res.json()
    if (data.stripeDisabled) setDisabled(true)
    setCards(data.cards ?? [])
    setLoaded(true)
  }, [])

  useEffect(() => {
    refresh().catch(() => setLoaded(true))
  }, [refresh])

  async function startAdd() {
    if (!publishableKey) {
      setError("Online payments aren't configured yet.")
      return
    }
    setError(null)
    const res = await fetch("/api/payment-methods", { method: "POST" })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "Couldn't start adding a card.")
      return
    }
    setClientSecret(data.clientSecret)
    setAdding(true)
  }

  async function setDefault(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/payment-methods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "makeDefault" }),
      })
      if (!res.ok) throw new Error()
      await refresh()
    } catch {
      setError("Couldn't set the default card.")
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this card?")) return
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/payment-methods/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      await refresh()
    } catch {
      setError("Couldn't remove the card.")
    } finally {
      setBusyId(null)
    }
  }

  if (!loaded) return <p className="text-ink-500 py-8 text-sm">Loading your cards…</p>
  if (disabled) {
    return (
      <p className="text-ink-500 rounded-xl bg-ink-50 px-4 py-3 text-sm">
        Online payments aren&apos;t configured in this environment yet.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {cards.length === 0 ? (
        <p className="text-ink-500 text-sm">No cards saved yet.</p>
      ) : (
        <ul className="space-y-2">
          {cards.map((card) => (
            <li
              key={card.id}
              className="border-ink-100 flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-ink-800 text-sm font-semibold">
                  {BRAND_LABEL[card.brand] ?? card.brand} •••• {card.last4}
                  {card.isDefault && (
                    <span className="bg-court-50 text-court-700 ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
                      Default
                    </span>
                  )}
                </p>
                <p className="text-ink-400 text-xs">
                  Expires {String(card.expMonth).padStart(2, "0")}/{card.expYear}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!card.isDefault && (
                  <button
                    onClick={() => setDefault(card.id)}
                    disabled={busyId === card.id}
                    className="border-ink-200 text-ink-600 hover:bg-ink-50 rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                  >
                    Make default
                  </button>
                )}
                <button
                  onClick={() => remove(card.id)}
                  disabled={busyId === card.id}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!adding ? (
        <button
          onClick={startAdd}
          className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white"
        >
          + Add a card
        </button>
      ) : (
        clientSecret && (
          <AddCardForm
            clientSecret={clientSecret}
            onDone={async () => {
              setAdding(false)
              setClientSecret(null)
              await refresh()
            }}
            onCancel={() => {
              setAdding(false)
              setClientSecret(null)
            }}
          />
        )
      )}
    </div>
  )
}

function AddCardForm({
  clientSecret,
  onDone,
  onCancel,
}: {
  clientSecret: string
  onDone: () => void
  onCancel: () => void
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey!), [])
  return (
    <div className="border-ink-100 rounded-2xl border bg-white p-4">
      <p className="text-ink-800 mb-3 text-sm font-semibold">Add a card</p>
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <CardFields onDone={onDone} onCancel={onCancel} />
      </Elements>
    </div>
  )
}

function CardFields({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!stripe || !elements) return
    setSaving(true)
    setError(null)
    const result = await stripe.confirmSetup({ elements, redirect: "if_required" })
    setSaving(false)
    if (result.error) {
      setError(result.error.message || "Couldn't save the card.")
      return
    }
    onDone()
  }

  return (
    <div>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="border-ink-200 text-ink-600 hover:bg-ink-50 rounded-xl border px-4 py-2 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save card"}
        </button>
      </div>
    </div>
  )
}
