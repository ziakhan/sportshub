"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { formatCurrency } from "@/lib/countries"

/**
 * "Pay online" → checkout API → Stripe PaymentElement → confirm → the
 * webhook flips the obligation; we refresh optimistically after confirm.
 * Env-gated: without NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY the button explains
 * itself instead of rendering a dead form.
 */

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

export function PayOnlineButton({
  obligationId,
  amount,
  currency,
}: {
  obligationId: string
  amount: number
  currency: string
}) {
  const [open, setOpen] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  async function start() {
    if (!publishableKey) {
      setError("Online payment isn't configured yet")
      return
    }
    setStarting(true)
    setError(null)
    const res = await fetch(`/api/obligations/${obligationId}/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    setStarting(false)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body.error || "Couldn't start the payment")
      return
    }
    setClientSecret(body.clientSecret)
    setOpen(true)
  }

  return (
    <>
      <button
        onClick={start}
        disabled={starting}
        className="rounded-md bg-play-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-play-700 disabled:opacity-50"
        title={publishableKey ? undefined : "Online payments not configured"}
      >
        {starting ? "Starting…" : "Pay online"}
      </button>
      {error && <span className="text-xs text-hoop-700">{error}</span>}
      {open && clientSecret && (
        <PayModal
          clientSecret={clientSecret}
          amount={amount}
          currency={currency}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function PayModal({
  clientSecret,
  amount,
  currency,
  onClose,
}: {
  clientSecret: string
  amount: number
  currency: string
  onClose: () => void
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey!), [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-ink-900">
          Pay {formatCurrency(amount, currency)}
        </h3>
        <div className="mt-4">
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PayForm amount={amount} currency={currency} onClose={onClose} />
          </Elements>
        </div>
      </div>
    </div>
  )
}

function PayForm({
  amount,
  currency,
  onClose,
}: {
  amount: number
  currency: string
  onClose: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [paying, setPaying] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pay() {
    if (!stripe || !elements) return
    setPaying(true)
    setError(null)
    const result = await stripe.confirmPayment({ elements, redirect: "if_required" })
    setPaying(false)
    if (result.error) {
      setError(result.error.message || "Payment failed")
      return
    }
    setDone(true)
    // The webhook records the truth; give it a beat, then refresh the page.
    setTimeout(() => {
      router.refresh()
      onClose()
    }, 1800)
  }

  if (done) {
    return (
      <div className="py-6 text-center">
        <p className="text-lg font-medium text-court-700">✓ Payment received</p>
        <p className="mt-1 text-sm text-ink-500">Updating your balance…</p>
      </div>
    )
  }

  return (
    <div>
      <PaymentElement />
      {error && (
        <div className="mt-3 rounded-md bg-hoop-50 px-3 py-2 text-sm text-hoop-700">{error}</div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={paying}
          className="rounded-md border border-ink-200 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50"
        >
          Cancel
        </button>
        <button
          onClick={pay}
          disabled={paying || !stripe}
          className="rounded-md bg-play-600 px-4 py-2 text-sm font-medium text-white hover:bg-play-700 disabled:opacity-50"
        >
          {paying ? "Processing…" : `Pay ${formatCurrency(amount, currency)}`}
        </button>
      </div>
    </div>
  )
}
