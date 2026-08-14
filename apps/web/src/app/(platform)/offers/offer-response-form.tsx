"use client"

import { useEffect, useMemo, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { formatCurrency } from "@/lib/countries"
import { BrandListbox, ChoiceCardGroup } from "@/components/ui"
import { WaiverSignGate, type GateWaiver } from "@/components/waivers/waiver-sign-gate"
import { readMinorGate, MinorGateNotice, type MinorGateOutcome } from "@/components/family/minor-gate"

/** Thrown to unwind the accept flow once the gate has already answered. */
class MinorGateStop extends Error {}

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

const CLOTHING_SIZES = [
  { value: "YS", label: "Youth Small" },
  { value: "YM", label: "Youth Medium" },
  { value: "YL", label: "Youth Large" },
  { value: "AS", label: "Adult Small" },
  { value: "AM", label: "Adult Medium" },
  { value: "AL", label: "Adult Large" },
  { value: "AXL", label: "Adult XL" },
]
const SHOE_SIZES = ["4","4.5","5","5.5","6","6.5","7","7.5","8","8.5","9","9.5","10","10.5","11","11.5","12","13"]

export interface OfferPackageView {
  id: string
  label: string
  seasonFee: number
  installments: number
  practiceSessions: number
  includesBall: boolean
  includesBag: boolean
  includesShoes: boolean
  includesUniform: boolean
  includesTracksuit: boolean
}

interface SavedCard {
  id: string
  brand: string
  last4: string
  isDefault: boolean
}
interface InstallmentTerm {
  sequence: number
  amount: number
  dueDate: string
  label: string | null
}
interface OptionTerms {
  id: string
  allowFullPay: boolean
  allowInstallments: boolean
  depositAmount: number | null
  installmentTerms: InstallmentTerm[]
}
interface PaymentInfo {
  online: boolean
  currency: string
  seasonFee: number
  savedCards: SavedCard[]
  options: OptionTerms[]
}

const money = (n: number, c?: string) => formatCurrency(n, c)

export function OfferResponseForm({
  offerId,
  playerId,
  playerName,
  includesUniform: offerIncludesUniform,
  includesShoes: offerIncludesShoes,
  includesTracksuit: offerIncludesTracksuit,
  options = [],
  currency,
  onDone,
  onCancel,
}: {
  offerId: string
  playerId: string
  playerName?: string
  includesUniform: boolean
  includesShoes: boolean
  includesTracksuit: boolean
  options?: OfferPackageView[]
  currency?: string
  onDone: () => void
  onCancel: () => void
}) {
  const [uniformSize, setUniformSize] = useState("")
  const [shoeSize, setShoeSize] = useState("")
  const [tracksuitSize, setTracksuitSize] = useState("")
  const [jerseyPref1, setJerseyPref1] = useState("")
  const [jerseyPref2, setJerseyPref2] = useState("")
  const [jerseyPref3, setJerseyPref3] = useState("")
  const [optionId, setOptionId] = useState<string>(options.length === 1 ? options[0].id : "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The money gate answer, when a 13-17 self-owned player tried to accept a
  // paid offer (owner 2026-08-12).
  const [minorGate, setMinorGate] = useState<MinorGateOutcome | null>(null)

  // Payment
  const [payInfo, setPayInfo] = useState<PaymentInfo | null>(null)
  const [plan, setPlan] = useState<"FULL" | "INSTALLMENTS">("FULL")
  const [selectedCardId, setSelectedCardId] = useState<string>("")
  const [useNewCard, setUseNewCard] = useState(false)
  const [cardStep, setCardStep] = useState<{ clientSecret: string } | null>(null)

  // Owner ruling 2026-07-20: team-membership waivers are signed WITH the
  // offer. The accept API answers 409 WAIVERS_REQUIRED; the gate collects
  // signatures and the accept retries (reusing any already-paid intent).
  const [waiverGate, setWaiverGate] = useState<
    { waivers: GateWaiver[]; intentId: string | null } | null
  >(null)

  const labelClass = "block text-sm font-medium text-ink-800"

  useEffect(() => {
    fetch(`/api/offers/${offerId}/payment-info`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PaymentInfo | null) => {
        if (!d) return
        setPayInfo(d)
        const def = d.savedCards.find((c) => c.isDefault) ?? d.savedCards[0]
        if (def) setSelectedCardId(def.id)
      })
      .catch(() => {})
  }, [offerId])

  const chosen = options.find((o) => o.id === optionId)
  const includesUniform = options.length > 0 ? !!chosen?.includesUniform : offerIncludesUniform
  const includesShoes = options.length > 0 ? !!chosen?.includesShoes : offerIncludesShoes
  const includesTracksuit = options.length > 0 ? !!chosen?.includesTracksuit : offerIncludesTracksuit

  const terms = useMemo<OptionTerms | null>(
    () => payInfo?.options.find((o) => o.id === optionId) ?? null,
    [payInfo, optionId]
  )
  const fee = chosen?.seasonFee ?? payInfo?.seasonFee ?? 0
  const canPlan = !!terms?.allowInstallments && (terms.depositAmount ?? 0) > 0
  const amountDue =
    plan === "INSTALLMENTS" && terms?.allowInstallments ? terms.depositAmount ?? 0 : fee
  const online = !!payInfo?.online
  const needsPayment = online && amountDue > 0
  const hasSavedCards = (payInfo?.savedCards.length ?? 0) > 0
  const willEnterNewCard = needsPayment && (useNewCard || !hasSavedCards)

  function validate(): string | null {
    if (options.length > 0 && !optionId) return "Please choose a package first"
    if (includesUniform && !uniformSize) return "Please select a uniform size"
    if (includesShoes && !shoeSize) return "Please select a shoe size"
    if (includesTracksuit && !tracksuitSize) return "Please select a tracksuit size"
    if (!jerseyPref1) return "Please enter at least your first jersey number preference"
    const p1 = parseInt(jerseyPref1)
    if (isNaN(p1) || p1 < 0 || p1 > 99) return "Jersey numbers must be between 0 and 99"
    const prefs = [p1, jerseyPref2 ? parseInt(jerseyPref2) : undefined, jerseyPref3 ? parseInt(jerseyPref3) : undefined].filter((p) => p !== undefined)
    if (new Set(prefs).size !== prefs.length) return "Jersey number preferences must be different"
    return null
  }

  async function doAccept(depositPaymentIntentId: string | null) {
    // Persona demo: accepting the staged offer is session-scoped — the
    // visitor sees the welcome and "their kid on the roster" without any
    // real offer/payment/waiver row changing. Skips the money/waiver gates
    // by design: the demo never takes payment.
    if (typeof document !== "undefined" && document.cookie.includes("demo-view-hint=")) {
      const res = await fetch(`/api/demo/action/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: offerId }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "The demo could not accept this offer.")
      if (payload.welcome) {
        try {
          window.alert(`${payload.welcome}\n\n(Demo: your acceptance is visible only to you and resets nightly.)`)
        } catch {}
      }
      onDone()
      return
    }
    const res = await fetch(`/api/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "accept",
        optionId: optionId || undefined,
        paymentPlan: needsPayment || canPlan ? plan : undefined,
        depositPaymentIntentId: depositPaymentIntentId || undefined,
        uniformSize: uniformSize || undefined,
        shoeSize: shoeSize || undefined,
        tracksuitSize: tracksuitSize || undefined,
        jerseyPref1: parseInt(jerseyPref1),
        jerseyPref2: jerseyPref2 ? parseInt(jerseyPref2) : undefined,
        jerseyPref3: jerseyPref3 ? parseInt(jerseyPref3) : undefined,
      }),
    })
    const payload = await res.json().catch(() => ({}))
    // The money gate (owner 2026-08-12): accepting a paid offer as a 13-17
    // self-owned player is a request to their guardian, not an acceptance.
    const gateOutcome = readMinorGate(res, payload)
    if (gateOutcome) {
      setMinorGate(gateOutcome)
      return
    }
    if (!res.ok) {
      const e = payload
      if (e.code === "WAIVERS_REQUIRED" && Array.isArray(e.waivers)) {
        setWaiverGate({ waivers: e.waivers, intentId: depositPaymentIntentId })
        return
      }
      throw new Error(e.error || "Failed to accept offer")
    }
    onDone()
  }

  async function payIntent(paymentMethodId?: string) {
    const res = await fetch(`/api/offers/${offerId}/pay-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chosenOptionId: optionId || undefined, paymentPlan: plan, paymentMethodId }),
    })
    const payload = await res.json().catch(() => ({}))
    const gateOutcome = readMinorGate(res, payload)
    if (gateOutcome) {
      setMinorGate(gateOutcome)
      throw new MinorGateStop()
    }
    if (!res.ok) throw new Error(payload.error || "Couldn't start the payment")
    return payload
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = validate()
    if (v) return setError(v)
    setError(null)
    setMinorGate(null)
    setIsSubmitting(true)
    try {
      // Offline club or nothing due → accept straight away
      if (!needsPayment) {
        await doAccept(null)
        return
      }
      if (willEnterNewCard) {
        // No card on file (or "use a new card") → collect it via Elements
        const { clientSecret } = await payIntent()
        setCardStep({ clientSecret })
        return
      }
      // Card already on file → charge it now, one-click
      const r = await payIntent(selectedCardId)
      if (r.status === "succeeded") {
        await doAccept(r.paymentIntentId)
      } else if (r.status === "requires_action" && r.clientSecret) {
        const stripe = await loadStripe(publishableKey!)
        const { error: actErr } = (await stripe!.handleNextAction({ clientSecret: r.clientSecret })) as any
        if (actErr) throw new Error(actErr.message || "Card authentication failed")
        await doAccept(r.paymentIntentId)
      } else {
        throw new Error("Your card couldn't be charged — try a different card.")
      }
    } catch (err) {
      // The gate already put its own answer on screen.
      if (!(err instanceof MinorGateStop)) {
        setError(err instanceof Error ? err.message : "An error occurred")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasSizeFields = includesUniform || includesShoes || includesTracksuit

  return (
    <div className="border-court-200 bg-court-50 mt-4 rounded-2xl border p-4">
      {minorGate ? (
        <div className="mb-4">
          <MinorGateNotice outcome={minorGate} />
        </div>
      ) : null}
      {waiverGate ? (
        <WaiverSignGate
          waivers={waiverGate.waivers}
          playerId={playerId}
          playerName={playerName}
          onComplete={() => {
            const intentId = waiverGate.intentId
            setWaiverGate(null)
            setIsSubmitting(true)
            doAccept(intentId)
              .catch((err) =>
                setError(err instanceof Error ? err.message : "An error occurred")
              )
              .finally(() => setIsSubmitting(false))
          }}
          onCancel={() => setWaiverGate(null)}
        />
      ) : null}
      <h4 className="text-ink-900 mb-3 font-semibold">Accept Offer</h4>
      {error && (
        <div className="border-hoop-200 text-hoop-700 mb-3 rounded-md border bg-red-50 p-3 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {options.length > 1 && (
          <div>
            <span className="text-ink-800 mb-2 block text-sm font-medium">
              Choose your package <span className="text-red-500">*</span>
            </span>
            <ChoiceCardGroup
              ariaLabel="Choose your package"
              value={optionId}
              onChange={setOptionId}
              options={options.map((option) => {
                const items = [
                  option.includesUniform && "Uniform",
                  option.includesTracksuit && "Tracksuit",
                  option.includesShoes && "Shoes",
                  option.includesBall && "Basketball",
                  option.includesBag && "Bag",
                ].filter(Boolean)
                return {
                  value: option.id,
                  title: option.label,
                  description: (
                    <>
                      <strong className="text-ink-900">{money(option.seasonFee, currency)}</strong>
                      {" · "}
                      {items.length > 0 ? `Includes ${items.join(", ")}` : "No gear included"}
                    </>
                  ),
                }
              })}
            />
          </div>
        )}

        {hasSizeFields && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {includesUniform && (
              <div>
                <label htmlFor="offer-uniform-size" className={labelClass}>Uniform Size <span className="text-red-500">*</span></label>
                <div className="mt-1">
                  <BrandListbox
                    id="offer-uniform-size"
                    ariaLabel="Uniform size"
                    value={uniformSize}
                    onChange={setUniformSize}
                    placeholder="Select..."
                    options={CLOTHING_SIZES}
                  />
                </div>
              </div>
            )}
            {includesTracksuit && (
              <div>
                <label htmlFor="offer-tracksuit-size" className={labelClass}>Tracksuit Size <span className="text-red-500">*</span></label>
                <div className="mt-1">
                  <BrandListbox
                    id="offer-tracksuit-size"
                    ariaLabel="Tracksuit size"
                    value={tracksuitSize}
                    onChange={setTracksuitSize}
                    placeholder="Select..."
                    options={CLOTHING_SIZES}
                  />
                </div>
              </div>
            )}
            {includesShoes && (
              <div>
                <label htmlFor="offer-shoe-size" className={labelClass}>Shoe Size <span className="text-red-500">*</span></label>
                <div className="mt-1">
                  <BrandListbox
                    id="offer-shoe-size"
                    ariaLabel="Shoe size"
                    value={shoeSize}
                    onChange={setShoeSize}
                    placeholder="Select..."
                    options={SHOE_SIZES.map((s) => ({ value: s, label: s }))}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-ink-800 mb-2 block text-sm font-medium">
            Jersey Number Preferences <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[[jerseyPref1, setJerseyPref1, "1st"], [jerseyPref2, setJerseyPref2, "2nd"], [jerseyPref3, setJerseyPref3, "3rd"]].map(
              ([val, set, lbl]: any) => (
                <div key={lbl}>
                  <label className="text-ink-500 mb-1 block text-xs">{lbl} Choice</label>
                  <input type="number" min="0" max="99" value={val} onChange={(e) => set(e.target.value)} placeholder="#"
                    className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 block w-full rounded-xl border px-3 py-2 text-center text-sm shadow-sm focus:outline-none focus:ring-2" />
                </div>
              )
            )}
          </div>
        </div>

        {/* Payment (payments v2). Only when the club takes online money + a fee. */}
        {online && fee > 0 && (
          <div className="border-ink-100 rounded-xl border bg-white p-3">
            <p className="text-ink-800 text-sm font-semibold">Payment</p>
            {canPlan && (
              <ChoiceCardGroup
                ariaLabel="Payment plan"
                className="mt-2"
                value={plan}
                onChange={(v) => setPlan(v as "FULL" | "INSTALLMENTS")}
                options={[
                  {
                    value: "FULL",
                    title: "Pay in full",
                    description: (
                      <>
                        <strong className="text-ink-900">{money(fee, currency)}</strong> now
                      </>
                    ),
                  },
                  {
                    value: "INSTALLMENTS",
                    title: "Payment plan",
                    description: (
                      <>
                        <strong className="text-ink-900">{money(terms!.depositAmount ?? 0, currency)}</strong> deposit now, then{" "}
                        {terms!.installmentTerms.map((t, i) => (
                          <span key={t.sequence}>
                            {i > 0 ? ", " : ""}{money(t.amount)} on {new Date(t.dueDate).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                          </span>
                        ))}
                        <span className="text-ink-400 mt-0.5 block text-xs">Auto-charged to your card on file.</span>
                      </>
                    ),
                  },
                ]}
              />
            )}

            <div className="mt-3">
              {hasSavedCards && !useNewCard ? (
                <div className="space-y-2">
                  <ChoiceCardGroup
                    ariaLabel="Card to charge"
                    value={selectedCardId}
                    onChange={setSelectedCardId}
                    options={payInfo!.savedCards.map((c) => ({
                      value: c.id,
                      title: `${c.brand} •••• ${c.last4}`,
                      badge: c.isDefault ? "Default" : undefined,
                    }))}
                  />
                  <button type="button" onClick={() => setUseNewCard(true)} className="text-play-600 text-xs font-semibold hover:underline">
                    Use a different card
                  </button>
                </div>
              ) : (
                <p className="text-ink-500 text-xs">
                  {hasSavedCards ? "You'll enter a new card next." : "You'll add a card to complete — it's saved securely by Stripe for future payments."}
                  {hasSavedCards && (
                    <button type="button" onClick={() => setUseNewCard(false)} className="text-play-600 ml-2 font-semibold hover:underline">
                      Use a saved card
                    </button>
                  )}
                </p>
              )}
            </div>
            <p className="text-ink-500 mt-2 text-xs">
              Due now: <strong>{money(amountDue, currency)}</strong>
            </p>
          </div>
        )}
        {payInfo && !online && fee > 0 && (
          <p className="text-ink-500 rounded-xl bg-ink-50 px-3 py-2 text-xs">
            This club collects payment offline — heads up: your spot is not held until payment is made. The club will arrange your {money(fee, currency)} fee; paying is what commits your place.
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={isSubmitting} className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50">
            {isSubmitting ? "Processing…" : needsPayment && !willEnterNewCard ? `Pay ${money(amountDue, currency)} & Accept` : needsPayment ? "Add card & Accept" : "Confirm & Accept"}
          </button>
          <button type="button" onClick={onCancel} className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-4 py-2.5 text-sm font-medium transition">
            Cancel
          </button>
        </div>
      </form>

      {cardStep && publishableKey && (
        <NewCardModal
          clientSecret={cardStep.clientSecret}
          amountLabel={money(amountDue, currency)}
          onCancel={() => setCardStep(null)}
          onPaid={async (pi) => {
            setCardStep(null)
            setIsSubmitting(true)
            try {
              await doAccept(pi)
            } catch (err) {
              setError(err instanceof Error ? err.message : "Accepted payment but couldn't finish — refresh.")
            } finally {
              setIsSubmitting(false)
            }
          }}
        />
      )}
    </div>
  )
}

function NewCardModal({
  clientSecret,
  amountLabel,
  onPaid,
  onCancel,
}: {
  clientSecret: string
  amountLabel: string
  onPaid: (paymentIntentId: string) => void
  onCancel: () => void
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey!), [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-ink-900 text-lg font-semibold">Pay {amountLabel}</h3>
        <p className="text-ink-500 mt-1 text-xs">Your card is saved securely by Stripe for future payments.</p>
        <div className="mt-4">
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <NewCardForm onPaid={onPaid} onCancel={onCancel} />
          </Elements>
        </div>
      </div>
    </div>
  )
}

function NewCardForm({ onPaid, onCancel }: { onPaid: (pi: string) => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pay() {
    if (!stripe || !elements) return
    setPaying(true)
    setError(null)
    const { error: err, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" })
    setPaying(false)
    if (err) return setError(err.message || "Payment failed")
    if (paymentIntent?.status === "succeeded") onPaid(paymentIntent.id)
    else setError("Payment didn't complete — try again.")
  }

  return (
    <div>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} disabled={paying} className="border-ink-200 text-ink-600 hover:bg-ink-50 rounded-xl border px-4 py-2 text-sm">Cancel</button>
        <button onClick={pay} disabled={paying} className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {paying ? "Paying…" : "Pay & Accept"}
        </button>
      </div>
    </div>
  )
}
