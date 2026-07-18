"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Badge, Button } from "@/components/ui"

/**
 * Anonymous claim wizard (owner 2026-07-18 settled flow):
 *   1. pick a verification channel (code goes to the club's contact ON FILE)
 *   2. optional claim-time corrections
 *   3. enter the code → completion link (register/sign in to take ownership)
 * No contact on file → paper-proof note + your email → admin review.
 */

type Step = "options" | "code" | "verified" | "proof-sent"

export function ClaimWizard({ tenantId }: { tenantId: string }) {
  const [options, setOptions] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>("options")
  const [channel, setChannel] = useState<string>("")
  const [claimId, setClaimId] = useState("")
  const [sentTo, setSentTo] = useState("")
  const [code, setCode] = useState("")
  const [completionToken, setCompletionToken] = useState("")
  const [claimantEmail, setClaimantEmail] = useState("")
  const [proofNote, setProofNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // claim-time corrections (optional)
  const [showCorrections, setShowCorrections] = useState(false)
  const [corrections, setCorrections] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/clubs/claim-v2/${tenantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setOptions(data)
        setLoading(false)
        if (data?.channels?.length === 1) setChannel(data.channels[0].channel)
      })
      .catch(() => setLoading(false))
  }, [tenantId])

  const correctionsPayload = () => {
    const filled = Object.fromEntries(
      Object.entries(corrections).filter(([, v]) => v.trim().length > 0)
    )
    return Object.keys(filled).length > 0 ? filled : undefined
  }

  const start = async () => {
    setBusy(true)
    setError("")
    try {
      const body: any = { channel, corrections: correctionsPayload() }
      if (channel === "proof") {
        body.claimantEmail = claimantEmail
        body.proofNote = proofNote
      } else if (claimantEmail) {
        body.claimantEmail = claimantEmail
      }
      const res = await fetch(`/api/clubs/claim-v2/${tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't start the claim")
      if (channel === "proof") {
        setStep("proof-sent")
      } else {
        setClaimId(data.claimId)
        setSentTo(data.sentTo ?? "")
        setStep("code")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the claim")
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/clubs/claim-v2/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Verification failed")
      setCompletionToken(data.completionToken)
      setStep("verified")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-ink-500 py-12 text-center text-sm">Loading…</p>
  if (!options) return <p className="text-ink-500 py-12 text-center text-sm">Club not found.</p>

  if (options.alreadyClaimed) {
    return (
      <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-8 text-center">
        <h1 className="font-condensed text-ink-950 text-2xl font-bold uppercase">
          {options.name}
        </h1>
        <p className="text-ink-600 mt-3 text-sm">
          This club is already managed on SportsHub. If you believe that&apos;s wrong, contact
          support.
        </p>
      </div>
    )
  }
  if (options.claimInProgress && step === "options") {
    return (
      <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-8 text-center">
        <h1 className="font-condensed text-ink-950 text-2xl font-bold uppercase">
          {options.name}
        </h1>
        <Badge tone="warning" className="mt-3">
          Claim in progress
        </Badge>
        <p className="text-ink-600 mt-3 text-sm">
          Someone is already claiming this club. If that stalls, the reservation expires on its
          own and you can try again.
        </p>
      </div>
    )
  }

  return (
    <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-8">
      <p className="text-ink-400 text-xs font-semibold uppercase tracking-wide">Claim your club</p>
      <h1 className="font-condensed text-ink-950 mt-1 text-3xl font-bold uppercase leading-none">
        {options.name}
      </h1>
      {options.city && <p className="text-ink-500 mt-1 text-sm">{options.city}</p>}

      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mt-4 rounded-xl border p-3 text-sm">
          {error}
        </div>
      )}

      {step === "options" && (
        <div className="mt-6 space-y-4">
          <p className="text-ink-600 text-sm">
            To prove you run this club, we send a code to the contact info already on file — no
            account needed yet.
          </p>
          <div className="space-y-2">
            {options.channels.map((c: any) => (
              <button
                key={c.channel}
                type="button"
                onClick={() => setChannel(c.channel)}
                aria-pressed={channel === c.channel}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  channel === c.channel
                    ? "border-play-500 bg-play-50"
                    : "border-ink-100 hover:border-ink-300"
                }`}
              >
                <span className="text-ink-900 block text-sm font-semibold">
                  {c.channel === "email"
                    ? `Email a code to ${c.hint}`
                    : c.channel === "sms"
                      ? `Text a code to ${c.hint}`
                      : "I can't access those — submit proof instead"}
                </span>
                {c.channel === "proof" && (
                  <span className="text-ink-500 mt-0.5 block text-xs">
                    Describe your proof (website admin, registration papers, social account) and
                    an admin will review it.
                  </span>
                )}
              </button>
            ))}
          </div>

          {channel === "proof" && (
            <div className="space-y-2">
              <input
                type="email"
                value={claimantEmail}
                onChange={(e) => setClaimantEmail(e.target.value)}
                placeholder="Your email (for the decision)"
                className="border-ink-200 w-full rounded-lg border px-3 py-2 text-sm"
              />
              <textarea
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                placeholder="What can you show that proves you run this club?"
                rows={3}
                className="border-ink-200 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowCorrections(!showCorrections)}
              className="text-play-700 text-sm font-medium hover:underline"
            >
              {showCorrections ? "Hide corrections" : "Our info looks wrong? Propose corrections"}
            </button>
            {showCorrections && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  ["name", "Club name"],
                  ["city", "City"],
                  ["website", "Website"],
                  ["contactEmail", "Contact email"],
                  ["phoneNumber", "Phone"],
                ].map(([key, label]) => (
                  <input
                    key={key}
                    value={corrections[key] ?? ""}
                    onChange={(e) => setCorrections({ ...corrections, [key]: e.target.value })}
                    placeholder={label}
                    className="border-ink-200 rounded-lg border px-3 py-2 text-sm"
                  />
                ))}
                <p className="text-ink-400 col-span-full text-xs">
                  Corrections apply when the claim completes.
                </p>
              </div>
            )}
          </div>

          <Button
            onClick={start}
            disabled={
              busy ||
              !channel ||
              (channel === "proof" && (!claimantEmail || proofNote.trim().length < 10))
            }
            className="w-full"
          >
            {busy ? "Working…" : channel === "proof" ? "Submit for review" : "Send the code"}
          </Button>
        </div>
      )}

      {step === "code" && (
        <div className="mt-6 space-y-4">
          <p className="text-ink-600 text-sm">
            We sent a 6-digit code to <strong>{sentTo}</strong>. It expires in 30 minutes.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="••••••"
            className="border-ink-200 w-full rounded-xl border px-4 py-3 text-center font-mono text-2xl tracking-[0.5em]"
          />
          <Button onClick={verify} disabled={busy || code.length !== 6} className="w-full">
            {busy ? "Checking…" : "Verify"}
          </Button>
        </div>
      )}

      {step === "verified" && (
        <div className="mt-6 space-y-4 text-center">
          <Badge tone="success">Verified</Badge>
          <p className="text-ink-600 text-sm">
            {options.name} is reserved for you for 14 days. Create an account (any email works)
            or sign in — the club binds to <em>your account</em>, not the inbox that got the
            code.
          </p>
          <Link
            href={`/claim/complete?token=${completionToken}`}
            className="bg-play-600 hover:bg-play-700 block w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            Take ownership
          </Link>
          <p className="text-ink-400 text-xs">We also emailed this link to the verified contact.</p>
        </div>
      )}

      {step === "proof-sent" && (
        <div className="mt-6 space-y-3 text-center">
          <Badge tone="play">Submitted</Badge>
          <p className="text-ink-600 text-sm">
            An admin will review your proof — you&apos;ll hear back at{" "}
            <strong>{claimantEmail}</strong>. If approved, that email gets a link to take
            ownership.
          </p>
        </div>
      )}
    </div>
  )
}
