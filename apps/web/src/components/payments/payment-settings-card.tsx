"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Club payment settings (admin only): offline methods, online mode within the
 * platform allowlist, and the Stripe Connect onboarding button. When policy
 * leaves the club no choice (mode forced, offline banned) the UI says so
 * instead of offering dead options.
 */

export interface PaymentConfigView {
  offlineAllowed: boolean
  connectAllowed: boolean
  platformCollectAllowed: boolean
  offlineEnabled: boolean
  offlineMethods: string[]
  onlineMode: "NONE" | "CONNECT_DIRECT" | "PLATFORM_COLLECT"
  chosenOnlineMode: "NONE" | "CONNECT_DIRECT" | "PLATFORM_COLLECT" | null
  stripeAccountId: string | null
  stripeAccountStatus: string | null
}

const OFFLINE_METHODS = [
  { value: "CASH", label: "Cash (pay at the door)" },
  { value: "ETRANSFER", label: "e-Transfer" },
  { value: "CHEQUE", label: "Cheque" },
]

export function PaymentSettingsCard({
  tenantId,
  config,
  basePath,
}: {
  tenantId: string
  config: PaymentConfigView
  /** API base — defaults to the club path; leagues pass their own. */
  basePath?: string
}) {
  const apiBase = basePath ?? `/api/clubs/${tenantId}`
  const router = useRouter()
  const [offlineEnabled, setOfflineEnabled] = useState(config.offlineEnabled)
  const [methods, setMethods] = useState<string[]>(config.offlineMethods)
  const [onlineMode, setOnlineMode] = useState(config.onlineMode)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    setMessage(null)
    const res = await fetch(`${apiBase}/payment-config`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ offlineEnabled, offlineMethods: methods, onlineMode }),
    })
    setSaving(false)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body.error || "Failed to save settings")
      return
    }
    setMessage("Settings saved")
    router.refresh()
  }

  async function connect() {
    setConnecting(true)
    setError(null)
    const res = await fetch(`${apiBase}/payment-config/connect`, { method: "POST" })
    const body = await res.json().catch(() => ({}))
    setConnecting(false)
    if (!res.ok) {
      setError(body.error || "Couldn't start Stripe onboarding")
      return
    }
    window.location.href = body.url
  }

  const connectActive = config.stripeAccountStatus === "active"
  const anyOnlineAllowed = config.connectAllowed || config.platformCollectAllowed
  // Exactly one online mode allowed + offline banned = the club has no choice
  const onlyMode =
    config.connectAllowed && !config.platformCollectAllowed
      ? "CONNECT_DIRECT"
      : !config.connectAllowed && config.platformCollectAllowed
        ? "PLATFORM_COLLECT"
        : null

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5">
      <h3 className="text-base font-semibold text-ink-900">Payment settings</h3>
      {error && (
        <div className="mt-3 rounded-md bg-hoop-50 px-3 py-2 text-sm text-hoop-700">{error}</div>
      )}
      {message && (
        <div className="mt-3 rounded-md bg-court-50 px-3 py-2 text-sm text-court-700">{message}</div>
      )}

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-medium text-ink-700">Offline payments</h4>
          {config.offlineAllowed ? (
            <>
              <p className="mt-0.5 text-xs text-ink-500">
                Families pay you directly; you record it on the payment.
              </p>
              <label className="mt-3 flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={offlineEnabled}
                  onChange={(e) => setOfflineEnabled(e.target.checked)}
                />
                Accept offline payments
              </label>
              <div className="mt-2 space-y-1.5 pl-6">
                {OFFLINE_METHODS.map((m) => (
                  <label key={m.value} className="flex items-center gap-2 text-sm text-ink-600">
                    <input
                      type="checkbox"
                      disabled={!offlineEnabled}
                      checked={methods.includes(m.value)}
                      onChange={(e) =>
                        setMethods((prev) =>
                          e.target.checked ? [...prev, m.value] : prev.filter((x) => x !== m.value)
                        )
                      }
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 rounded-md bg-ink-50 p-3 text-sm text-ink-600">
              Offline payments are turned off by the platform — all payments to your club are made
              online.
            </p>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium text-ink-700">Online payments</h4>
          <p className="mt-0.5 text-xs text-ink-500">
            Card payments through the platform. Your share arrives in your Stripe account either
            way.
          </p>
          {!anyOnlineAllowed ? (
            <p className="mt-3 rounded-md bg-ink-50 p-3 text-sm text-ink-600">
              Online payments are not enabled for your club. Contact the platform to turn them on.
            </p>
          ) : (
            <select
              value={onlineMode}
              onChange={(e) => setOnlineMode(e.target.value as PaymentConfigView["onlineMode"])}
              className="mt-3 w-full rounded-md border border-ink-200 px-3 py-2 text-sm"
            >
              {config.offlineAllowed && <option value="NONE">Off — offline only</option>}
              {!config.offlineAllowed && onlineMode === "NONE" && (
                <option value="NONE" disabled>
                  Choose an online mode…
                </option>
              )}
              {config.connectAllowed && (
                <option value="CONNECT_DIRECT">Your own Stripe account</option>
              )}
              {config.platformCollectAllowed && (
                <option value="PLATFORM_COLLECT">
                  Through the platform — your share transfers to you instantly
                </option>
              )}
            </select>
          )}
          {onlyMode && !config.offlineAllowed && (
            <p className="mt-1 text-xs text-ink-500">
              This is the payment mode set by the platform for your club.
            </p>
          )}

          {onlineMode !== "NONE" && anyOnlineAllowed && (
            <div className="mt-3 rounded-md bg-ink-50 p-3 text-sm">
              {connectActive ? (
                <p className="text-court-700">
                  ✓ Stripe account connected —{" "}
                  {onlineMode === "CONNECT_DIRECT"
                    ? "payments go straight to your bank."
                    : "your share of each payment transfers to your bank automatically."}
                </p>
              ) : config.stripeAccountId ? (
                <>
                  <p className="text-ink-600">
                    Stripe setup started but not finished — payments can&apos;t be accepted yet.
                  </p>
                  <button
                    onClick={connect}
                    disabled={connecting}
                    className="mt-2 rounded-md bg-play-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-play-700 disabled:opacity-50"
                  >
                    {connecting ? "Opening Stripe…" : "Finish Stripe setup"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-ink-600">
                    {onlineMode === "CONNECT_DIRECT"
                      ? "Connect your Stripe account so card payments land directly in your bank."
                      : "Set up your Stripe account so the platform can transfer your share of each payment to your bank."}
                  </p>
                  <button
                    onClick={connect}
                    disabled={connecting}
                    className="mt-2 rounded-md bg-play-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-play-700 disabled:opacity-50"
                  >
                    {connecting ? "Opening Stripe…" : "Connect with Stripe"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  )
}
