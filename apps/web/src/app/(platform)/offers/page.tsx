"use client"

import Link from "next/link"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Badge, Button, Card, toneForStatus } from "@/components/ui"
import { OfferResponseForm } from "./offer-response-form"
import { formatCurrency } from "@/lib/countries"

interface OfferPackage {
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

interface Offer {
  id: string
  status: string
  seasonFee: number
  options?: OfferPackage[]
  chosenOptionId?: string | null
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
      <Card className="reveal sm:p-8">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          Offers
        </div>
        <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">
          My offers
        </h1>
        <p className="text-ink-500 mt-1 text-sm">Team offers for your players</p>
      </Card>

      {offers.length === 0 ? (
        <div className="reveal border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
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
              <h2 className="font-condensed text-ink-950 mb-3 flex items-center gap-2.5 text-xl font-bold uppercase tracking-wide">
                <span className="bg-gold-400 h-5 w-1.5 shrink-0 rounded-full" aria-hidden />
                Pending ({pendingOffers.length})
              </h2>
              <div className="space-y-4">
                {pendingOffers.map((offer, index) => {
                  const isExpired = new Date(offer.expiresAt) < new Date()

                  return (
                    <div
                      key={offer.id}
                      style={{ animationDelay: `${index * 70}ms` }}
                      className="reveal border-play-200 shadow-soft rounded-2xl border bg-white p-6"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-ink-950 text-lg font-semibold">
                            {offer.team.tenant.name}
                          </h3>
                          <p className="text-ink-600 text-sm">
                            <Link href={`/team/${offer.team.id}`} className="hover:text-play-600 font-medium transition-colors">
                              {offer.team.name}
                            </Link>{" "}
                            &middot; {offer.team.ageGroup}
                            {offer.team.gender ? ` · ${offer.team.gender}` : ""}
                          </p>
                          <p className="text-ink-500 mt-1 text-sm">
                            For{" "}
                            <strong>
                              {offer.player.firstName} {offer.player.lastName}
                            </strong>
                          </p>
                        </div>
                        <div className="text-right">
                          {(offer.options?.length ?? 0) > 1 && !offer.chosenOptionId ? (
                            <>
                              <div className="font-condensed text-ink-950 text-2xl font-bold">
                                from{" "}
                                {formatCurrency(
                                  Math.min(...offer.options!.map((o) => o.seasonFee)),
                                  offer.team.tenant.currency
                                )}
                              </div>
                              <div className="text-play-700 text-xs font-semibold">
                                {offer.options!.length} package options
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-condensed text-ink-950 text-2xl font-bold">
                                {formatCurrency(offer.seasonFee, offer.team.tenant.currency)}
                              </div>
                              {offer.chosenOptionId &&
                                (() => {
                                  const chosenLabel = offer.options?.find(
                                    (o) => o.id === offer.chosenOptionId
                                  )?.label
                                  return chosenLabel ? (
                                    <div className="text-play-700 text-xs font-semibold">
                                      {chosenLabel}
                                    </div>
                                  ) : null
                                })()}
                              {offer.installments > 1 && (
                                <div className="text-ink-500 text-xs">
                                  {offer.installments} installments
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* What's included */}
                      {(offer.options?.length ?? 0) > 1 && !offer.chosenOptionId ? (
                        <div className="border-play-200 bg-play-50 mt-3 rounded-xl border p-3">
                          <div className="text-play-700 mb-1 text-xs font-medium">
                            Your package choices:
                          </div>
                          <div className="space-y-1">
                            {offer.options!.map((option) => {
                              const optionItems = [
                                option.includesUniform && "Uniform",
                                option.includesTracksuit && "Tracksuit",
                                option.includesShoes && "Shoes",
                                option.includesBall && "Basketball",
                                option.includesBag && "Bag",
                              ].filter(Boolean)
                              return (
                                <div key={option.id} className="text-ink-700 text-xs">
                                  <span className="font-semibold">{option.label}</span> —{" "}
                                  {formatCurrency(option.seasonFee, offer.team.tenant.currency)}
                                  {optionItems.length > 0
                                    ? ` · ${optionItems.join(", ")}`
                                    : " · no gear"}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (() => {
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
                        <div className="bg-ink-50 text-ink-700 mt-3 rounded-xl p-3 text-sm italic">
                          &ldquo;{offer.message}&rdquo;
                        </div>
                      )}

                      <div className="text-ink-500 mt-3 flex items-center justify-between text-xs">
                        <span>Received {format(new Date(offer.createdAt), "MMM d, yyyy")}</span>
                        {isExpired ? (
                          <Badge tone={toneForStatus("EXPIRED")}>Expired</Badge>
                        ) : (
                          <span>{`Expires ${format(new Date(offer.expiresAt), "MMM d, yyyy")}`}</span>
                        )}
                      </div>

                      {!isExpired && respondingTo !== offer.id && (
                        <div className="mt-4 flex gap-3">
                          <Button
                            tone="court"
                            className="flex-1"
                            onClick={() => setRespondingTo(offer.id)}
                          >
                            Accept Offer
                          </Button>
                          <Button
                            variant="secondary"
                            tone="hoop"
                            className="flex-1"
                            onClick={() => setRespondingTo(offer.id + "-decline")}
                          >
                            Decline
                          </Button>
                        </div>
                      )}

                      {respondingTo === offer.id && (
                        <OfferResponseForm
                          offerId={offer.id}
                          includesUniform={offer.includesUniform}
                          includesShoes={offer.includesShoes}
                          includesTracksuit={offer.includesTracksuit}
                          options={offer.options ?? []}
                          currency={offer.team.tenant.currency}
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
              <h2 className="font-condensed text-ink-950 mb-3 flex items-center gap-2.5 text-xl font-bold uppercase tracking-wide">
                <span className="bg-ink-300 h-5 w-1.5 shrink-0 rounded-full" aria-hidden />
                Past Offers ({respondedOffers.length})
              </h2>
              <div className="space-y-3">
                {respondedOffers.map((offer, index) => {
                  const statusColors: Record<string, string> = {
                    ACCEPTED: "border-court-200 bg-court-50",
                    DECLINED: "border-hoop-200 bg-hoop-50",
                    EXPIRED: "border-ink-200 bg-ink-50",
                    RESCINDED: "border-ink-200 bg-ink-50",
                  }
                  const statusLabel =
                    offer.status === "RESCINDED" ? "withdrawn by club" : offer.status.toLowerCase()

                  return (
                    <div
                      key={offer.id}
                      style={{ animationDelay: `${index * 60}ms` }}
                      className={`reveal rounded-xl border p-4 ${statusColors[offer.status] || "border-ink-200"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-ink-900 font-medium">
                            {offer.team.tenant.name} -{" "}
                            <Link href={`/team/${offer.team.id}`} className="hover:text-play-600 transition-colors">
                              {offer.team.name}
                            </Link>
                          </span>
                          <span className="text-ink-500 ml-2 text-sm">
                            for {offer.player.firstName} {offer.player.lastName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={toneForStatus(offer.status)}>{statusLabel}</Badge>
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
    <div className="border-hoop-200 bg-hoop-50 mt-4 rounded-xl border p-4">
      <p className="text-hoop-700 mb-3 text-sm">
        Are you sure you want to decline this offer? This cannot be undone.
      </p>
      <div className="flex gap-3">
        <Button tone="hoop" size="sm" disabled={isSubmitting} onClick={handleDecline}>
          {isSubmitting ? "Declining..." : "Confirm Decline"}
        </Button>
        <Button variant="subtle" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
