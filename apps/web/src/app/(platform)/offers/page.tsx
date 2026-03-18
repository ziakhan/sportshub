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
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading offers...</div>
      </div>
    )
  }

  const pendingOffers = offers.filter((o) => o.status === "PENDING")
  const respondedOffers = offers.filter((o) => o.status !== "PENDING")

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Offers</h1>
        <p className="text-sm text-gray-500 mt-1">
          Team offers for your players
        </p>
      </div>

      {offers.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No offers yet</h3>
          <p className="text-gray-600">
            When a club sends an offer for one of your players, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending offers */}
          {pendingOffers.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Pending ({pendingOffers.length})
              </h2>
              <div className="space-y-4">
                {pendingOffers.map((offer) => {
                  const isExpired = new Date(offer.expiresAt) < new Date()

                  return (
                    <div
                      key={offer.id}
                      className="rounded-lg border border-blue-200 bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {offer.team.tenant.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {offer.team.name} &middot; {offer.team.ageGroup}
                            {offer.team.gender ? ` &middot; ${offer.team.gender}` : ""}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            For <strong>{offer.player.firstName} {offer.player.lastName}</strong>
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            {formatCurrency(offer.seasonFee, offer.team.tenant.currency)}
                          </div>
                          {offer.installments > 1 && (
                            <div className="text-xs text-gray-500">
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
                        return (items.length > 0 || offer.practiceSessions > 0) ? (
                          <div className="mt-3 rounded-md bg-blue-50 p-3">
                            <div className="text-xs font-medium text-blue-700 mb-1">What&apos;s included:</div>
                            <div className="flex flex-wrap gap-1.5">
                              {offer.practiceSessions > 0 && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                  {offer.practiceSessions} practice sessions
                                </span>
                              )}
                              {items.map((item) => (
                                <span key={item as string} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null
                      })()}

                      {offer.message && (
                        <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm text-gray-700 italic">
                          &ldquo;{offer.message}&rdquo;
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                        <span>Received {format(new Date(offer.createdAt), "MMM d, yyyy")}</span>
                        <span className={isExpired ? "text-red-600 font-medium" : ""}>
                          {isExpired
                            ? "Expired"
                            : `Expires ${format(new Date(offer.expiresAt), "MMM d, yyyy")}`}
                        </span>
                      </div>

                      {!isExpired && respondingTo !== offer.id && (
                        <div className="mt-4 flex gap-3">
                          <button
                            onClick={() => setRespondingTo(offer.id)}
                            className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                          >
                            Accept Offer
                          </button>
                          <button
                            onClick={() => setRespondingTo(offer.id + "-decline")}
                            className="flex-1 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
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
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Past Offers ({respondedOffers.length})
              </h2>
              <div className="space-y-3">
                {respondedOffers.map((offer) => {
                  const statusColors: Record<string, string> = {
                    ACCEPTED: "border-green-200 bg-green-50",
                    DECLINED: "border-red-200 bg-red-50",
                    EXPIRED: "border-gray-200 bg-gray-50",
                  }
                  const badgeColors: Record<string, string> = {
                    ACCEPTED: "bg-green-100 text-green-700",
                    DECLINED: "bg-red-100 text-red-700",
                    EXPIRED: "bg-gray-100 text-gray-600",
                  }

                  return (
                    <div
                      key={offer.id}
                      className={`rounded-lg border p-4 ${statusColors[offer.status] || "border-gray-200"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900">
                            {offer.team.tenant.name} - {offer.team.name}
                          </span>
                          <span className="ml-2 text-sm text-gray-500">
                            for {offer.player.firstName} {offer.player.lastName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeColors[offer.status]}`}>
                            {offer.status.toLowerCase()}
                          </span>
                          {offer.respondedAt && (
                            <span className="text-xs text-gray-400">
                              {format(new Date(offer.respondedAt), "MMM d")}
                            </span>
                          )}
                        </div>
                      </div>
                      {offer.status === "ACCEPTED" && (
                        <div className="mt-2 text-xs text-gray-600">
                          {offer.uniformSize ? `Uniform: ${offer.uniformSize}` : ""}
                          {offer.tracksuitSize ? ` | Tracksuit: ${offer.tracksuitSize}` : ""}
                          {offer.shoeSize ? ` | Shoes: ${offer.shoeSize}` : ""}
                          {offer.jerseyPref1 !== null ? ` | Jersey prefs: #${offer.jerseyPref1}` : ""}
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
    <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-700 mb-3">
        Are you sure you want to decline this offer? This cannot be undone.
      </p>
      <div className="flex gap-3">
        <button
          onClick={handleDecline}
          disabled={isSubmitting}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isSubmitting ? "Declining..." : "Confirm Decline"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
