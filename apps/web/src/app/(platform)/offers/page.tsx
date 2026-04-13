"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { OfferResponseForm } from "./offer-response-form"
import { formatCurrency } from "@/lib/countries"

interface Offer {
  id: string
  status: string
  seasonFee: number
  installments: number
  practiceSessions: number
  includesBall: boolean
  includesBag: boolean
  includesShoes: boolean
  includesUniform: boolean
  includesTracksuit: boolean
  message: string | null
  expiresAt: string
  uniformSize: string | null
  shoeSize: string | null
  tracksuitSize: string | null
  jerseyPref1: number | null
  jerseyPref2: number | null
  jerseyPref3: number | null
  respondedAt: string | null
  createdAt: string
  team: {
    id: string
    name: string
    ageGroup: string
    gender: string | null
    tenant: { name: string; currency: string }
  }
  player: {
    id: string
    firstName: string
    lastName: string
  }
}

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)

  const fetchOffers = async () => {
    try {
      const res = await fetch("/api/offers?mine=true")
      if (res.ok) {
        const data = await res.json()
        setOffers(data.offers)
      }
    } catch (err) {
      console.error("Failed to fetch offers:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOffers()
  }, [])

  const handleResponse = () => {
    setRespondingTo(null)
    fetchOffers()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-ink-500">Loading offers...</div>
      </div>
    )
  }

  const pendingOffers = offers.filter((o) => o.status === "PENDING")
  const respondedOffers = offers.filter((o) => o.status !== "PENDING")

  return (
    <div className="space-y-6">
      <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6 sm:p-8">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          Offers
        </div>
        <h1 className="font-display text-ink-950 text-3xl font-bold">My offers</h1>
        <p className="text-ink-500 mt-1 text-sm">Team offers for your players</p>
      </div>

      {offers.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="font-display text-ink-950 mb-2 text-lg font-semibold">No offers yet</h3>
          <p className="text-ink-600">
            When a club sends an offer for one of your players, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending offers */}
          {pendingOffers.length > 0 && (
            <div>
              <h2 className="font-display text-ink-950 mb-3 text-lg font-semibold">
                Pending ({pendingOffers.length})
              </h2>
              <div className="space-y-4">
                {pendingOffers.map((offer) => {
                  const isExpired = new Date(offer.expiresAt) < new Date()

                  return (
                    <div
                      key={offer.id}
                      className="border-play-200 shadow-soft rounded-2xl border bg-white p-6"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-ink-950 text-lg font-semibold">
                            {offer.team.tenant.name}
                          </h3>
                          <p className="text-ink-600 text-sm">
                            {offer.team.name} &middot; {offer.team.ageGroup}
                            {offer.team.gender ? ` &middot; ${offer.team.gender}` : ""}
                          </p>
                          <p className="text-ink-500 mt-1 text-sm">
                            For{" "}
                            <strong>
                              {offer.player.firstName} {offer.player.lastName}
                            </strong>
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-ink-900 text-lg font-bold">
                            {formatCurrency(offer.seasonFee, offer.team.tenant.currency)}
                          </div>
                          {offer.installments > 1 && (
                            <div className="text-ink-500 text-xs">
                              {offer.installments} installments
                            </div>
                          )}
                        </div>
                      </div>

                      {/* What's included */}
                      {(() => {
                        const items = [
                          offer.includesUniform && "Uniform (Shirt + Shorts)",
                          offer.includesTracksuit && "Tracksuit",
                          offer.includesShoes && "Shoes",
                          offer.includesBall && "Basketball",
                          offer.includesBag && "Bag",
                        ].filter(Boolean)
                        return items.length > 0 || offer.practiceSessions > 0 ? (
                          <div className="border-play-200 bg-play-50 mt-3 rounded-xl border p-3">
                            <div className="text-play-700 mb-1 text-xs font-medium">
                              What&apos;s included:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {offer.practiceSessions > 0 && (
                                <span className="bg-play-100 text-play-700 rounded-full px-2 py-0.5 text-xs">
                                  {offer.practiceSessions} practice sessions
                                </span>
                              )}
                              {items.map((item) => (
                                <span
                                  key={item as string}
                                  className="bg-play-100 text-play-700 rounded-full px-2 py-0.5 text-xs"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null
                      })()}

                      {offer.message && (
                        <div className="bg-ink-50 text-ink-700 mt-3 rounded-md p-3 text-sm italic">
                          &ldquo;{offer.message}&rdquo;
                        </div>
                      )}

                      <div className="text-ink-500 mt-3 flex items-center justify-between text-xs">
                        <span>Received {format(new Date(offer.createdAt), "MMM d, yyyy")}</span>
                        <span className={isExpired ? "text-hoop-700 font-medium" : ""}>
                          {isExpired
                            ? "Expired"
                            : `Expires ${format(new Date(offer.expiresAt), "MMM d, yyyy")}`}
                        </span>
                      </div>

                      {!isExpired && respondingTo !== offer.id && (
                        <div className="mt-4 flex gap-3">
                          <button
                            onClick={() => setRespondingTo(offer.id)}
                            className="bg-court-600 hover:bg-court-700 flex-1 rounded-md px-4 py-2 text-sm font-semibold text-white"
                          >
                            Accept Offer
                          </button>
                          <button
                            onClick={() => setRespondingTo(offer.id + "-decline")}
                            className="border-hoop-300 text-hoop-700 hover:bg-hoop-50 flex-1 rounded-md border px-4 py-2 text-sm font-semibold"
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {respondingTo === offer.id && (
                        <OfferResponseForm
                          offerId={offer.id}
                          includesUniform={offer.includesUniform}
                          includesShoes={offer.includesShoes}
                          includesTracksuit={offer.includesTracksuit}
                          onDone={handleResponse}
                          onCancel={() => setRespondingTo(null)}
                        />
                      )}

                      {respondingTo === offer.id + "-decline" && (
                        <DeclineConfirm
                          offerId={offer.id}
                          onDone={handleResponse}
                          onCancel={() => setRespondingTo(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Past offers */}
          {respondedOffers.length > 0 && (
            <div>
              <h2 className="font-display text-ink-950 mb-3 text-lg font-semibold">
                Past Offers ({respondedOffers.length})
              </h2>
              <div className="space-y-3">
                {respondedOffers.map((offer) => {
                  const statusColors: Record<string, string> = {
                    ACCEPTED: "border-court-200 bg-court-50",
                    DECLINED: "border-hoop-200 bg-hoop-50",
                    EXPIRED: "border-ink-200 bg-ink-50",
                  }
                  const badgeColors: Record<string, string> = {
                    ACCEPTED: "bg-court-100 text-court-700",
                    DECLINED: "bg-hoop-100 text-hoop-700",
                    EXPIRED: "bg-ink-100 text-ink-600",
                  }

                  return (
                    <div
                      key={offer.id}
                      className={`rounded-xl border p-4 ${statusColors[offer.status] || "border-ink-200"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-ink-900 font-medium">
                            {offer.team.tenant.name} - {offer.team.name}
                          </span>
                          <span className="text-ink-500 ml-2 text-sm">
                            for {offer.player.firstName} {offer.player.lastName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeColors[offer.status]}`}
                          >
                            {offer.status.toLowerCase()}
                          </span>
                          {offer.respondedAt && (
                            <span className="text-ink-400 text-xs">
                              {format(new Date(offer.respondedAt), "MMM d")}
                            </span>
                          )}
                        </div>
                      </div>
                      {offer.status === "ACCEPTED" && (
                        <div className="text-ink-600 mt-2 text-xs">
                          {offer.uniformSize ? `Uniform: ${offer.uniformSize}` : ""}
                          {offer.tracksuitSize ? ` | Tracksuit: ${offer.tracksuitSize}` : ""}
                          {offer.shoeSize ? ` | Shoes: ${offer.shoeSize}` : ""}
                          {offer.jerseyPref1 !== null
                            ? ` | Jersey prefs: #${offer.jerseyPref1}`
                            : ""}
                          {offer.jerseyPref2 !== null ? `, #${offer.jerseyPref2}` : ""}
                          {offer.jerseyPref3 !== null ? `, #${offer.jerseyPref3}` : ""}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeclineConfirm({
  offerId,
  onDone,
  onCancel,
}: {
  offerId: string
  onDone: () => void
  onCancel: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleDecline = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to decline offer")
        return
      }
      onDone()
    } catch {
      alert("An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="border-hoop-200 bg-hoop-50 mt-4 rounded-md border p-4">
      <p className="text-hoop-700 mb-3 text-sm">
        Are you sure you want to decline this offer? This cannot be undone.
      </p>
      <div className="flex gap-3">
        <button
          onClick={handleDecline}
          disabled={isSubmitting}
          className="bg-hoop-600 hover:bg-hoop-700 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? "Declining..." : "Confirm Decline"}
        </button>
        <button
          onClick={onCancel}
          className="border-ink-300 text-ink-700 hover:bg-ink-50 rounded-md border px-4 py-2 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
