"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge, Button, PanelHeader, SmartBack, type BadgeTone } from "@/components/ui"

type ConsentScope = "PLATFORM" | "TENANT" | "LEAGUE"
type ConsentStatus = "IMPLIED" | "EXPRESS" | "WITHDRAWN"

interface ConsentRow {
  id: string
  scope: ConsentScope
  orgId: string | null
  orgName: string | null
  status: ConsentStatus
}

const STATUS_LABEL: Record<ConsentStatus, string> = {
  EXPRESS: "Subscribed",
  IMPLIED: "Auto (recent activity)",
  WITHDRAWN: "Unsubscribed",
}

const STATUS_TONE: Record<ConsentStatus, BadgeTone> = {
  EXPRESS: "success",
  IMPLIED: "play",
  WITHDRAWN: "neutral",
}

/** WITHDRAWN (or no row at all) means the next action is a re-subscribe. */
function isSubscribed(status: ConsentStatus | undefined): boolean {
  return status === "EXPRESS" || status === "IMPLIED"
}

export default function CommunicationsPreferencesPage() {
  const [consents, setConsents] = useState<ConsentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const loadConsents = useCallback(async () => {
    const res = await fetch("/api/comms/preferences")
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "Failed to load preferences")
    }
    const data = await res.json()
    setConsents(data.consents || [])
  }, [])

  useEffect(() => {
    loadConsents()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load preferences"))
      .finally(() => setIsLoading(false))
  }, [loadConsents])

  const toggle = async (scope: ConsentScope, orgId: string | null, subscribed: boolean) => {
    const key = `${scope}:${orgId ?? "platform"}`
    setPendingKey(key)
    setError(null)

    // Optimistic flip — reconciled by the refetch below.
    const nextStatus: ConsentStatus = subscribed ? "WITHDRAWN" : "EXPRESS"
    setConsents((prev) => {
      const existing = prev.find((c) => c.scope === scope && c.orgId === orgId)
      if (!existing) {
        return [
          ...prev,
          { id: key, scope, orgId, orgName: null, status: nextStatus },
        ]
      }
      return prev.map((c) =>
        c.scope === scope && c.orgId === orgId ? { ...c, status: nextStatus } : c
      )
    })

    try {
      const res = await fetch("/api/comms/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, orgId, action: subscribed ? "withdraw" : "grant" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update preference")
      }
      await loadConsents()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update preference")
      // Roll back to the server's truth.
      await loadConsents().catch(() => {})
    } finally {
      setPendingKey(null)
    }
  }

  const platformConsent = consents.find((c) => c.scope === "PLATFORM")
  const platformSubscribed = isSubscribed(platformConsent?.status)
  const orgConsents = consents.filter((c) => c.scope !== "PLATFORM")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-ink-500">Loading preferences...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl p-6 md:p-8">
      <div className="border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]">
        <h1 className="text-ink-900 mb-2 text-2xl font-semibold">Email preferences</h1>
        <p className="text-ink-700 mb-6 text-sm">
          Transactional email — receipts, offers, and schedule changes — always sends.
          Marketing and news email is opt-out per organization below.
        </p>

        {error && (
          <div className="border-hoop-200 text-hoop-700 mb-4 rounded-lg border bg-red-50 p-3 text-sm">
            {error}
          </div>
        )}

        <section className="mb-8">
          <PanelHeader title="Platform" />
          <div className="border-ink-100 flex items-center justify-between gap-4 rounded-2xl border p-4">
            <div className="min-w-0">
              <p className="text-ink-900 text-sm font-semibold">
                News &amp; product updates from SportsHub
              </p>
              <div className="mt-1.5">
                <Badge tone={platformConsent ? STATUS_TONE[platformConsent.status] : "neutral"}>
                  {platformConsent ? STATUS_LABEL[platformConsent.status] : "Unsubscribed"}
                </Badge>
              </div>
            </div>
            <Button
              variant={platformSubscribed ? "subtle" : "secondary"}
              tone="court"
              size="sm"
              disabled={pendingKey === "PLATFORM:platform"}
              onClick={() => toggle("PLATFORM", null, platformSubscribed)}
            >
              {pendingKey === "PLATFORM:platform"
                ? "Saving..."
                : platformSubscribed
                  ? "Unsubscribe"
                  : "Subscribe"}
            </Button>
          </div>
        </section>

        <section>
          <PanelHeader title="Clubs & leagues" />
          {orgConsents.length === 0 ? (
            <div className="border-ink-100 text-ink-500 rounded-2xl border border-dashed p-6 text-center text-sm">
              Organizations you register with will appear here.
            </div>
          ) : (
            <ul className="space-y-3">
              {orgConsents.map((c) => {
                const key = `${c.scope}:${c.orgId ?? "platform"}`
                const subscribed = isSubscribed(c.status)
                return (
                  <li
                    key={key}
                    className="border-ink-100 flex items-center justify-between gap-4 rounded-2xl border p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-ink-900 truncate text-sm font-semibold">
                        {c.orgName || (c.scope === "LEAGUE" ? "League" : "Club")}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                        <span className="text-ink-400 text-xs uppercase tracking-wide">
                          {c.scope === "LEAGUE" ? "League" : "Club"}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant={subscribed ? "subtle" : "secondary"}
                      tone="court"
                      size="sm"
                      disabled={pendingKey === key}
                      onClick={() => toggle(c.scope, c.orgId, subscribed)}
                    >
                      {pendingKey === key
                        ? "Saving..."
                        : subscribed
                          ? "Unsubscribe"
                          : "Re-subscribe"}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="border-ink-100 mt-8 border-t pt-4">
          <SmartBack fallback="/settings/profile" fallbackLabel="Profile" className="-ml-1" />
        </div>
      </div>
    </div>
  )
}
